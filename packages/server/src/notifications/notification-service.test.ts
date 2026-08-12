import { describe, expect, it } from "vitest";
import {
  NotificationService,
  type NotificationDatabase,
  type NotificationRecord,
} from "./notification-service";

function createDatabase(notifications: NotificationRecord[]): {
  database: NotificationDatabase;
  now: () => Date;
} {
  let nextId = notifications.length + 1;
  const fixedNow = new Date("2026-08-11T00:00:00Z");

  return {
    now: () => fixedNow,
    database: {
      notification: {
        findMany: async ({ where, orderBy, take, cursor, skip }) => {
          let result = notifications
            .filter((item) => item.userId === where.userId)
            .sort((left, right) =>
              orderBy.createdAt === "desc"
                ? right.createdAt.getTime() - left.createdAt.getTime()
                : left.createdAt.getTime() - right.createdAt.getTime(),
            );
          if (cursor) {
            const index = result.findIndex((item) => item.id === cursor.id);
            result = index >= 0 ? result.slice(index + (skip ?? 0)) : [];
          }
          return result.slice(0, take);
        },
        findUnique: async ({ where: { id } }) =>
          notifications.find((item) => item.id === id) ?? null,
        count: async ({ where }) =>
          notifications.filter(
            (item) => item.userId === where.userId && item.status === where.status,
          ).length,
        update: async ({ where: { id }, data }) => {
          const item = notifications.find((entry) => entry.id === id);
          if (!item) throw new Error("missing notification");
          item.status = data.status;
          item.readAt = data.readAt;
          return item;
        },
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const item of notifications) {
            if (item.userId === where.userId && item.status === where.status) {
              item.status = data.status;
              item.readAt = data.readAt;
              count += 1;
            }
          }
          return { count };
        },
        upsert: async ({ where: { dedupeKey }, create }) => {
          const existing = notifications.find((item) => item.dedupeKey === dedupeKey);
          if (existing) return existing;
          const record: NotificationRecord = {
            id: `notif-${nextId++}`,
            userId: create.userId,
            parentProfileId: create.parentProfileId,
            childId: create.childId,
            dedupeKey: create.dedupeKey,
            type: create.type,
            status: create.status ?? "UNREAD",
            targetRoute: create.targetRoute,
            targetParams: create.targetParams,
            body: create.body,
            readAt: null,
            createdAt: new Date(),
          };
          notifications.push(record);
          return record;
        },
      },
    },
  };
}

function notification(
  id: string,
  userId: string,
  createdAt: string,
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id,
    userId,
    parentProfileId: null,
    childId: null,
    dedupeKey: `key-${id}`,
    type: "SYSTEM",
    status: "UNREAD",
    targetRoute: null,
    targetParams: null,
    body: { message: id },
    readAt: null,
    createdAt: new Date(createdAt),
    ...overrides,
  };
}

describe("NotificationService", () => {
  it("listForUser 返回用户通知列表（按时间倒序）", async () => {
    const records = [
      notification("n-old", "user-a", "2026-01-01"),
      notification("n-new", "user-a", "2026-03-01"),
      notification("n-other", "user-b", "2026-02-01"),
    ];
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    const result = await service.listForUser("user-a");

    expect(result.items.map((item) => item.id)).toEqual(["n-new", "n-old"]);
    expect(result.nextCursor).toBeNull();
  });

  it("listForUser 支持游标分页", async () => {
    const records = Array.from({ length: 5 }, (_, index) =>
      notification(`n-${index + 1}`, "user-a", `2026-01-0${index + 1}`),
    );
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    const first = await service.listForUser("user-a", { limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual(["n-5", "n-4"]);
    expect(first.nextCursor).toBe("n-4");

    const second = await service.listForUser("user-a", { limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((item) => item.id)).toEqual(["n-3", "n-2"]);
    expect(second.nextCursor).toBe("n-2");
  });

  it("markAsRead 校验归属权（非本人通知抛 NOT_FOUND）", async () => {
    const records = [notification("n-a", "user-a", "2026-01-01")];
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    await expect(service.markAsRead("user-b", "n-a")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    expect(records[0].status).toBe("UNREAD");
  });

  it("markAsRead 标记本人通知为已读", async () => {
    const records = [notification("n-a", "user-a", "2026-01-01")];
    const { database, now } = createDatabase(records);
    const service = new NotificationService(database, now);

    const updated = await service.markAsRead("user-a", "n-a");

    expect(updated.status).toBe("READ");
    expect(updated.readAt).toBe(now());
  });

  it("markAsRead 对已读通知保持幂等", async () => {
    const records = [
      notification("n-a", "user-a", "2026-01-01", { status: "READ", readAt: new Date("2026-01-02") }),
    ];
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    const result = await service.markAsRead("user-a", "n-a");
    expect(result.status).toBe("READ");
  });

  it("markAllAsRead 标记全部未读通知", async () => {
    const records = [
      notification("n-1", "user-a", "2026-01-01", { status: "UNREAD" }),
      notification("n-2", "user-a", "2026-01-02", { status: "READ", readAt: new Date() }),
      notification("n-3", "user-a", "2026-01-03", { status: "UNREAD" }),
      notification("n-4", "user-b", "2026-01-04", { status: "UNREAD" }),
    ];
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    const result = await service.markAllAsRead("user-a");

    expect(result.count).toBe(2);
    expect(records.filter((item) => item.userId === "user-a").every((item) => item.status === "READ")).toBe(true);
    expect(records.find((item) => item.id === "n-4")?.status).toBe("UNREAD");
  });

  it("create 用 dedupeKey 幂等（重复创建不报错）", async () => {
    const records: NotificationRecord[] = [];
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    const first = await service.create({
      userId: "user-a",
      type: "REPORT_READY",
      dedupeKey: "report-ready:report-1:user-a",
      body: { reportId: "report-1" },
    });

    const second = await service.create({
      userId: "user-a",
      type: "REPORT_READY",
      dedupeKey: "report-ready:report-1:user-a",
      body: { reportId: "report-1" },
    });

    expect(second.id).toBe(first.id);
    expect(records.length).toBe(1);
  });

  it("create 不同 dedupeKey 创建独立通知", async () => {
    const records: NotificationRecord[] = [];
    const { database } = createDatabase(records);
    const service = new NotificationService(database);

    await service.create({
      userId: "user-a",
      type: "REPORT_READY",
      dedupeKey: "report-ready:report-1:user-a",
      body: { reportId: "report-1" },
    });
    await service.create({
      userId: "user-a",
      type: "ASSESSMENT_COMPLETE",
      dedupeKey: "assessment-complete:run-1:user-a",
      body: { runId: "run-1" },
    });

    expect(records.length).toBe(2);
    expect(records.map((item) => item.type)).toContain("REPORT_READY");
    expect(records.map((item) => item.type)).toContain("ASSESSMENT_COMPLETE");
  });
});
