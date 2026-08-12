import { describe, expect, it, vi } from "vitest";
import { AuditService } from "./audit-service";

describe("AuditService", () => {
  it("records entity identifiers and strips sensitive values from an audit diff", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const audit = new AuditService({ auditLog: { create } });

    await audit.record({
      actorKind: "ADMIN",
      actorId: "admin-1",
      actorAdminUserId: "admin-1",
      entityType: "MODEL_CONFIG",
      entityId: "model-1",
      action: "UPDATE",
      diff: {
        enabled: true,
        apiKey: "secret",
        systemPrompt: "never retain this",
        nested: { phone: "13800138000", fileUrl: "https://cos.example/private" },
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorKind: "ADMIN",
        actorId: "admin-1",
        entityType: "MODEL_CONFIG",
        entityId: "model-1",
        action: "UPDATE",
        sanitizedDiff: { enabled: true, nested: {} },
      }),
    });
  });
});
