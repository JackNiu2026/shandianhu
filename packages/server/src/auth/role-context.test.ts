import { describe, expect, it, vi } from "vitest";
import {
  resolveRoleContext,
  type RoleContextDatabase,
} from "./role-context";

type UserRow = {
  parentProfile: { id: string } | null;
  teacherProfile: { id: string; serviceStatus: "ACTIVE" | "PAUSED" | "BANNED" } | null;
};

function createClient(user: UserRow | null): RoleContextDatabase {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  };
}

describe("resolveRoleContext", () => {
  it("does not authorize a parent request with teacher context (throws FORBIDDEN)", async () => {
    // 用户仅具备老师身份，没有 parentProfile
    const client = createClient({
      parentProfile: null,
      teacherProfile: { id: "teacher-1", serviceStatus: "ACTIVE" },
    });

    await expect(
      resolveRoleContext({ userId: "user-1" }, "parent", undefined, client),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("does not authorize a teacher request with parent context (throws FORBIDDEN)", async () => {
    // 用户仅具备家长身份，没有 teacherProfile
    const client = createClient({
      parentProfile: { id: "parent-1" },
      teacherProfile: null,
    });

    await expect(
      resolveRoleContext({ userId: "user-1" }, "teacher", undefined, client),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects teacher workspace when serviceStatus is PAUSED", async () => {
    const client = createClient({
      parentProfile: { id: "parent-1" },
      teacherProfile: { id: "teacher-1", serviceStatus: "PAUSED" },
    });

    await expect(
      resolveRoleContext({ userId: "user-1" }, "teacher", undefined, client),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("resolves parent context when parentProfile exists", async () => {
    const client = createClient({
      parentProfile: { id: "parent-1" },
      teacherProfile: null,
    });

    await expect(
      resolveRoleContext({ userId: "user-1" }, "parent", undefined, client),
    ).resolves.toEqual({
      userId: "user-1",
      workspace: "parent",
      parentProfileId: "parent-1",
      teacherProfileId: null,
      teacherServiceStatus: null,
    });
    expect(client.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });
});
