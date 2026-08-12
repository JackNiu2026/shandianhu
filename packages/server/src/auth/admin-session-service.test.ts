import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  authenticateAdminCredentials,
  changeAdminPassword,
  issueAdminSession,
  resolveAdminSession,
  revokeAdminSession,
  type AdminSessionClient,
} from "../index";

type AdminUser = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
};

function createClient(options: {
  adminUser?: AdminUser | null;
  session?: { id: string; adminUserId: string; adminUser: { email: string; role: string } } | null;
} = {}): AdminSessionClient {
  const adminUser = {
    findUnique: vi.fn().mockResolvedValue(options.adminUser ?? null),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const adminSession = {
    create: vi.fn().mockResolvedValue(undefined),
    findFirst: vi.fn().mockResolvedValue(options.session ?? null),
    update: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue(undefined),
  };

  return {
    adminUser,
    adminSession,
    $transaction: vi.fn(async (operation) => operation({ adminUser, adminSession })),
  };
}

describe("admin session service", () => {
  it("authenticates credentials without exposing a password hash", async () => {
    const client = createClient({
      adminUser: { id: "admin-1", email: "admin@example.com", passwordHash: "stored-hash", role: "EDITOR" },
    });
    const comparePassword = async (password: string, passwordHash: string) =>
      password === "correct-password" && passwordHash === "stored-hash";

    await expect(authenticateAdminCredentials("admin@example.com", "correct-password", client, { comparePassword }))
      .resolves.toEqual({ adminUserId: "admin-1", email: "admin@example.com", role: "EDITOR" });
    await expect(authenticateAdminCredentials("admin@example.com", "wrong-password", client, { comparePassword }))
      .resolves.toBeNull();
  });

  it("issues and resolves active opaque sessions by their hash", async () => {
    const client = createClient({
      session: {
        id: "session-1",
        adminUserId: "admin-1",
        adminUser: { email: "admin@example.com", role: "EDITOR" },
      },
    });
    const now = new Date("2026-08-09T00:00:00.000Z");

    await expect(issueAdminSession("admin-1", 60, client, {
      createToken: () => "opaque-token",
      now: () => now,
    })).resolves.toBe("opaque-token");
    expect(client.adminSession.create).toHaveBeenCalledWith({
      data: {
        adminUserId: "admin-1",
        tokenHash: createHash("sha256").update("opaque-token").digest("hex"),
        expiresAt: new Date("2026-08-09T00:01:00.000Z"),
      },
    });

    await expect(resolveAdminSession("opaque-token", client, { now: () => now })).resolves.toEqual({
      adminUserId: "admin-1",
      email: "admin@example.com",
      role: "EDITOR",
    });
    expect(client.adminSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tokenHash: createHash("sha256").update("opaque-token").digest("hex"),
        status: "ACTIVE",
        revokedAt: null,
        expiresAt: { gt: now },
      }),
    }));
  });

  it("revokes an opaque token and revokes active sessions after a password change", async () => {
    const client = createClient({
      adminUser: { id: "admin-1", email: "admin@example.com", passwordHash: "stored-hash", role: "EDITOR" },
    });
    const now = new Date("2026-08-09T00:00:00.000Z");

    await revokeAdminSession("opaque-token", client, { now: () => now });
    expect(client.adminSession.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash("sha256").update("opaque-token").digest("hex"),
        status: "ACTIVE",
      },
      data: { status: "REVOKED", revokedAt: now },
    });

    await expect(changeAdminPassword("admin-1", "current-password", "new-password", client, {
      now: () => now,
      comparePassword: async (password, passwordHash) =>
        password === "current-password" && passwordHash === "stored-hash",
      hashPassword: async () => "new-password-hash",
    })).resolves.toBe("UPDATED");
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(client.adminUser.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { passwordHash: "new-password-hash" },
    });
    expect(client.adminSession.updateMany).toHaveBeenLastCalledWith({
      where: { adminUserId: "admin-1", status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
  });
});
