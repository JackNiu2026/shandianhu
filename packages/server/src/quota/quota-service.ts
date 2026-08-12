/**
 * V2.2 家庭共享积分服务
 *
 * 双账本模型：
 * - reserve：Serializable 事务中锁定账户，写 RESERVE 流水，available -> reserved
 * - settle：按实际用量写 SETTLE 流水，保留实际消耗，差额退回 available
 * - release：取消时写 RELEASE 流水，reserved -> available
 * - adjust：管理员人工调整，写 ADJUSTMENT 流水和 AuditLog
 *
 * 每笔操作都携带唯一 operationKey，Prisma UniqueViolation 触发时返回原结果实现幂等。
 * 孩子只能操作自己 parentProfileId 对应的账户；跨家庭调用抛 FORBIDDEN。
 */
import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";
import type { QuotaLedgerKind } from "@prisma/client";

// ─── 类型 ──────────────────────────────────────────────────

export type QuotaAccountRecord = {
  id: string;
  parentProfileId: string;
  availablePoints: bigint;
  reservedPoints: bigint;
  version: number;
};

export type QuotaLedgerRecord = {
  id: string;
  accountId: string;
  operationKey: string;
  childId: string | null;
  modelCallId: string | null;
  kind: QuotaLedgerKind;
  points: bigint;
  balanceAfter: bigint;
  reservationId: string | null;
  reason: string | null;
  createdAt: Date;
};

export interface QuotaDatabase {
  tutorQuotaAccount: {
    findUnique(args: { where: { id: string } | { parentProfileId: string } }): Promise<QuotaAccountRecord | null>;
    create(args: { data: { parentProfileId: string; availablePoints?: bigint; reservedPoints?: bigint } }): Promise<QuotaAccountRecord>;
    update(args: {
      where: { id: string; version: number };
      data: { availablePoints?: bigint; reservedPoints?: bigint; version: { increment: number } };
    }): Promise<QuotaAccountRecord | null>;
  };
  tutorQuotaLedger: {
    create(args: { data: Omit<QuotaLedgerRecord, "id" | "createdAt"> }): Promise<QuotaLedgerRecord>;
    findUnique(args: { where: { operationKey: string } }): Promise<QuotaLedgerRecord | null>;
    findMany(args: { where: { accountId: string }; orderBy: { createdAt: "desc" }; take?: number }): Promise<QuotaLedgerRecord[]>;
  };
  parentProfile: {
    findUnique(args: { where: { id: string }; include?: unknown }): Promise<{ id: string; children?: Array<{ id: string }> } | null>;
  };
  $transaction<T>(callback: (tx: QuotaDatabase) => Promise<T>, isolation: "serializable"): Promise<T>;
}

export type ReserveResult = {
  ledgerId: string;
  /**
   * RESERVE 流水的 operationKey（同时是唯一键），用作后续 settle/release 的 reservationId。
   * 注意：模型中的 reservationId 字段指的是 RESERVE 流水的 operationKey，而不是流水 id。
   */
  reservationId: string;
  accountId: string;
  reservedPoints: bigint;
  availableAfter: bigint;
};

export type SettleResult = {
  ledgerId: string;
  accountId: string;
  usedPoints: bigint;
  releasedDelta: bigint;
  availableAfter: bigint;
};

export type ReleaseResult = {
  ledgerId: string;
  accountId: string;
  releasedPoints: bigint;
  availableAfter: bigint;
};

export type AdjustResult = {
  ledgerId: string;
  accountId: string;
  adjustedPoints: bigint;
  availableAfter: bigint;
};

export type QuotaAccountSummary = {
  parentProfileId: string;
  accountId: string;
  availablePoints: bigint;
  reservedPoints: bigint;
  totalPoints: bigint;
};

// ─── 错误与常量 ────────────────────────────────────────────

const UNIQUE_VIOLATION = "P2002"; // Prisma known error code

function isUniqueViolation(error: unknown, target?: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const meta = (error as { meta?: unknown }).meta;
  if (code !== UNIQUE_VIOLATION) return false;
  if (!target) return true;
  if (!meta || typeof meta !== "object") return false;
  const targets = (meta as { target?: unknown }).target as unknown[] | undefined;
  return Array.isArray(targets) && targets.includes(target);
}

// ─── 服务实现 ──────────────────────────────────────────────

export class QuotaService {
  constructor(private readonly database: QuotaDatabase = prisma as unknown as QuotaDatabase) {}

  /** 获取（或创建）指定家长的积分账户 */
  async getOrCreateAccount(parentProfileId: string): Promise<QuotaAccountRecord> {
    const existing = await this.database.tutorQuotaAccount.findUnique({ where: { parentProfileId } });
    if (existing) return existing;
    try {
      return await this.database.tutorQuotaAccount.create({ data: { parentProfileId } });
    } catch (error) {
      if (isUniqueViolation(error, "parentProfileId")) {
        const retry = await this.database.tutorQuotaAccount.findUnique({ where: { parentProfileId } });
        if (retry) return retry;
      }
      throw error;
    }
  }

  async getAccount(parentProfileId: string): Promise<QuotaAccountSummary | null> {
    const account = await this.database.tutorQuotaAccount.findUnique({ where: { parentProfileId } });
    if (!account) return null;
    return {
      parentProfileId,
      accountId: account.id,
      availablePoints: account.availablePoints,
      reservedPoints: account.reservedPoints,
      totalPoints: account.availablePoints + account.reservedPoints,
    };
  }

  async listLedgers(parentProfileId: string, limit = 100): Promise<QuotaLedgerRecord[]> {
    const account = await this.database.tutorQuotaAccount.findUnique({ where: { parentProfileId } });
    if (!account) return [];
    return this.database.tutorQuotaLedger.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * 预占积分：
   * - 检查 childId 是否属于指定 parentProfileId
   * - 幂等：重复 operationKey 返回原结果
   * - Serializable 事务 + version 乐观锁 + UNIQUE operationKey 防并发透支
   */
  async reserve(params: {
    parentProfileId: string;
    childId: string;
    operationKey: string;
    points: number | bigint;
  }): Promise<ReserveResult> {
    const pointsBig = BigInt(params.points);
    if (pointsBig <= 0n) throw new AppError("VALIDATION_ERROR", 400, "Reservation points must be positive");

    await this.assertChildBelongsToParent(params.parentProfileId, params.childId);

    // 幂等快速路径
    const prior = await this.database.tutorQuotaLedger.findUnique({ where: { operationKey: params.operationKey } });
    if (prior) {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: prior.accountId } });
      if (!account) throw new AppError("INTERNAL_ERROR", 500, "Account disappeared");
      return {
        ledgerId: prior.id,
        reservationId: prior.id,
        accountId: prior.accountId,
        reservedPoints: prior.points,
        availableAfter: account.availablePoints,
      };
    }

    return this.database.$transaction(async (tx) => {
      const account = await tx.tutorQuotaAccount.findUnique({ where: { parentProfileId: params.parentProfileId } })
        ?? await tx.tutorQuotaAccount.create({ data: { parentProfileId: params.parentProfileId } });

      if (account.availablePoints < pointsBig) {
        throw new AppError("QUOTA_EXCEEDED", 402, "Insufficient available points");
      }

      const updated = await tx.tutorQuotaAccount.update({
        where: { id: account.id, version: account.version },
        data: {
          availablePoints: account.availablePoints - pointsBig,
          reservedPoints: account.reservedPoints + pointsBig,
          version: { increment: 1 },
        },
      });
      if (!updated) throw new AppError("RESOURCE_CONFLICT", 409, "Concurrent quota operation");

      const balanceAfter = updated.availablePoints + updated.reservedPoints;
      const ledger = await tx.tutorQuotaLedger.create({
        data: {
          accountId: updated.id,
          operationKey: params.operationKey,
          childId: params.childId,
          modelCallId: null,
          kind: "RESERVE",
          points: pointsBig,
          balanceAfter,
          reservationId: null,
          reason: null,
        },
      });
      return {
        ledgerId: ledger.id,
        reservationId: params.operationKey, // settle/release 用 operationKey 反查 RESERVE 流水
        accountId: updated.id,
        reservedPoints: pointsBig,
        availableAfter: updated.availablePoints,
      };
    }, "serializable").catch((error) => this.unwrapIdempotent(error, params.operationKey, async (ledger) => {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: ledger.accountId } });
      return {
        ledgerId: ledger.id,
        reservationId: ledger.operationKey,
        accountId: ledger.accountId,
        reservedPoints: ledger.points,
        availableAfter: account?.availablePoints ?? 0n,
      } as ReserveResult;
    }));
  }

  /**
   * 结算：从预占额中扣除实际消耗，差额释放回 available
   * - reservationId 必须是该账户的 RESERVE 流水 id
   * - 幂等：重复 operationKey 返回原结果
   */
  async settle(params: {
    parentProfileId: string;
    reservationId: string;
    operationKey: string;
    actualUsedPoints: number | bigint;
    modelCallId?: string;
    childId: string;
  }): Promise<SettleResult> {
    const usedBig = BigInt(params.actualUsedPoints);
    if (usedBig < 0n) throw new AppError("VALIDATION_ERROR", 400, "Used points must be non-negative");

    const prior = await this.database.tutorQuotaLedger.findUnique({ where: { operationKey: params.operationKey } });
    if (prior) {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: prior.accountId } });
      // Settle 流水 points 为实际消耗；如果记录了 reservationId 可以找到 RESERVE 流水计算 delta
      const releasedDelta = prior.reservationId
        ? await this.settleReleasedDeltaFromReservation(txOrGlobalDatabase(this.database), prior.reservationId, prior.points)
        : 0n;
      return {
        ledgerId: prior.id,
        accountId: prior.accountId,
        usedPoints: prior.points, // 幂等时用已记账的实际消耗，不用 usedBig
        releasedDelta,
        availableAfter: account?.availablePoints ?? 0n,
      };
    }

    return this.database.$transaction(async (tx) => {
      const account = await tx.tutorQuotaAccount.findUnique({ where: { parentProfileId: params.parentProfileId } });
      if (!account) throw new AppError("NOT_FOUND", 404, "Quota account not found");

      // reservationId 是 RESERVE 流水的 operationKey
      const reserveLedger = await tx.tutorQuotaLedger.findUnique({ where: { operationKey: params.reservationId } });
      if (!reserveLedger || reserveLedger.kind !== "RESERVE") {
        throw new AppError("NOT_FOUND", 404, "Reservation not found");
      }
      if (reserveLedger.accountId !== account.id) {
        throw new AppError("FORBIDDEN", 403, "Reservation belongs to a different account");
      }
      if (reserveLedger.childId && reserveLedger.childId !== params.childId) {
        throw new AppError("FORBIDDEN", 403, "Reservation belongs to a different child");
      }

      const reservedPoints = reserveLedger.points;
      const settlePoints = usedBig > reservedPoints ? reservedPoints : usedBig;
      const releasedDelta = reservedPoints - settlePoints;

      // reserved 全部释放；实际消耗从 available 中扣（因为 available + reserved 的总量应守恒扣掉实际消耗）
      // 可用表达：reserved -> 0；available += (releasedDelta - settlePoints?)
      // 正确做法：reserved -= reservedPoints (清零), available -= settlePoints (从总额扣除), total = total - settlePoints
      const updated = await tx.tutorQuotaAccount.update({
        where: { id: account.id, version: account.version },
        data: {
          reservedPoints: account.reservedPoints - reservedPoints,
          availablePoints: account.availablePoints + reservedPoints - settlePoints,
          version: { increment: 1 },
        },
      });
      if (!updated) throw new AppError("RESOURCE_CONFLICT", 409, "Concurrent quota operation");

      const balanceAfter = updated.availablePoints + updated.reservedPoints;
      const ledger = await tx.tutorQuotaLedger.create({
        data: {
          accountId: updated.id,
          operationKey: params.operationKey,
          childId: params.childId,
          modelCallId: params.modelCallId ?? null,
          kind: "SETTLE",
          points: settlePoints, // 实际消耗（正数）
          balanceAfter,
          reservationId: params.reservationId,
          reason: null,
        },
      });
      return {
        ledgerId: ledger.id,
        accountId: updated.id,
        usedPoints: settlePoints,
        releasedDelta,
        availableAfter: updated.availablePoints,
      };
    }, "serializable").catch((error) => this.unwrapIdempotent(error, params.operationKey, async (ledger) => {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: ledger.accountId } });
      const releasedDelta = ledger.reservationId
        ? await this.settleReleasedDeltaFromReservation(this.database, ledger.reservationId, ledger.points)
        : 0n;
      return {
        ledgerId: ledger.id,
        accountId: ledger.accountId,
        usedPoints: ledger.points,
        releasedDelta,
        availableAfter: account?.availablePoints ?? 0n,
      } as SettleResult;
    }));
  }

  /**
   * 释放：取消预占，将 reserved 全部返回 available
   * - reservationId 必须是 RESERVE 流水 id
   * - 幂等：重复 operationKey 返回原结果
   */
  async release(params: {
    parentProfileId: string;
    reservationId: string;
    operationKey: string;
    childId?: string;
    reason?: string;
  }): Promise<ReleaseResult> {
    const prior = await this.database.tutorQuotaLedger.findUnique({ where: { operationKey: params.operationKey } });
    if (prior) {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: prior.accountId } });
      return {
        ledgerId: prior.id,
        accountId: prior.accountId,
        releasedPoints: prior.points,
        availableAfter: account?.availablePoints ?? 0n,
      };
    }

    return this.database.$transaction(async (tx) => {
      const account = await tx.tutorQuotaAccount.findUnique({ where: { parentProfileId: params.parentProfileId } });
      if (!account) throw new AppError("NOT_FOUND", 404, "Quota account not found");

      const reserveLedger = await tx.tutorQuotaLedger.findUnique({ where: { operationKey: params.reservationId } });
      if (!reserveLedger || reserveLedger.kind !== "RESERVE") {
        throw new AppError("NOT_FOUND", 404, "Reservation not found");
      }
      if (reserveLedger.accountId !== account.id) {
        throw new AppError("FORBIDDEN", 403, "Reservation belongs to a different account");
      }

      const reservedPoints = reserveLedger.points;
      const updated = await tx.tutorQuotaAccount.update({
        where: { id: account.id, version: account.version },
        data: {
          reservedPoints: account.reservedPoints - reservedPoints,
          availablePoints: account.availablePoints + reservedPoints,
          version: { increment: 1 },
        },
      });
      if (!updated) throw new AppError("RESOURCE_CONFLICT", 409, "Concurrent quota operation");

      const balanceAfter = updated.availablePoints + updated.reservedPoints;
      const ledger = await tx.tutorQuotaLedger.create({
        data: {
          accountId: updated.id,
          operationKey: params.operationKey,
          childId: params.childId ?? reserveLedger.childId ?? null,
          modelCallId: null,
          kind: "RELEASE",
          points: reservedPoints,
          balanceAfter,
          reservationId: params.reservationId,
          reason: params.reason ?? null,
        },
      });
      return {
        ledgerId: ledger.id,
        accountId: updated.id,
        releasedPoints: reservedPoints,
        availableAfter: updated.availablePoints,
      };
    }, "serializable").catch((error) => this.unwrapIdempotent(error, params.operationKey, async (ledger) => {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: ledger.accountId } });
      return {
        ledgerId: ledger.id,
        accountId: ledger.accountId,
        releasedPoints: ledger.points,
        availableAfter: account?.availablePoints ?? 0n,
      } as ReleaseResult;
    }));
  }

  /**
   * 管理员人工调整积分。
   * - 正数增加 available，负数减少 available
   * - 余额不足（扣到负值）时拒绝
   * - 必须提供原因；会写 AuditLog（在调用方使用 QuotaAuditAdapter 记录）
   */
  async adjust(params: {
    parentProfileId: string;
    operationKey: string;
    points: number | bigint;
    reason: string;
    adminUserId?: string;
    childId?: string;
  }): Promise<AdjustResult> {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", 400, "Reason is required for adjustments");
    }
    const pointsBig = BigInt(params.points);
    if (pointsBig === 0n) throw new AppError("VALIDATION_ERROR", 400, "Adjustment points must be non-zero");

    const prior = await this.database.tutorQuotaLedger.findUnique({ where: { operationKey: params.operationKey } });
    if (prior) {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: prior.accountId } });
      return {
        ledgerId: prior.id,
        accountId: prior.accountId,
        adjustedPoints: pointsBig,
        availableAfter: account?.availablePoints ?? 0n,
      };
    }

    return this.database.$transaction(async (tx) => {
      const account = await tx.tutorQuotaAccount.findUnique({ where: { parentProfileId: params.parentProfileId } })
        ?? await tx.tutorQuotaAccount.create({ data: { parentProfileId: params.parentProfileId } });

      const newAvailable = account.availablePoints + pointsBig;
      if (newAvailable < 0n) {
        throw new AppError("QUOTA_EXCEEDED", 402, "Cannot reduce available points below zero");
      }

      const updated = await tx.tutorQuotaAccount.update({
        where: { id: account.id, version: account.version },
        data: {
          availablePoints: newAvailable,
          version: { increment: 1 },
        },
      });
      if (!updated) throw new AppError("RESOURCE_CONFLICT", 409, "Concurrent quota operation");

      const balanceAfter = updated.availablePoints + updated.reservedPoints;
      const ledger = await tx.tutorQuotaLedger.create({
        data: {
          accountId: updated.id,
          operationKey: params.operationKey,
          childId: params.childId ?? null,
          modelCallId: null,
          kind: "ADJUSTMENT",
          points: pointsBig,
          balanceAfter,
          reservationId: null,
          reason: params.reason,
        },
      });
      return {
        ledgerId: ledger.id,
        accountId: updated.id,
        adjustedPoints: pointsBig,
        availableAfter: updated.availablePoints,
      };
    }, "serializable").catch((error) => this.unwrapIdempotent(error, params.operationKey, async (ledger) => {
      const account = await this.database.tutorQuotaAccount.findUnique({ where: { id: ledger.accountId } });
      return {
        ledgerId: ledger.id,
        accountId: ledger.accountId,
        adjustedPoints: pointsBig,
        availableAfter: account?.availablePoints ?? 0n,
      } as AdjustResult;
    }));
  }

  // ─── 内部帮助方法 ────────────────────────────────────────

  private async assertChildBelongsToParent(parentProfileId: string, childId: string): Promise<void> {
    const profile = await this.database.parentProfile.findUnique({
      where: { id: parentProfileId },
      include: { children: { where: { id: childId }, select: { id: true } } },
    });
    if (!profile) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    if (!profile.children || profile.children.length === 0) {
      throw new AppError("FORBIDDEN", 403, "Child is not in the parent family");
    }
  }

  private async unwrapIdempotent<T>(
    error: unknown,
    operationKey: string,
    buildResult: (ledger: QuotaLedgerRecord) => Promise<T>,
  ): Promise<T> {
    if (!isUniqueViolation(error, "operationKey")) throw error;
    const ledger = await this.database.tutorQuotaLedger.findUnique({ where: { operationKey } });
    if (!ledger) throw error;
    return buildResult(ledger);
  }

  /**
   * 根据 RESERVE 流水的 operationKey 和 SETTLE 已扣 points，计算 release delta。
   * 传入 db 以在事务内外复用。
   */
  private async settleReleasedDeltaFromReservation(
    db: Pick<QuotaDatabase, "tutorQuotaLedger">,
    reserveOperationKey: string,
    settlePoints: bigint,
  ): Promise<bigint> {
    const reserve = await db.tutorQuotaLedger.findUnique({ where: { operationKey: reserveOperationKey } });
    if (!reserve || reserve.kind !== "RESERVE") return 0n;
    return reserve.points - settlePoints;
  }
}

/**
 * 把外部 database（事务内的 tx 或全局 this.database）统一成只需要 tutorQuotaLedger 的子集。
 * 事务回调里传 tx，全局调用传 this.database。
 */
function txOrGlobalDatabase(db: QuotaDatabase): Pick<QuotaDatabase, "tutorQuotaLedger"> {
  return { tutorQuotaLedger: db.tutorQuotaLedger };
}
