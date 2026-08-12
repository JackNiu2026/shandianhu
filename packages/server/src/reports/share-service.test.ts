import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ReportShareService } from "./share-service";

const token = "token-for-test";
const tokenHash = createHash("sha256").update(token).digest("hex");

describe("ReportShareService", () => {
  it("stores only a token hash and rejects a revoked share link", async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: "share-1", ...data }));
    const update = vi.fn().mockResolvedValue({ id: "share-1" });
    const database = {
      learningReport: {
        findUnique: vi.fn().mockResolvedValue({ id: "report-1", status: "READY", child: { parentProfile: { userId: "parent-1" } } }),
      },
      reportShare: {
        create,
        findUnique: vi.fn().mockImplementation(async ({ where }) => ({
          id: "share-1",
          tokenHash,
          expiresAt: new Date("2026-08-10T00:00:00.000Z"),
          revokedAt: where.id ? null : new Date(),
          learningReport: { id: "report-1", status: "READY", child: { parentProfile: { userId: "parent-1" } } },
        })),
        update,
      },
    };
    const shares = new ReportShareService(database, {
      randomToken: () => token,
      clock: () => new Date("2026-08-09T00:00:00.000Z"),
    });

    const issued = await shares.issue("report-1", "parent-1", 3600);

    expect(issued.token).toBe(token);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tokenHash, expiresAt: new Date("2026-08-09T01:00:00.000Z") }),
    }));
    expect(create.mock.calls[0][0].data.tokenHash).not.toBe(token);
    await shares.revoke("share-1", "parent-1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: new Date("2026-08-09T00:00:00.000Z") } }));
    await expect(shares.resolve(token)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("caps a share lifetime at seven days", async () => {
    const database = {
      learningReport: { findUnique: vi.fn().mockResolvedValue({ id: "report-1", status: "READY", child: { parentProfile: { userId: "parent-1" } } }) },
      reportShare: { create: vi.fn().mockResolvedValue({ id: "share-1" }), findUnique: vi.fn(), update: vi.fn() },
    };
    const shares = new ReportShareService(database, { randomToken: () => token, clock: () => new Date("2026-08-09T00:00:00.000Z") });

    await expect(shares.issue("report-1", "parent-1", 7 * 24 * 60 * 60 + 1)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("issues a five-minute download URL only for a live shared PDF", async () => {
    const signer = { signGet: vi.fn().mockResolvedValue("https://cos.example/signed") };
    const database = {
      learningReport: { findUnique: vi.fn() },
      reportShare: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          id: "share-1", tokenHash, expiresAt: new Date("2026-08-10T00:00:00.000Z"), revokedAt: null,
          learningReport: { id: "report-1", status: "READY", fileObjectId: "file-1" },
        }),
      },
      fileObject: { findUnique: vi.fn().mockResolvedValue({ id: "file-1", objectKey: "reports/file-1.pdf", status: "ACTIVE", deletedAt: null, revokedAt: null }) },
    };
    const shares = new ReportShareService(database, { randomToken: () => token, clock: () => new Date("2026-08-09T00:00:00.000Z") });

    await expect(shares.resolveDownload(token, signer)).resolves.toEqual({
      downloadUrl: "https://cos.example/signed",
      expiresInSeconds: 300,
    });
    expect(signer.signGet).toHaveBeenCalledWith({ objectKey: "reports/file-1.pdf", expiresInSeconds: 300 });
  });
});
