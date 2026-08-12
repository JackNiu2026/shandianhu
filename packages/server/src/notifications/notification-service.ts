import { AppError } from "../errors/app-error";
import { prisma } from "../db/client";

export type NotificationType = "ASSESSMENT_COMPLETE" | "REPORT_READY" | "SYSTEM";
export type NotificationStatus = "UNREAD" | "READ";

export type NotificationRecord = {
  id: string;
  userId: string;
  parentProfileId: string | null;
  childId: string | null;
  dedupeKey: string;
  type: NotificationType;
  status: NotificationStatus;
  targetRoute: string | null;
  targetParams: unknown;
  body: unknown;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationCreateInput = {
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  body: Record<string, unknown>;
  targetRoute?: string | null;
  targetParams?: Record<string, unknown> | null;
  childId?: string | null;
  parentProfileId?: string | null;
};

export type NotificationListOptions = {
  limit?: number;
  cursor?: string;
};

export type NotificationListResult = {
  items: NotificationRecord[];
  nextCursor: string | null;
};

const DEFAULT_LIMIT = 20;

export interface NotificationDatabase {
  notification: {
    findMany(args: {
      where: { userId: string };
      orderBy: { createdAt: "desc" };
      take: number;
      cursor?: { id: string };
      skip?: number;
    }): Promise<NotificationRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<NotificationRecord | null>;
    count(args: { where: { userId: string; status: NotificationStatus } }): Promise<number>;
    update(args: {
      where: { id: string };
      data: { status: NotificationStatus; readAt: Date };
    }): Promise<NotificationRecord>;
    updateMany(args: {
      where: { userId: string; status: NotificationStatus };
      data: { status: NotificationStatus; readAt: Date };
    }): Promise<{ count: number }>;
    upsert(args: {
      where: { dedupeKey: string };
      create: Omit<NotificationRecord, "id" | "createdAt" | "readAt" | "status"> & {
        status?: NotificationStatus;
      };
      update: Record<string, never>;
    }): Promise<NotificationRecord>;
  };
}

export class NotificationService {
  constructor(
    private readonly database: NotificationDatabase = prisma as unknown as NotificationDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** 分页查询用户通知（UNREAD/READ 都查），按 createdAt 倒序，游标分页。 */
  async listForUser(userId: string, options?: NotificationListOptions): Promise<NotificationListResult> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const cursor = options?.cursor;

    const items = await this.database.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    return {
      items: sliced,
      nextCursor: hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null,
    };
  }

  /** 标记单条通知已读，校验归属权（非本人通知抛 NOT_FOUND）。 */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationRecord> {
    const notification = await this.database.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) {
      throw new AppError("NOT_FOUND", 404, "Notification not found");
    }
    if (notification.status === "READ") return notification;
    return this.database.notification.update({
      where: { id: notificationId },
      data: { status: "READ", readAt: this.clock() },
    });
  }

  /** 标记当前用户的全部未读通知为已读。 */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return this.database.notification.updateMany({
      where: { userId, status: "UNREAD" },
      data: { status: "READ", readAt: this.clock() },
    });
  }

  /** 内部方法：使用 dedupeKey 幂等创建通知，重复创建不报错。 */
  async create(input: NotificationCreateInput): Promise<NotificationRecord> {
    return this.database.notification.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: {
        userId: input.userId,
        type: input.type,
        dedupeKey: input.dedupeKey,
        body: input.body,
        targetRoute: input.targetRoute ?? null,
        targetParams: input.targetParams ?? null,
        childId: input.childId ?? null,
        parentProfileId: input.parentProfileId ?? null,
      },
      update: {},
    });
  }
}
