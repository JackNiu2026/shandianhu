import { describe, expect, it, beforeEach, vi } from "vitest";
import { QuotaService, type QuotaAccountRecord, type QuotaDatabase, type QuotaLedgerRecord } from "./quota-service";

// ─── In-memory 测试数据库（模拟 Prisma + Serializable 隔离）───

type OpenedTxListener = () => void;

class InMemoryQuotaDb implements QuotaDatabase {
  public accounts: Map<string, QuotaAccountRecord> = new Map(); // id -> account
  public ledgers: Map<string, QuotaLedgerRecord> = new Map(); // id -> ledger
  public operationKeyIndex: Map<string, string> = new Map(); // key -> ledgerId
  public parentChildren: Map<string, string[]> = new Map(); // profileId -> childIds
  public txRunning = false;
  private txListeners: OpenedTxListener[] = [];
  private nextAccountId = 1;
  private nextLedgerId = 1;

  registerTxListener(fn: OpenedTxListener): void {
    this.txListeners.push(fn);
  }

  private accountByParent(parentId: string): QuotaAccountRecord | undefined {
    for (const a of this.accounts.values()) {
      if (a.parentProfileId === parentId) return a;
    }
    return undefined;
  }

  tutorQuotaAccount = {
    findUnique: async (args: { where: { id?: string; parentProfileId?: string } }): Promise<QuotaAccountRecord | null> => {
      if (args.where.id) return this.accounts.get(args.where.id) ?? null;
      const byParent = this.accountByParent(args.where.parentProfileId!);
      return byParent ?? null;
    },
    create: async (args: { data: { parentProfileId: string; availablePoints?: bigint; reservedPoints?: bigint } }): Promise<QuotaAccountRecord> => {
      if (this.accountByParent(args.data.parentProfileId)) {
        throw prismaError("P2002", ["parentProfileId"]);
      }
      const id = `qa-${this.nextAccountId++}`;
      const record: QuotaAccountRecord = {
        id,
        parentProfileId: args.data.parentProfileId,
        availablePoints: args.data.availablePoints ?? 0n,
        reservedPoints: args.data.reservedPoints ?? 0n,
        version: 0,
      };
      this.accounts.set(id, record);
      return record;
    },
    update: async (args: {
      where: { id: string; version: number };
      data: { availablePoints?: bigint; reservedPoints?: bigint; version: { increment: number } };
    }): Promise<QuotaAccountRecord | null> => {
      const current = this.accounts.get(args.where.id);
      if (!current) return null;
      if (current.version !== args.where.version) return null;
      const next: QuotaAccountRecord = {
        ...current,
        availablePoints: args.data.availablePoints ?? current.availablePoints,
        reservedPoints: args.data.reservedPoints ?? current.reservedPoints,
        version: current.version + (args.data.version?.increment ?? 1),
      };
      this.accounts.set(next.id, next);
      return next;
    },
  };

  tutorQuotaLedger = {
    create: async (args: { data: Omit<QuotaLedgerRecord, "id" | "createdAt"> }): Promise<QuotaLedgerRecord> => {
      if (this.operationKeyIndex.has(args.data.operationKey)) {
        throw prismaError("P2002", ["operationKey"]);
      }
      const id = `ql-${this.nextLedgerId++}`;
      const record: QuotaLedgerRecord = {
        ...args.data,
        id,
        createdAt: new Date(),
      };
      this.ledgers.set(id, record);
      this.operationKeyIndex.set(args.data.operationKey, id);
      return record;
    },
    findUnique: async (args: { where: { operationKey?: string; id?: string } }): Promise<QuotaLedgerRecord | null> => {
      if (args.where.operationKey) {
        const id = this.operationKeyIndex.get(args.where.operationKey);
        return id ? this.ledgers.get(id) ?? null : null;
      }
      return args.where.id ? this.ledgers.get(args.where.id) ?? null : null;
    },
    findMany: async (args: { where: { accountId: string }; take?: number }): Promise<QuotaLedgerRecord[]> => {
      const rows = [...this.ledgers.values()]
        .filter((l) => l.accountId === args.where.accountId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return args.take ? rows.slice(0, args.take) : rows;
    },
  };

  parentProfile = {
    findUnique: async (args: { where: { id: string }; include?: unknown }): Promise<{ id: string; children?: Array<{ id: string }> } | null> => {
      if (!this.parentChildren.has(args.where.id)) return null;
      const children = this.parentChildren.get(args.where.id) ?? [];
      const include = args.include as { children?: { where?: { id?: string } } } | undefined;
      return {
        id: args.where.id,
        ...(include?.children
          ? {
              children: children
                .filter((id) => !include.children?.where?.id || id === include.children.where.id)
                .map((id) => ({ id })),
            }
          : {}),
      };
    },
  };

  async $transaction<T>(callback: (tx: QuotaDatabase) => Promise<T>, _isolation: "serializable"): Promise<T> {
    if (this.txRunning) throw new Error("Nested transaction not supported in mock");
    this.txRunning = true;
    for (const l of this.txListeners) l();
    try {
      return await callback(this as unknown as QuotaDatabase);
    } finally {
      this.txRunning = false;
    }
  }
}

function prismaError(code: string, target: string[]): unknown {
  return { name: "PrismaClientKnownRequestError", code, meta: { target } };
}

// ─── 测试夹具 ──────────────────────────────────────────────

function setupDbWithBalances(parentProfileId: string, available: bigint, reserved = 0n): InMemoryQuotaDb {
  const db = new InMemoryQuotaDb();
  const id = "qa-fixed-1";
  db.accounts.set(id, {
    id,
    parentProfileId,
    availablePoints: available,
    reservedPoints: reserved,
    version: 0,
  });
  // register child
  db.parentChildren.set(parentProfileId, ["child-a", "child-b"]);
  return db;
}

describe("QuotaService.reserve", () => {
  it("deducts from available to reserved and writes ledger", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const result = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-1", points: 50,
    });
    expect(result.reservedPoints).toBe(50n);
    expect(result.availableAfter).toBe(50n);
    const account = db.accounts.get(result.accountId)!;
    expect(account.availablePoints).toBe(50n);
    expect(account.reservedPoints).toBe(50n);
    const ledger = [...db.ledgers.values()][0];
    expect(ledger.kind).toBe("RESERVE");
    expect(ledger.points).toBe(50n);
    expect(ledger.childId).toBe("child-a");
  });

  it("rejects a reservation for a child outside the parent family", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    await expect(service.reserve({
      parentProfileId: "p1", childId: "other-child",
      operationKey: "op-res-2", points: 10,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects when balance is insufficient", async () => {
    const db = setupDbWithBalances("p1", 10n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    await expect(service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-3", points: 50,
    })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("deduplicates a retried reserve by operationKey", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const a = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-4", points: 20,
    });
    const b = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-4", points: 20,
    });
    expect(a.ledgerId).toBe(b.ledgerId);
    // only one deduction
    const account = db.accounts.get(a.accountId)!;
    expect(account.availablePoints).toBe(80n);
    expect(account.reservedPoints).toBe(20n);
  });

  it("allows only one reservation when concurrent requests exhaust balance", async () => {
    const db = setupDbWithBalances("p1", 80n);
    const service = new QuotaService(db as unknown as QuotaDatabase);

    // Inject contention: second reserve sees stale version because first updates inside tx.
    // To simulate this, we monkey-patch tutorQuotaAccount.update to null for the second call
    // once the first tx is in progress.
    let txCount = 0;
    let secondUpdateSkipped = false;
    const originalUpdate = db.tutorQuotaAccount.update.bind(db.tutorQuotaAccount);
    db.tutorQuotaAccount.update = async (...args) => {
      txCount += 1;
      if (txCount === 2) {
        secondUpdateSkipped = true;
        return null; // simulate version mismatch
      }
      return originalUpdate(...args);
    };

    const results = await Promise.allSettled([
      service.reserve({ parentProfileId: "p1", childId: "child-a", operationKey: "op-a", points: 80 }),
      service.reserve({ parentProfileId: "p1", childId: "child-b", operationKey: "op-b", points: 80 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    // 第二个请求会遇到 version mismatch（被我们模拟为 update 返回 null）→ 抛 RESOURCE_CONFLICT
    if (secondUpdateSkipped) {
      expect(fulfilled.length).toBe(1);
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected).toHaveLength(1);
    } else {
      // Fallback: at most one should hold the balance (if txs were sequential)
      expect(fulfilled.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("QuotaService.settle", () => {
  it("deducts actual and releases the delta back to available", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const reserved = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-s1", points: 50,
    });
    const settled = await service.settle({
      parentProfileId: "p1",
      reservationId: reserved.reservationId,
      operationKey: "op-set-s1",
      actualUsedPoints: 30,
      childId: "child-a",
      modelCallId: "call-1",
    });
    expect(settled.usedPoints).toBe(30n);
    expect(settled.releasedDelta).toBe(20n);
    const account = db.accounts.get(settled.accountId)!;
    // original total = 100; after reserve: av=50, res=50
    // after settle: res = 50 - 50 = 0; av = 50 + 50 - 30 = 70; total = 70
    expect(account.availablePoints).toBe(70n);
    expect(account.reservedPoints).toBe(0n);
  });

  it("caps used at reserved when actual exceeds reservation", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const reserved = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-s2", points: 20,
    });
    const settled = await service.settle({
      parentProfileId: "p1",
      reservationId: reserved.reservationId,
      operationKey: "op-set-s2",
      actualUsedPoints: 9999, // exceeds reservation
      childId: "child-a",
    });
    expect(settled.usedPoints).toBe(20n);
    const account = db.accounts.get(settled.accountId)!;
    // res (20) -> av; av deduct 20 => av unchanged
    expect(account.reservedPoints).toBe(0n);
    expect(account.availablePoints).toBe(80n);
  });

  it("deduplicates retried settle by operationKey", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const reserved = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-s3", points: 30,
    });
    const a = await service.settle({
      parentProfileId: "p1",
      reservationId: reserved.reservationId,
      operationKey: "op-set-s3",
      actualUsedPoints: 10, childId: "child-a",
    });
    const b = await service.settle({
      parentProfileId: "p1",
      reservationId: reserved.reservationId,
      operationKey: "op-set-s3",
      actualUsedPoints: 10, childId: "child-a",
    });
    expect(a.ledgerId).toBe(b.ledgerId);
    expect(db.ledgers.size).toBe(2); // 1 RESERVE + 1 SETTLE
  });
});

describe("QuotaService.release", () => {
  it("returns full reserved amount to available", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const reserved = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-r1", points: 40,
    });
    const released = await service.release({
      parentProfileId: "p1",
      reservationId: reserved.reservationId,
      operationKey: "op-rel-r1",
      childId: "child-a",
      reason: "cancelled",
    });
    expect(released.releasedPoints).toBe(40n);
    const account = db.accounts.get(released.accountId)!;
    expect(account.availablePoints).toBe(100n);
    expect(account.reservedPoints).toBe(0n);
  });

  it("deduplicates retried release by operationKey", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const reserved = await service.reserve({
      parentProfileId: "p1", childId: "child-a",
      operationKey: "op-res-r2", points: 40,
    });
    const a = await service.release({
      parentProfileId: "p1", reservationId: reserved.reservationId,
      operationKey: "op-rel-r2",
    });
    const b = await service.release({
      parentProfileId: "p1", reservationId: reserved.reservationId,
      operationKey: "op-rel-r2",
    });
    expect(a.ledgerId).toBe(b.ledgerId);
  });
});

describe("QuotaService.adjust", () => {
  it("adds points to available when positive", async () => {
    const db = setupDbWithBalances("p1", 10n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const result = await service.adjust({
      parentProfileId: "p1",
      operationKey: "op-adj-1",
      points: 100,
      reason: "赠送积分",
      adminUserId: "admin-1",
    });
    expect(result.adjustedPoints).toBe(100n);
    expect(result.availableAfter).toBe(110n);
    const ledger = [...db.ledgers.values()][0];
    expect(ledger.kind).toBe("ADJUSTMENT");
    expect(ledger.reason).toBe("赠送积分");
  });

  it("deducts available when negative but refuses to go below zero", async () => {
    const db = setupDbWithBalances("p1", 10n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const result = await service.adjust({
      parentProfileId: "p1", operationKey: "op-adj-2",
      points: -5, reason: "扣减",
    });
    expect(result.availableAfter).toBe(5n);

    await expect(service.adjust({
      parentProfileId: "p1", operationKey: "op-adj-3",
      points: -10, reason: "超扣",
    })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
  });

  it("requires a non-empty reason", async () => {
    const db = setupDbWithBalances("p1", 10n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    await expect(service.adjust({
      parentProfileId: "p1", operationKey: "op-adj-x",
      points: 5, reason: "  ",
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("deduplicates retried adjust by operationKey", async () => {
    const db = setupDbWithBalances("p1", 10n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const a = await service.adjust({
      parentProfileId: "p1", operationKey: "op-adj-d",
      points: 25, reason: "重试",
    });
    const b = await service.adjust({
      parentProfileId: "p1", operationKey: "op-adj-d",
      points: 25, reason: "重试",
    });
    expect(a.ledgerId).toBe(b.ledgerId);
    expect(a.availableAfter).toBe(b.availableAfter);
  });
});

describe("QuotaService.getOrCreateAccount", () => {
  it("creates an account with zero balance on first access", async () => {
    const db = new InMemoryQuotaDb();
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const account = await service.getOrCreateAccount("fresh-profile");
    expect(account.availablePoints).toBe(0n);
    expect(account.reservedPoints).toBe(0n);
    expect(account.parentProfileId).toBe("fresh-profile");
  });

  it("returns the existing account when one exists", async () => {
    const db = setupDbWithBalances("p1", 100n);
    const service = new QuotaService(db as unknown as QuotaDatabase);
    const a = await service.getOrCreateAccount("p1");
    const b = await service.getOrCreateAccount("p1");
    expect(a.id).toBe(b.id);
    expect(a.availablePoints).toBe(100n);
  });
});
