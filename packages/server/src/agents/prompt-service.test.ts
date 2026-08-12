import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/app-error";
import { PromptService, type PromptDatabase, type PromptVersionRecord } from "./prompt-service";

const adminCtx = { adminUserId: "admin-1", requestId: "req-1" };

function makeVersion(overrides: Partial<PromptVersionRecord> = {}): PromptVersionRecord {
  return {
    id: "version-1",
    agentId: "agent-1",
    sequence: 1,
    content: "You are a helpful math tutor.",
    checksum: "abc123",
    status: "DRAFT",
    createdById: "admin-1",
    publishedAt: null,
    supersedesId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeDatabase(overrides: Partial<PromptDatabase> = {}): PromptDatabase {
  const versions = new Map<string, PromptVersionRecord>();
  const agentExists = vi.fn().mockResolvedValue(true);
  let maxSequence = 0;

  return {
    agentPromptVersion: {
      findMany: vi.fn(async ({ where }) => {
        return [...versions.values()]
          .filter((v) => v.agentId === where.agentId)
          .sort((a, b) => b.sequence - a.sequence);
      }),
      findUnique: vi.fn(async ({ where }) => versions.get(where.id) ?? null),
      create: vi.fn(async ({ data }) => {
        const v = makeVersion({ ...data, id: `version-${versions.size + 1}`, createdAt: new Date() });
        versions.set(v.id, v);
        maxSequence = Math.max(maxSequence, v.sequence);
        return v;
      }),
      update: vi.fn(async ({ where, data }) => {
        const v = versions.get(where.id);
        if (!v) throw new Error("not found");
        const updated = { ...v, ...data };
        versions.set(where.id, updated);
        return updated;
      }),
      count: vi.fn(async ({ where }) => {
        return [...versions.values()].filter((v) => v.agentId === where.agentId).length;
      }),
      aggregate: vi.fn(async () => ({ _max: { sequence: maxSequence || null } })),
    },
    agentConfig: {
      findUnique: vi.fn(async () => ({
        id: "agent-1",
        subject: "MATH" as const,
        schoolStage: "MIDDLE" as const,
        publishedPromptVersionId: null,
      })),
      update: vi.fn(async () => undefined),
    },
    agentPromptTest: {
      create: vi.fn(async () => ({ id: "test-1" })),
    },
    $transaction: vi.fn(async (operation: (tx: never) => Promise<unknown>) => {
      const tx = {
        agentPromptVersion: {
          updateMany: vi.fn(async ({ where }: { where: { agentId: string; status: string } }) => {
            for (const [id, v] of versions.entries()) {
              if (v.agentId === where.agentId && v.status === where.status) {
                versions.set(id, { ...v, status: "SUPERSEDED" as const });
              }
            }
            return { count: 0 };
          }),
          update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const v = versions.get(where.id);
            if (!v) throw new Error("not found");
            const updated = { ...v, ...data } as PromptVersionRecord;
            versions.set(where.id, updated);
            return updated;
          }),
        },
        agentConfig: {
          update: vi.fn(async () => undefined),
        },
      } as unknown as never;
      return operation(tx);
    }),
    ...overrides,
  };
}

describe("PromptService", () => {
  it("creates a draft with normalized content and SHA-256 checksum", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);

    const draft = await prompts.createDraft("agent-1", "You are a tutor.\r\n\r\nHelp students.", adminCtx);

    expect(draft.status).toBe("DRAFT");
    expect(draft.content).toBe("You are a tutor.\n\nHelp students.");
    expect(draft.checksum).toHaveLength(64); // SHA-256 hex
    expect(draft.sequence).toBe(1);
    expect(db.agentPromptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: "agent-1",
          status: "DRAFT",
          createdById: "admin-1",
        }),
      }),
    );
  });

  it("increments sequence for each new draft", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);

    const first = await prompts.createDraft("agent-1", "content-1", adminCtx);
    const second = await prompts.createDraft("agent-1", "content-2", adminCtx);

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
  });

  it("rejects empty content", async () => {
    const prompts = new PromptService(makeDatabase());
    await expect(prompts.createDraft("agent-1", "", adminCtx)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects content exceeding 200 KiB", async () => {
    const prompts = new PromptService(makeDatabase());
    const oversized = "x".repeat(200 * 1024 + 1);
    await expect(prompts.createDraft("agent-1", oversized, adminCtx)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("updates content of a DRAFT version", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);
    const draft = await prompts.createDraft("agent-1", "initial", adminCtx);

    const updated = await prompts.updateContent(draft.id, "updated content", adminCtx);

    expect(updated.content).toBe("updated content");
    expect(updated.checksum).not.toBe(draft.checksum);
  });

  it("publishes only a successfully tested immutable draft", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);

    const draft = await prompts.createDraft("agent-1", "test prompt", adminCtx);

    // Cannot publish untested draft
    await expect(prompts.publish("agent-1", draft.id, adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
    });

    // Record successful test
    const tested = await prompts.recordSuccessfulTest(draft.id, "model-call-1", adminCtx);
    expect(tested.status).toBe("TESTED");

    // Publish
    const published = await prompts.publish("agent-1", draft.id, adminCtx);
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeInstanceOf(Date);

    // Cannot modify published version
    await expect(prompts.updateContent(published.id, "changed", adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
    });
  });

  it("rejects publishing a version from a different agent", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);
    const draft = await prompts.createDraft("agent-1", "test", adminCtx);
    await prompts.recordSuccessfulTest(draft.id, "call-1", adminCtx);

    await expect(prompts.publish("agent-2", draft.id, adminCtx)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("supersedes the old published version when publishing a new one", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);

    const v1 = await prompts.createDraft("agent-1", "v1 content", adminCtx);
    await prompts.recordSuccessfulTest(v1.id, "call-1", adminCtx);
    await prompts.publish("agent-1", v1.id, adminCtx);

    const v2 = await prompts.createDraft("agent-1", "v2 content", adminCtx);
    await prompts.recordSuccessfulTest(v2.id, "call-2", adminCtx);
    const publishedV2 = await prompts.publish("agent-1", v2.id, adminCtx);

    expect(publishedV2.status).toBe("PUBLISHED");

    // v1 should now be SUPERSEDED
    const v1After = await db.agentPromptVersion.findUnique({ where: { id: v1.id } });
    expect(v1After?.status).toBe("SUPERSEDED");
  });

  it("rolls back by creating a new draft from historical content", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);

    const v1 = await prompts.createDraft("agent-1", "original content", adminCtx);
    await prompts.recordSuccessfulTest(v1.id, "call-1", adminCtx);
    await prompts.publish("agent-1", v1.id, adminCtx);

    const v2 = await prompts.createDraft("agent-1", "new content", adminCtx);
    await prompts.recordSuccessfulTest(v2.id, "call-2", adminCtx);
    await prompts.publish("agent-1", v2.id, adminCtx);

    // Rollback to v1
    const rollback = await prompts.rollback("agent-1", v1.id, adminCtx);
    expect(rollback.status).toBe("DRAFT");
    expect(rollback.content).toBe("original content");
    expect(rollback.sequence).toBe(3); // new sequence
  });

  it("rejects rollback to a DRAFT version", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);
    const draft = await prompts.createDraft("agent-1", "draft", adminCtx);

    await expect(prompts.rollback("agent-1", draft.id, adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
    });
  });

  it("records failed tests and keeps the version as DRAFT", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);
    const draft = await prompts.createDraft("agent-1", "test", adminCtx);

    const result = await prompts.recordFailedTest(draft.id, "call-1", adminCtx, "model error output");

    expect(result.status).toBe("DRAFT");
    expect(db.agentPromptTest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passed: false,
          outputPreview: "model error output",
        }),
      }),
    );
  });

  it("rejects testing a PUBLISHED version", async () => {
    const db = makeDatabase();
    const prompts = new PromptService(db);
    const draft = await prompts.createDraft("agent-1", "test", adminCtx);
    await prompts.recordSuccessfulTest(draft.id, "call-1", adminCtx);
    await prompts.publish("agent-1", draft.id, adminCtx);

    await expect(prompts.recordSuccessfulTest(draft.id, "call-2", adminCtx)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
    });
  });

  it("throws NOT_FOUND for unknown agent", async () => {
    const db = makeDatabase({
      agentConfig: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(),
      },
    });
    const prompts = new PromptService(db);

    await expect(prompts.createDraft("unknown", "content", adminCtx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws NOT_FOUND for unknown prompt version", async () => {
    const prompts = new PromptService(makeDatabase());
    await expect(prompts.updateContent("unknown", "content", adminCtx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
