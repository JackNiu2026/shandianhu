import { describe, expect, it } from "vitest";
import { ConversationService, type ConversationDatabase, type ConversationRecord } from "./conversation-service";
import { AgentService, type AgentWithPrompt, type AgentDatabase, type AgentConfigRecord } from "../agents/agent-service";

// ─── Mocks ──────────────────────────────────────────────────

type AgentRow = AgentConfigRecord & {
  publishedPromptVersion: { id: string; sequence: number; content: string; checksum: string } | null;
};

const BASE_AGENT_ROWS: AgentRow[] = [
  {
    id: "math-mid",
    subject: "MATH",
    schoolStage: "MIDDLE",
    status: "ENABLED",
    publishedPromptVersionId: "pp-1",
    primaryModelConfigId: "mc-1",
    fallbackModelConfigId: "mc-2",
    temperature: 0.5,
    maxOutputTokens: 2048,
    updatedByAdminId: null,
    publishedPromptVersion: { id: "pp-1", sequence: 3, content: "math prompt v3", checksum: "xxx" },
  },
  {
    id: "math-primary",
    subject: "MATH",
    schoolStage: "PRIMARY",
    status: "ENABLED",
    publishedPromptVersionId: null,
    primaryModelConfigId: "mc-1",
    fallbackModelConfigId: null,
    temperature: 0.5,
    maxOutputTokens: 2048,
    updatedByAdminId: null,
    publishedPromptVersion: null,
  },
  {
    id: "math-mid-disabled",
    subject: "MATH",
    schoolStage: "MIDDLE",
    status: "DISABLED",
    publishedPromptVersionId: "pp-2",
    primaryModelConfigId: "mc-1",
    fallbackModelConfigId: null,
    temperature: 0.5,
    maxOutputTokens: 2048,
    updatedByAdminId: null,
    publishedPromptVersion: { id: "pp-2", sequence: 1, content: "draft", checksum: "yyy" },
  },
];

class MemoryAgentDb implements AgentDatabase {
  constructor(public rows: AgentRow[] = [...BASE_AGENT_ROWS]) {}
  agentConfig = {
    findUnique: async (args: {
      where: { id?: string; subject_schoolStage?: { subject: string; schoolStage: string } };
    }) => {
      if (args.where.id) return this.rows.find((r) => r.id === args.where.id) ?? null;
      const { subject, schoolStage } = args.where.subject_schoolStage ?? {};
      return this.rows.find((r) => r.subject === subject && r.schoolStage === schoolStage) ?? null;
    },
    findMany: async () => this.rows,
    upsert: async (args: { create: any }) => ({ id: "new", ...args.create } as AgentConfigRecord),
    update: async (args: { where: { id: string }; data: any }) => {
      const row = this.rows.find((r) => r.id === args.where.id)!;
      const next = { ...row, ...args.data };
      this.rows = this.rows.map((r) => r.id === next.id ? next : r);
      return next;
    },
  };
}

type ConversationRow = ConversationRecord & {
  agent: { subject: any; schoolStage: any; id: string };
  promptVersion: { agentId: string; id: string; sequence: number; content: string };
};

class MemoryConvDb implements ConversationDatabase {
  public conversations: ConversationRow[] = [];
  public nextId = 1;

  public children: { parentId: string; childId: string; grade: string | null }[] = [
    { parentId: "p-1", childId: "c-child-7", grade: "7" }, // MIDDLE
    { parentId: "p-1", childId: "c-child-3", grade: "3" }, // PRIMARY
    { parentId: "p-2", childId: "c-other", grade: "8" },
  ];

  tutorConversation = {
    findUnique: async (args: { where: { id: string } }) => {
      return this.conversations.find((c) => c.id === args.where.id) ?? null;
    },
    findMany: async (args: { where?: any; take?: number }) => {
      const rows = this.conversations.slice();
      const filtered = args?.where?.childId
        ? rows.filter((r) => r.childId === args.where.childId)
        : rows;
      filtered.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
      return args?.take ? filtered.slice(0, args.take) : filtered;
    },
    create: async (args: { data: any }) => {
      const timestamp = new Date(Date.now() + this.nextId);
      const row: ConversationRow = {
        id: `conv-${this.nextId++}`,
        childId: args.data.childId,
        agentId: args.data.agentId,
        promptVersionId: args.data.promptVersionId,
        status: "ACTIVE",
        title: args.data.title ?? null,
        lastActivityAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        agent: { id: args.data.agentId, subject: "MATH", schoolStage: "MIDDLE" },
        promptVersion: { agentId: args.data.agentId, id: args.data.promptVersionId, sequence: 3, content: "v3" },
      };
      this.conversations.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const row = this.conversations.find((c) => c.id === args.where.id)!;
      const next = { ...row, ...args.data, updatedAt: new Date() };
      this.conversations = this.conversations.map((c) => c.id === next.id ? next : c);
      return next;
    },
  };

  parentProfile = {
    findUnique: async (args: { where: { id: string }; include: { children: any } }) => {
      const matches = this.children.filter((c) => c.parentId === args.where.id);
      const filter = args.include?.children?.where?.id;
      const expectedChildId = typeof filter === "string" ? filter : filter?.equals;
      const filtered = expectedChildId
        ? matches.filter((c) => c.childId === expectedChildId)
        : matches;
      return {
        id: args.where.id,
        children: filtered.map((c) => ({ id: c.childId, grade: c.grade })),
      };
    },
  };

  child = {
    findUnique: async (args: { where: { id: string } }) => {
      const c = this.children.find((x) => x.childId === args.where.id);
      return c ? { id: c.childId, grade: c.grade } : null;
    },
  };
}

// ─── 测试 ──────────────────────────────────────────────────

describe("ConversationService.create", () => {
  it("rejects a conversation for a child outside the parent family", async () => {
    const db = new MemoryConvDb();
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(new MemoryAgentDb() as unknown as AgentDatabase));
    await expect(
      service.create({ parentProfileId: "p-1", childId: "c-other", subject: "MATH" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a conversation pinned to the published prompt version at creation time", async () => {
    const db = new MemoryConvDb();
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(new MemoryAgentDb() as unknown as AgentDatabase));
    const conv = await service.create({
      parentProfileId: "p-1", childId: "c-child-7", subject: "MATH",
    });
    expect(conv.agentId).toBe("math-mid");
    expect(conv.promptVersionId).toBe("pp-1");
    expect(conv.promptVersionSequence).toBe(3);
  });

  it("rejects when the resolved agent has no published prompt", async () => {
    const db = new MemoryConvDb();
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(new MemoryAgentDb() as unknown as AgentDatabase));
    await expect(
      // PRIMARY 年级的 MATH agent 没有已发布 prompt
      service.create({ parentProfileId: "p-1", childId: "c-child-3", subject: "MATH" }),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
  });

  it("rejects when child grade is missing", async () => {
    const db = new MemoryConvDb();
    db.children.push({ parentId: "p-1", childId: "c-nograde", grade: null });
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(new MemoryAgentDb() as unknown as AgentDatabase));
    await expect(
      service.create({ parentProfileId: "p-1", childId: "c-nograde", subject: "MATH" }),
    ).rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
  });

  it("rejects when the resolved agent is disabled", async () => {
    const db = new MemoryConvDb();
    const agentDb = new MemoryAgentDb([BASE_AGENT_ROWS[2]]); // disabled math-mid
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(agentDb as unknown as AgentDatabase));
    // 让解析到 math-mid-disabled：给 children["c-child-7"] 用的 stage=MIDDLE，subject=MATH
    // 但 MATH/MIDDLE 解析时需要 agentDb 中 status=ENABLED 的那条，否则 403/409
    await expect(
      service.create({ parentProfileId: "p-1", childId: "c-child-7", subject: "MATH" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("ConversationService.listByChild", () => {
  it("scopes listing to the child and orders by last activity", async () => {
    const db = new MemoryConvDb();
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(new MemoryAgentDb() as unknown as AgentDatabase));
    await service.create({ parentProfileId: "p-1", childId: "c-child-7", subject: "MATH", title: "first" });
    await service.create({ parentProfileId: "p-1", childId: "c-child-7", subject: "MATH", title: "second" });
    const list = await service.listByChild("p-1", "c-child-7");
    expect(list.map((c) => c.title)).toEqual(["second", "first"]);
  });

  it("refuses to list a sibling across families", async () => {
    const db = new MemoryConvDb();
    const service = new ConversationService(db as unknown as ConversationDatabase, new AgentService(new MemoryAgentDb() as unknown as AgentDatabase));
    await expect(service.listByChild("p-2", "c-child-7")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
