# 闪电虎 V2.2 智学系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V2.1 学情底座上交付五科学科智能体、可发布提示词、文字/图片流式辅导、多会话历史、学习摘要回流和家庭共享积分账本。

**Architecture:** 智能体按“学科 + 学段”绑定已发布提示词与主备模型，实时对话由 Next.js 流式 Route Handler 直接调用 `server`，不进入长任务队列。会话结束后的摘要、学习证据和画像重算由 Worker 异步执行；用户积分账本与平台模型成本账本通过 callId 关联但独立核算。

**Tech Stack:** V2.1 技术栈、Web Streams API、UTF-8 NDJSON、Taro `RequestTask.onChunkReceived`、Zod、Prisma 事务

---

## 文件结构

- `packages/server/src/agents/*`：智能体、提示词版本、发布和回滚规则。
- `packages/server/src/tutoring/*`：会话、消息、上下文、模型路由、停止与恢复。
- `packages/server/src/quota/*`：家庭积分账户、预占、结算、释放和人工调整。
- `packages/server/src/streaming/*`：NDJSON 帧编码，序号和终止语义。
- `packages/worker/src/processors/tutoring-summary.ts`：结构化辅导摘要与画像证据。
- `packages/admin/src/app/api/v2/tutor/*`：会话普通 API 与流式入口。
- `packages/admin/src/app/(dashboard)/agents/*`：智能体配置、提示词测试/发布/回滚。
- `packages/mobile/src/pages/smart/*`：当前孩子学科工作台与最近学习。
- `packages/mobile/src/pages/tutor-chat/*`：文字/图片会话和流式恢复。
- `packages/shared/api/tutoring.ts`：跨端 DTO 和 NDJSON 事件类型。

## Task 1：扩展 V2.2 schema 与契约

**Files:**
- Modify: `packages/server/prisma/schema.prisma`
- Create: `packages/server/prisma/migrations/20260809120000_v2_2_tutoring/migration.sql`
- Create: `packages/shared/api/tutoring.ts`
- Modify: `packages/shared/api/index.ts`
- Test: `packages/server/src/__tests__/v2-2-schema.contract.test.ts`

- [ ] **Step 1: 写 schema 失败契约**

```ts
it("contains tutoring configuration, conversation and quota ledgers", () => {
  const names = Prisma.dmmf.datamodel.models.map((model) => model.name);
  expect(names).toEqual(expect.arrayContaining([
    "AgentConfig", "AgentPromptVersion", "AgentPromptTest", "TutorConversation",
    "TutorMessage", "MessageAttachment", "TutoringSummary", "TutorQuotaAccount",
    "TutorQuotaLedger"
  ]));
});
```

- [ ] **Step 2: 运行确认 V2.1 schema 缺少实体**

Run: `pnpm --filter @lightning-tiger/server test -- v2-2-schema.contract`

Expected: FAIL。

- [ ] **Step 3: 添加关系模型和并发约束**

```prisma
model AgentConfig {
  id                       String   @id @default(cuid())
  subject                  Subject
  schoolStage              SchoolStage
  status                   AgentStatus @default(DISABLED)
  publishedPromptVersionId String?
  primaryModelConfigId     String?
  fallbackModelConfigId    String?
  temperature              Float    @default(0.4)
  maxOutputTokens          Int      @default(2048)
  prompts                  AgentPromptVersion[]
  conversations            TutorConversation[]
  @@unique([subject, schoolStage])
}

model AgentPromptVersion {
  id          String   @id @default(cuid())
  agentId     String
  sequence    Int
  content     String
  checksum    String
  status      PromptStatus @default(DRAFT)
  createdById String
  publishedAt DateTime?
  supersedesId String?
  agent       AgentConfig @relation(fields: [agentId], references: [id])
  @@unique([agentId, sequence])
}

model TutorConversation {
  id              String   @id @default(cuid())
  childId         String
  agentId         String
  promptVersionId String
  status          ConversationStatus @default(ACTIVE)
  title           String?
  lastActivityAt  DateTime @default(now())
  messages        TutorMessage[]
  summaries       TutoringSummary[]
  @@index([childId, lastActivityAt])
}

model TutorMessage {
  id             String   @id @default(cuid())
  conversationId String
  clientMessageId String
  role           TutorMessageRole
  content        String
  generationStatus MessageGenerationStatus
  modelCallId    String?
  sequence       Int
  createdAt      DateTime @default(now())
  @@unique([conversationId, clientMessageId])
  @@unique([conversationId, sequence])
}

model TutorQuotaAccount {
  id              String @id @default(cuid())
  parentProfileId String @unique
  availablePoints BigInt @default(0)
  reservedPoints  BigInt @default(0)
  version         Int    @default(0)
  ledgers         TutorQuotaLedger[]
}

model TutorQuotaLedger {
  id             String @id @default(cuid())
  accountId      String
  operationKey   String @unique
  childId        String?
  modelCallId    String?
  kind           QuotaLedgerKind
  points         BigInt
  balanceAfter   BigInt
  reservationId  String?
  createdAt      DateTime @default(now())
  @@index([accountId, createdAt])
}
```

消息附件只允许引用 V2.1 `FileObject`；`TutoringSummary` 保存结构化 JSON、摘要版本、modelCallId、evidenceId 和不可变时间戳。

- [ ] **Step 4: 定义跨端流事件**

```ts
export type TutorStreamEvent =
  | { type: "start"; sequence: number; data: { assistantMessageId: string; model: "primary" | "fallback" } }
  | { type: "delta"; sequence: number; data: { text: string } }
  | { type: "usage"; sequence: number; data: { chargedPoints: number } }
  | { type: "done"; sequence: number; data: { finishReason: "stop" | "length" | "cancelled" } }
  | { type: "error"; sequence: number; data: { code: ApiErrorCode; retryable: boolean } };
```

- [ ] **Step 5: 验证 migration 并提交**

Run: `pnpm --filter @lightning-tiger/server exec prisma migrate deploy && pnpm --filter @lightning-tiger/server prisma:generate && pnpm --filter @lightning-tiger/server test -- v2-2-schema.contract`

Expected: PASS。

```bash
git add packages/server/prisma packages/shared/api
git commit -m "feat(db): add v2.2 tutoring schema"
```

## Task 2：创建 13 个学科/学段智能体槽位

**Files:**
- Create: `packages/server/src/agents/catalog.ts`
- Create: `packages/server/src/agents/agent-service.ts`
- Modify: `packages/server/prisma/seed.ts`
- Test: `packages/server/src/agents/catalog.test.ts`

- [ ] **Step 1: 写完整目录失败测试**

```ts
it("defines exactly the approved 13 subject-stage agents", () => {
  expect(AGENT_CATALOG).toEqual([
    ["CHINESE", "PRIMARY"], ["CHINESE", "MIDDLE"], ["CHINESE", "HIGH"],
    ["MATH", "PRIMARY"], ["MATH", "MIDDLE"], ["MATH", "HIGH"],
    ["ENGLISH", "PRIMARY"], ["ENGLISH", "MIDDLE"], ["ENGLISH", "HIGH"],
    ["PHYSICS", "MIDDLE"], ["PHYSICS", "HIGH"],
    ["CHEMISTRY", "MIDDLE"], ["CHEMISTRY", "HIGH"]
  ]);
});
```

- [ ] **Step 2: 实现目录和年级映射**

`stageForGrade` 将 1–6 年级映射 PRIMARY、7–9 映射 MIDDLE、10–12 映射 HIGH；物理和化学在小学不返回智能体。Seed 只创建 `DISABLED` 配置槽，不填假提示词、不自动启用。

- [ ] **Step 3: 运行测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- catalog`

Expected: PASS。

```bash
git add packages/server/src/agents packages/server/prisma/seed.ts
git commit -m "feat(agents): seed approved subject-stage catalog"
```

## Task 3：提示词上传、草稿、测试、发布和回滚

**Files:**
- Create: `packages/server/src/agents/prompt-service.ts`
- Create: `packages/server/src/agents/prompt-test-service.ts`
- Create: `packages/admin/src/app/api/v2/admin/agents/[id]/prompts/route.ts`
- Create: `packages/admin/src/app/api/v2/admin/agents/[id]/prompts/test/route.ts`
- Create: `packages/admin/src/app/api/v2/admin/agents/[id]/prompts/publish/route.ts`
- Create: `packages/admin/src/app/api/v2/admin/agents/[id]/prompts/rollback/route.ts`
- Test: `packages/server/src/agents/prompt-service.test.ts`

- [ ] **Step 1: 写发布状态机失败测试**

```ts
it("publishes only a successfully tested immutable draft", async () => {
  await expect(prompts.publish(agent.id, untested.id, adminCtx))
    .rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
  await prompts.recordSuccessfulTest(untested.id, modelCall.id, adminCtx);
  const published = await prompts.publish(agent.id, untested.id, adminCtx);
  expect(published.status).toBe("PUBLISHED");
  await expect(prompts.updateContent(published.id, "changed", adminCtx))
    .rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
});
```

- [ ] **Step 2: 实现内容入口和版本规则**

后台接受 UTF-8 `.txt`/`.md` 或在线编辑，最大 200 KiB；保存时规范换行、计算 SHA-256、创建新的 DRAFT sequence，不原地修改历史。测试调用 V2.1 模型网关并写 `AgentPromptTest`、`ModelUsageLedger` 和 `AuditLog`。

- [ ] **Step 3: 实现原子发布与回滚**

发布事务将旧版本设为 SUPERSEDED、新版本设为 PUBLISHED，并更新 `AgentConfig.publishedPromptVersionId`。回滚不是修改旧行，而是复制目标历史内容为新 sequence，完成测试后发布；每次操作记录操作者、from/to 版本和 checksum。

- [ ] **Step 4: 运行状态机测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- prompt-service`

Expected: PASS，覆盖并发发布只能一个成功。

```bash
git add packages/server/src/agents packages/admin/src/app/api/v2/admin/agents
git commit -m "feat(agents): add tested prompt publishing and rollback"
```

## Task 4：智能体模型路由和固定上下文顺序

**Files:**
- Create: `packages/server/src/tutoring/context-builder.ts`
- Create: `packages/server/src/tutoring/model-router.ts`
- Test: `packages/server/src/tutoring/context-builder.test.ts`
- Test: `packages/server/src/tutoring/model-router.test.ts`

- [ ] **Step 1: 写上下文顺序和主备切换失败测试**

```ts
it("builds context in the approved order", async () => {
  expect((await buildContext(input)).map((part) => part.kind)).toEqual([
    "PLATFORM_SAFETY", "PUBLISHED_PROMPT", "CHILD_PROFILE", "CURRENT_TASK",
    "RELEVANT_HISTORY", "CURRENT_CONVERSATION"
  ]);
});

it("falls back only before a useful primary delta", async () => {
  primary.failBeforeFirstDelta();
  expect(await router.open(request)).toMatchObject({ route: "fallback" });
  primary.emit("已生成").thenFail();
  await expect(router.open(request)).rejects.toMatchObject({ retryWithoutFallback: true });
});
```

- [ ] **Step 2: 实现模型路由**

主模型必须启用且满足图片能力；请求超时、连接失败、429/5xx 且未输出有效 delta 时切备用模型。已输出 delta 后禁止切换，避免拼接两个模型答案。两个模型都失败则返回可重试错误，不创建伪造文本。

- [ ] **Step 3: 实现上下文裁剪**

平台安全边界是代码维护的最小安全规则；教学策略只来自已发布提示词。画像只注入当前孩子、当前学科必要摘要；历史只取最近相关 `TutoringSummary`，完整消息不无限注入。客户端永远收不到完整系统上下文。

- [ ] **Step 4: 运行路由测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- context-builder model-router`

Expected: PASS。

```bash
git add packages/server/src/tutoring
git commit -m "feat(tutoring): route models with bounded learning context"
```

## Task 5：家庭共享积分的预占、结算和释放

**Files:**
- Create: `packages/server/src/quota/points.ts`
- Create: `packages/server/src/quota/quota-service.ts`
- Create: `packages/admin/src/app/api/v2/admin/families/[id]/quota/route.ts`
- Test: `packages/server/src/quota/points.test.ts`
- Test: `packages/server/src/quota/quota-service.test.ts`

- [ ] **Step 1: 写积分换算与并发失败测试**

```ts
it("converts usage to platform points", () => {
  expect(calculatePoints({ inputTokens: 1000, outputTokens: 500, images: 2 }, {
    inputPer1k: 2, outputPer1k: 6, perImage: 10, perRequest: 1
  })).toBe(26);
});

it("allows only one reservation when concurrent requests exhaust balance", async () => {
  const results = await Promise.allSettled([
    quota.reserve(account.id, childA.id, "op-a", 80),
    quota.reserve(account.id, childB.id, "op-b", 80)
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
```

- [ ] **Step 2: 实现双账本而非余额直接扣减**

`reserve` 在 Serializable 事务中锁账户，用唯一 operationKey 写 RESERVE 流水并移动 available->reserved；`settle` 以实际用量写 SETTLE 并释放差额；失败/取消写 RELEASE。重复 operationKey 返回原结果。每笔实际使用保存 childId 和 modelCallId，模型成本仍只在 `ModelUsageLedger`。

- [ ] **Step 3: 实现后台人工调整**

管理员输入正负积分与必填原因，写 ADJUSTMENT 流水和 `AuditLog`。不提供充值、支付、会员或购买 API/页面。

- [ ] **Step 4: 运行账本测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- points quota-service`

Expected: PASS，覆盖余额不足、超预占实际消耗封顶、失败释放和两个孩子共享账户。

```bash
git add packages/server/src/quota packages/admin/src/app/api/v2/admin/families
git commit -m "feat(quota): add family tutoring point ledger"
```

## Task 6：会话、消息、图片和幂等生命周期

**Files:**
- Create: `packages/server/src/tutoring/conversation-service.ts`
- Create: `packages/server/src/tutoring/message-service.ts`
- Create: `packages/admin/src/app/api/v2/tutor/conversations/route.ts`
- Create: `packages/admin/src/app/api/v2/tutor/conversations/[id]/route.ts`
- Create: `packages/admin/src/app/api/v2/tutor/conversations/[id]/messages/route.ts`
- Test: `packages/server/src/tutoring/conversation-service.test.ts`

- [ ] **Step 1: 写孩子、智能体和重复消息失败测试**

```ts
it("rejects a conversation for a child outside the parent family", async () => {
  await expect(service.create(parentCtx, otherChild.id, "MATH"))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("deduplicates a retried client message", async () => {
  const a = await messages.accept(conversation.id, "client-1", input);
  const b = await messages.accept(conversation.id, "client-1", input);
  expect(b.id).toBe(a.id);
});
```

- [ ] **Step 2: 实现会话规则**

创建会话时按孩子年级解析 agent，要求 ENABLED、已发布 prompt、有效主模型，并固化 agentId/promptVersionId。继续历史会话沿用其固化版本；用户主动新建才使用新发布版本。每个孩子每学科可有多会话。

- [ ] **Step 3: 实现图片附件规则**

一条用户消息允许 0–4 个图片附件；必须是该 child 的 `TUTOR_INPUT` 文件且模型支持视觉。保存附件只引用 FileObject，不保存临时签名 URL。消息删除按 V2.1 隐私链路撤销其摘要证据并重算画像。

- [ ] **Step 4: 运行会话测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- conversation-service`

Expected: PASS。

```bash
git add packages/server/src/tutoring packages/admin/src/app/api/v2/tutor/conversations
git commit -m "feat(tutoring): add versioned multimodal conversations"
```

## Task 7：UTF-8 NDJSON 流式协议和停止生成

**Files:**
- Create: `packages/server/src/streaming/ndjson.ts`
- Create: `packages/server/src/tutoring/stream-service.ts`
- Create: `packages/admin/src/app/api/v2/tutor/conversations/[id]/stream/route.ts`
- Create: `packages/admin/src/app/api/v2/tutor/generations/[id]/cancel/route.ts`
- Test: `packages/server/src/streaming/ndjson.test.ts`
- Test: `packages/admin/src/__tests__/tutor-stream.route.test.ts`

- [ ] **Step 1: 写分帧、中文拆字节和序号失败测试**

```ts
it("encodes one JSON object per UTF-8 line with monotonic sequence", () => {
  const bytes = encodeEvents([
    { type: "delta", sequence: 1, data: { text: "数" } },
    { type: "delta", sequence: 2, data: { text: "学" } }
  ]);
  expect(new TextDecoder().decode(bytes)).toBe(
    '{"type":"delta","sequence":1,"data":{"text":"数"}}\n' +
    '{"type":"delta","sequence":2,"data":{"text":"学"}}\n'
  );
});
```

- [ ] **Step 2: 实现流式事务边界**

开始前创建用户消息、assistant 空消息、积分预占和 generation 记录；每个 delta 追加内存缓冲并周期性持久化。正常结束保存 COMPLETE、实际 usage、积分结算；用户停止保存 PARTIAL/cancelled 并释放差额；网络中断保存 INTERRUPTED；模型错误保存 FAILED 并释放未用积分。

- [ ] **Step 3: 实现一次性降级响应**

当运行环境不支持分块传输时，同一路由可返回完整 NDJSON：start、一个 delta、usage、done，客户端仍走同一解析器。未知网络状态通过 generation 查询恢复，客户端不得自动重新调用模型。

- [ ] **Step 4: 运行流式测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- ndjson && pnpm --filter admin test -- tutor-stream`

Expected: PASS，覆盖取消、断流、主备、额度不足和重复 clientMessageId。

```bash
git add packages/server/src/streaming packages/server/src/tutoring/stream-service.ts packages/admin/src/app/api/v2/tutor
git commit -m "feat(streaming): deliver recoverable NDJSON tutor responses"
```

## Task 8：小程序增量解码与会话页

**Files:**
- Create: `packages/mobile/src/services/ndjson.ts`
- Create: `packages/mobile/src/services/tutoring.ts`
- Create: `packages/mobile/src/pages/tutor-chat/index.tsx`
- Create: `packages/mobile/src/pages/tutor-chat/index.scss`
- Modify: `packages/mobile/src/app.config.ts`
- Test: `packages/mobile/src/services/ndjson.test.ts`

- [ ] **Step 1: 写任意网络分块解析失败测试**

```ts
it("buffers split multibyte characters and multiple lines", () => {
  const parser = createNdjsonParser<TutorStreamEvent>();
  const bytes = new TextEncoder().encode(
    '{"type":"delta","sequence":1,"data":{"text":"数学"}}\n' +
    '{"type":"done","sequence":2,"data":{"finishReason":"stop"}}\n'
  );
  expect([...parser.push(bytes.slice(0, 17)), ...parser.push(bytes.slice(17))].map((e) => e.type))
    .toEqual(["delta", "done"]);
});
```

- [ ] **Step 2: 实现 Taro 分块请求适配器**

使用 `Taro.request({ enableChunked: true })` 获取 RequestTask，`onChunkReceived` 将 ArrayBuffer 交给持久 `TextDecoder`，按换行解析。严格校验 sequence 单调；重复帧忽略，跳号时查询 generation 状态；离开页面取消监听但不重复请求。

- [ ] **Step 3: 实现完整会话交互**

输入栏支持文字、最多 4 图、发送和停止；空消息禁止发送。页面固定消息区域尺寸，增量文本不挤压工具栏。展示发送中、生成中、已中断、失败可重试和已停止状态；重试创建新的 clientMessageId，只在服务端明确 FAILED 且未收费后可用。

- [ ] **Step 4: 运行解析测试与小程序构建**

Run: `pnpm --filter mobile test -- ndjson && pnpm --filter mobile typecheck && pnpm --filter mobile build:weapp`

Expected: PASS。

- [ ] **Step 5: 提交会话页**

```bash
git add packages/mobile/src/services packages/mobile/src/pages/tutor-chat packages/mobile/src/app.config.ts
git commit -m "feat(mobile): add chunked tutor conversation experience"
```

## Task 9：多会话历史与智学首页

**Files:**
- Modify: `packages/mobile/src/pages/smart/index.tsx`
- Modify: `packages/mobile/src/pages/smart/index.scss`
- Create: `packages/mobile/src/pages/tutor-history/index.tsx`
- Create: `packages/mobile/src/pages/tutor-history/index.scss`
- Create: `packages/admin/src/app/api/v2/tutor/dashboard/route.ts`
- Test: `packages/server/src/tutoring/dashboard-service.test.ts`

- [ ] **Step 1: 写当前学段过滤与排序失败测试**

```ts
it("returns applicable agents and recent conversations for the active child", async () => {
  const result = await dashboard.load(parentCtx, child.id);
  expect(result.agents.every((agent) => agent.schoolStage === "MIDDLE")).toBe(true);
  expect(result.recentConversations.map((item) => item.lastActivityAt))
    .toEqual([...result.recentConversations.map((item) => item.lastActivityAt)].sort().reverse());
});
```

- [ ] **Step 2: 实现智学首页**

展示当前孩子简短学习状态、适用且已启用的科目智能体、继续最近辅导、新建辅导、近期摘要和剩余家庭积分。页面不提供孩子选择控件；无 activeChild 跳“我的”。

- [ ] **Step 3: 实现历史列表**

按学科筛选、按 lastActivityAt 倒序分页，显示标题、最后消息摘要、生成状态和时间；完整会话按需读取，不一次加载所有消息。

- [ ] **Step 4: 构建并提交**

Run: `pnpm --filter @lightning-tiger/server test -- dashboard-service && pnpm --filter mobile build:weapp`

Expected: PASS。

```bash
git add packages/mobile/src/pages/smart packages/mobile/src/pages/tutor-history packages/admin/src/app/api/v2/tutor/dashboard packages/server/src/tutoring
git commit -m "feat(smart): add subject workspace and conversation history"
```

## Task 10：结构化辅导摘要和画像双向回流

**Files:**
- Create: `packages/server/src/tutoring/summary-schema.ts`
- Create: `packages/server/src/tutoring/summary-service.ts`
- Create: `packages/worker/src/processors/tutoring-summary.ts`
- Modify: `packages/worker/src/worker.ts`
- Test: `packages/worker/src/processors/tutoring-summary.test.ts`

- [ ] **Step 1: 写闲置触发、唯一证据和删除撤销失败测试**

```ts
it("creates one evidence record per summary version", async () => {
  await processor.run({ conversationId: conversation.id });
  await processor.run({ conversationId: conversation.id });
  expect(await db.learningEvidence.count({ where: { sourceType: "AI_TUTOR_SUMMARY" } })).toBe(1);
});
```

- [ ] **Step 2: 定义摘要 schema**

```ts
export const tutoringSummarySchema = z.object({
  knowledgePoints: z.array(z.object({ name: z.string(), performance: z.enum(["STRONG", "MIXED", "WEAK"]) })),
  difficulties: z.array(z.string()),
  demonstratedSkills: z.array(z.string()),
  nextSuggestions: z.array(z.string()),
  evidenceMessageIds: z.array(z.string()).min(1)
});
```

- [ ] **Step 3: 实现异步触发**

用户结束会话或 30 分钟闲置后创建 `TUTORING_SUMMARY` job。Worker 只读取已完成/部分完成且未删除消息，schema 校验后保存 summary、写唯一 evidence，随后依次投递 PROFILE_REBUILD 和 REPORT_BUILD。失败只记录任务与模型成本，不写证据。

- [ ] **Step 4: 运行 Worker 测试并提交**

Run: `pnpm --filter @lightning-tiger/worker test -- tutoring-summary`

Expected: PASS。

```bash
git add packages/server/src/tutoring packages/worker/src
git commit -m "feat(profile): feed tutoring summaries into learning evidence"
```

## Task 11：智能体运营后台和安全审计

**Files:**
- Modify: `packages/admin/src/app/(dashboard)/agents/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/agents/[id]/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/agents/[id]/prompt-editor.tsx`
- Create: `packages/admin/src/app/(dashboard)/agents/models/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/agents/usage/page.tsx`
- Test: `packages/admin/src/__tests__/agent-admin.test.tsx`

- [ ] **Step 1: 写后台功能和密钥不可读失败测试**

```ts
it("never renders a stored model key", async () => {
  render(<ModelConfigPage initial={{ hasApiKey: true, apiKey: undefined }} />);
  expect(screen.queryByDisplayValue(/sk-|secret/i)).not.toBeInTheDocument();
  expect(screen.getByText("已配置")).toBeInTheDocument();
});
```

- [ ] **Step 2: 实现运营工作流**

智能体列表按学科/学段显示启停、当前 prompt 版本、主备模型和最近测试；详情支持 txt/md 上传、在线编辑、保存草稿、测试、发布、历史和回滚。模型页可覆盖 key、配置能力/超时/成本/积分换算；用量页区分评估、报告、提示词测试和智学调用。

- [ ] **Step 3: 验证审计**

提示词发布/回滚、模型变更、积分调整必须写 AuditLog；列表不展示完整 prompt 或 error body，详情仅 superadmin 可读取 prompt 内容。

- [ ] **Step 4: 测试构建并提交**

Run: `pnpm --filter admin test -- agent-admin && pnpm --filter admin typecheck && pnpm --filter admin build`

Expected: PASS。

```bash
git add "packages/admin/src/app/(dashboard)/agents" packages/admin/src/__tests__/agent-admin.test.tsx
git commit -m "feat(admin): operate tutor agents prompts and usage"
```

## Task 12：V2.2 部署、流式代理、验收和回滚

**Files:**
- Modify: `nginx.conf`
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/runbooks/v2-2-deploy.md`
- Create: `packages/server/src/__tests__/v2-2-acceptance.test.ts`
- Create: `packages/mobile/src/__tests__/v2-2-flow.test.tsx`

- [ ] **Step 1: 写 V2.2 验收测试**

自动化覆盖：13 个配置槽；未发布 agent 不可用；测试后发布与回滚；主模型失败前切备用；首 delta 后不切；文字/图片会话；中文任意分块；停止生成；多会话历史；摘要->证据->画像；两个孩子并发共享积分；失败释放；积分流水关联成本账本。

- [ ] **Step 2: 配置流式 Nginx**

```nginx
location ~ ^/api/v2/tutor/.*/stream$ {
    proxy_pass http://lightning_tiger_admin;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 180s;
    add_header X-Accel-Buffering no;
}
```

- [ ] **Step 3: 添加监控指标**

输出流式首 token 延迟、中断率、主备切换次数、模型 token/费用、额度预占未结算数、摘要队列延迟；告警不得包含 prompt 或对话正文。

- [ ] **Step 4: 执行全量自动验证**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm --filter @lightning-tiger/server exec prisma migrate deploy && pnpm build:admin && pnpm build:worker && pnpm build:weapp`

Expected: 所有命令退出码 0。

- [ ] **Step 5: 执行真机弱网验收**

在微信开发者工具、iOS、Android 上验证中文跨 chunk、连续快速发送、图片上传、停止、切后台 60 秒后恢复、代理一次性降级、额度不足、主备故障。确认页面没有语音、购买或支付入口。

- [ ] **Step 6: 验证独立回滚并提交**

预发布切回 V2.1 镜像；V2.1 必须忽略新增表并继续完成评估/报告，V2.2 未完成 generation 由后台标记 INTERRUPTED 并释放预占，不回滚数据库 migration。

```bash
git add nginx.conf docker-compose.yml .github/workflows/ci.yml docs/runbooks/v2-2-deploy.md packages/server/src/__tests__/v2-2-acceptance.test.ts packages/mobile/src/__tests__/v2-2-flow.test.tsx
git commit -m "chore(release): make v2.2 tutoring independently deployable"
```

## V2.2 完成定义

- 五科 13 个学科/学段智能体只有在提示词测试并发布、主模型有效后才可使用。
- 教学策略完全来自管理员上传提示词；业务代码只含平台安全边界和固定上下文编排。
- 文字和最多 4 张图片可辅导；NDJSON 按字节增量解码，支持停止、中断查询与一次性降级。
- 主备切换只发生在首个有效输出前；模型失败不保存伪造回复。
- 每个孩子每学科支持多会话，摘要异步写入证据并产生新画像/报告版本。
- 家庭积分由所有孩子共享，预占/结算/释放幂等且并发安全，并与独立成本账本关联。
- 不存在语音、音频、在线充值、购买、支付、会员或无限历史注入。
- V2.1 功能在 V2.2 发布和回滚后均保持可用。
