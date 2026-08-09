import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/app-error";
import {
  resolveSession,
  type AuthSessionClient,
} from "./session-service";
import {
  createAdminRequestContext,
  createUserRequestContext,
} from "./role-context";

function createClient(session: { id: string; userId: string } | null): AuthSessionClient {
  return {
    authSession: {
      findFirst: vi.fn().mockResolvedValue(session),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("resolveSession", () => {
  it("rejects a revoked or expired session", async () => {
    const client = createClient(null);

    await expect(resolveSession("revoked-token", client)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
    expect(client.authSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tokenHash: createHash("sha256").update("revoked-token").digest("hex"),
        status: "ACTIVE",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      }),
    }));
  });

  it("returns the authenticated user and records session use", async () => {
    const client = createClient({ id: "session-1", userId: "user-1" });

    await expect(resolveSession("active-token", client)).resolves.toEqual({
      sessionId: "session-1",
      userId: "user-1",
    });
    expect(client.authSession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "session-1" },
      data: { lastUsedAt: expect.any(Date) },
    }));
  });
});

describe("role context", () => {
  it("creates typed user and admin request contexts", () => {
    expect(createUserRequestContext("request-1", "user-1", "parent", {
      parentProfileId: "parent-1",
    })).toEqual({
      requestId: "request-1",
      actor: {
        kind: "user",
        userId: "user-1",
        workspace: "parent",
        parentProfileId: "parent-1",
      },
    });
    expect(createAdminRequestContext("request-2", "admin-1")).toEqual({
      requestId: "request-2",
      actor: { kind: "admin", adminUserId: "admin-1" },
    });
  });

  it("keeps AppError fields stable for handlers", () => {
    const error = new AppError("FORBIDDEN", 403, "Forbidden");

    expect(error).toMatchObject({ code: "FORBIDDEN", status: 403, message: "Forbidden" });
  });
});
