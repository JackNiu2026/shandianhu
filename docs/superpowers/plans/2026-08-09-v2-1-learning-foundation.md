# 闪电虎 V2.1 学情底座 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可独立上线的微信小程序学情底座，完成微信登录、多孩子档案、错题诊断、学习风格测评、版本化画像、交互报告与脱敏 PDF。

**Architecture:** 在 monorepo 中新增 `server` 领域核心包和 `worker` 异步进程；Next.js Route Handler 仅完成认证、Zod 解析和 HTTP 适配。PostgreSQL 保存业务事实，BullMQ/Redis 只调度任务，COS 保存私有文件，所有模型调用统一通过 OpenAI-compatible 网关并写入成本账本。

**Tech Stack:** TypeScript 5.7、pnpm 11、Taro 4、React 18、Next.js 15、Prisma 6/PostgreSQL 16、BullMQ/Redis、腾讯云 COS、Zod、Vitest、PDFKit

---

## 文件结构

- `packages/server/prisma/schema.prisma`：V2 全新关系模型的唯一 Prisma schema。
- `packages/server/src/auth/*`：微信 code 换取、服务端会话与角色上下文。
- `packages/server/src/families/*`：家长和孩子档案、activeChild 权限规则。
- `packages/server/src/files/*`：COS 对象登记、签名和所有权校验。
- `packages/server/src/jobs/*`：数据库 `AsyncJob` 与 BullMQ 投递的一致性接口。
- `packages/server/src/models/*`：模型配置、密钥加密、OpenAI-compatible 调用和用量日志。
- `packages/server/src/assessments/*`：评估状态机、错题结果 schema、28 题确定性评分。
- `packages/server/src/profiles/*`：证据、可信度和不可变画像版本。
- `packages/server/src/reports/*`：综合报告版本、分享令牌与删除级联规则。
- `packages/worker/src/*`：错题、画像、叙述、PDF 和通知消费者。
- `packages/shared/api/*`：跨端 DTO、错误码、任务状态和纯函数，不放 Prisma 类型或演示数据。
- `packages/admin/src/app/api/v2/*`：薄 HTTP 适配层。
- `packages/mobile/src/pages/{smart,tutors,learning,me}/*`：四个家长一级入口。
- `packages/mobile/src/pages/onboarding/*`、`assessment-*/*`、`report/*`：建档、评估与报告流程。
- `packages/admin/src/app/(dashboard)/*`：V2.1 运营后台页面。

## 执行前提

当前主工作区包含用户已有的未提交发布加固和视觉改动。执行本计划前必须先用 `superpowers:using-git-worktrees` 检查工作区，并由用户将这些改动提交到明确分支或确认纳入实现基线；不得通过 reset、checkout 或重新从旧 HEAD 建 worktree 来丢弃它们。计划中的删除只针对被 V2 稳定契约替代的旧运行时文件，现有安全断言和视觉样式必须迁入新实现。

## Task 1：冻结依赖、测试与包边界基线

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `packages/admin/package.json`
- Modify: `packages/admin/next.config.ts`
- Modify: `packages/mobile/package.json`
- Create: `packages/mobile/vitest.config.ts`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/vitest.config.ts`
- Create: `packages/server/src/index.ts`
- Create: `packages/worker/package.json`
- Create: `packages/worker/tsconfig.json`
- Create: `packages/worker/vitest.config.ts`
- Create: `packages/worker/src/index.ts`
- Test: `packages/server/src/__tests__/package-boundary.test.ts`

- [ ] **Step 1: 写包边界失败测试**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("package boundaries", () => {
  it("keeps Prisma out of admin route handlers", () => {
    const root = path.resolve(__dirname, "../../../admin/src/app/api/v2");
    const source = fs.existsSync(root)
      ? fs.readdirSync(root, { recursive: true })
          .filter((name) => String(name).endsWith(".ts"))
          .map((name) => fs.readFileSync(path.join(root, String(name)), "utf8"))
          .join("\n")
      : "";
    expect(source).not.toMatch(/@prisma\/client|from ["']@\/lib\/prisma/);
  });
});
```

- [ ] **Step 2: 运行测试确认因 `server` 包不存在而失败**

Run: `pnpm --filter @lightning-tiger/server test`

Expected: FAIL，提示 workspace 中没有 `@lightning-tiger/server`。

- [ ] **Step 3: 建立两个包和统一根命令**

`packages/server/package.json` 使用以下脚本和依赖：

```json
{
  "name": "@lightning-tiger/server",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "bullmq": "^5.58.5",
    "cos-nodejs-sdk-v5": "^2.14.7",
    "ioredis": "^5.7.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "prisma": "^6.19.3",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/worker/package.json` 依赖 `@lightning-tiger/server`、`@fontsource/noto-sans-sc`、`bullmq`、`pdfkit` 和 `pino`，开发依赖加入 `@types/pdfkit`、`tsx`、`typescript`、`vitest`，脚本固定为 `dev: tsx watch src/index.ts`、`start: tsx src/index.ts`、`build: tsc --noEmit`、`typecheck`、`test`。`packages/admin/package.json` 移除直接的 `prisma`/`@prisma/client`，加入 workspace 依赖 `@lightning-tiger/server: workspace:*`，开发依赖加入 `@testing-library/react` 和 `jsdom`；`next.config.ts` 的 `transpilePackages` 加入 `@lightning-tiger/server` 和 `@lightning-tiger/shared`。`packages/mobile/package.json` 加入 `vitest`、`@testing-library/react`、`jsdom` 和 `test: vitest run`，并创建 jsdom 环境的 Vitest 配置。根脚本增加 `test`、`build:worker`、`db:generate`、`db:migrate`，所有 Prisma 命令改为过滤 `@lightning-tiger/server`。

- [ ] **Step 4: 更新锁文件后验证冻结安装**

Run: `pnpm install --lockfile-only && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build:admin && pnpm build:weapp`

Expected: 所有命令退出码 0；CI 的安装命令为 `pnpm install --frozen-lockfile`，不再使用 `--no-frozen-lockfile`。

- [ ] **Step 5: 提交基线**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .github/workflows/ci.yml packages/server packages/worker
git commit -m "build: establish v2 server and worker packages"
```

## Task 2：建立 V2.1 全新数据库基线

**Files:**
- Delete: `packages/admin/prisma/schema.prisma`
- Delete: `packages/admin/prisma/seed.ts`
- Delete: `packages/admin/prisma/migrations/migration_lock.toml`
- Delete: `packages/admin/prisma/migrations/20260805_init_schema/migration.sql`
- Delete: `packages/admin/prisma/migrations/20260809_remove_message/migration.sql`
- Create: `packages/server/prisma/schema.prisma`
- Create: `packages/server/prisma/migrations/migration_lock.toml`
- Create: `packages/server/prisma/migrations/20260809090000_v2_baseline/migration.sql`
- Create: `packages/server/prisma/seed.ts`
- Create: `packages/server/src/db/client.ts`
- Test: `packages/server/src/__tests__/schema.contract.test.ts`

- [ ] **Step 1: 写 schema 契约失败测试**

```ts
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("v2.1 schema", () => {
  it("exposes identity, assessment, profile and platform entities", () => {
    const names = Prisma.dmmf.datamodel.models.map((model) => model.name);
    expect(names).toEqual(expect.arrayContaining([
      "User", "ParentProfile", "Child", "AuthSession", "AdminUser", "AdminSession",
      "FileObject", "AsyncJob", "Notification", "AuditLog", "ModelConfig",
      "ModelUsageLedger", "AssessmentDefinition", "AssessmentVersion", "AssessmentRun",
      "AssessmentArtifact", "AssessmentResult", "LearningEvidence", "LearningProfile",
      "LearningProfileVersion", "LearningReport", "ReportShare"
    ]));
  });
});
```

- [ ] **Step 2: 运行测试确认旧 schema 不满足契约**

Run: `pnpm --filter @lightning-tiger/server prisma:generate && pnpm --filter @lightning-tiger/server test -- schema.contract`

Expected: FAIL，缺少 `User`、`Child`、`AsyncJob` 等实体。

- [ ] **Step 3: 写入全新关系模型**

模型必须使用以下关键唯一约束和关系，不保留 `Membership`、`Order`、`Withdrawal` 以及旧 `Parent.mbtiResult`/`DiagnosisReport`：

```prisma
model User {
  id             String         @id @default(cuid())
  wechatOpenId   String         @unique
  nickname       String?
  phone          String?
  status         AccountStatus  @default(ACTIVE)
  parentProfile  ParentProfile?
  authSessions   AuthSession[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model AdminUser {
  id           String         @id @default(cuid())
  username     String         @unique
  passwordHash String
  status       AccountStatus  @default(ACTIVE)
  sessions     AdminSession[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}

model AdminSession {
  id          String    @id @default(cuid())
  adminUserId String
  tokenHash   String    @unique
  expiresAt   DateTime
  revokedAt   DateTime?
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  @@index([adminUserId, expiresAt])
}

model ParentProfile {
  id            String   @id @default(cuid())
  userId        String   @unique
  displayName   String
  activeChildId String?
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activeChild   Child?   @relation("ActiveChild", fields: [activeChildId], references: [id], onDelete: SetNull)
  children      Child[]  @relation("ParentChildren")
}

model Child {
  id            String          @id @default(cuid())
  parentId      String
  displayName   String
  birthYear     Int?
  grade         Grade
  schoolName    String?
  learningGoals String[]
  deletedAt     DateTime?
  parent        ParentProfile   @relation("ParentChildren", fields: [parentId], references: [id], onDelete: Cascade)
  activeFor     ParentProfile[] @relation("ActiveChild")
  @@index([parentId, deletedAt])
}

model AssessmentRun {
  id              String           @id @default(cuid())
  idempotencyKey  String
  childId         String
  versionId       String
  status          AsyncJobStatus   @default(PENDING)
  subject         Subject?
  submittedAt     DateTime         @default(now())
  completedAt     DateTime?
  failureCode     String?
  version         AssessmentVersion @relation(fields: [versionId], references: [id])
  artifacts       AssessmentArtifact[]
  result          AssessmentResult?
  @@unique([childId, idempotencyKey])
}

model LearningEvidence {
  id          String         @id @default(cuid())
  childId     String
  sourceType  EvidenceSource
  sourceId    String
  subject     Subject?
  content     Json
  capturedAt  DateTime
  revokedAt   DateTime?
  @@unique([sourceType, sourceId])
  @@index([childId, revokedAt, capturedAt])
}

model LearningProfileVersion {
  id              String   @id @default(cuid())
  profileId       String
  sequence        Int
  snapshot        Json
  evidenceIds     String[]
  ruleVersion     String
  modelConfigId   String?
  confidenceBasis Json
  revokedAt       DateTime?
  createdAt       DateTime @default(now())
  @@unique([profileId, sequence])
}

model AsyncJob {
  id             String         @id @default(cuid())
  type           AsyncJobType
  dedupeKey      String         @unique
  status         AsyncJobStatus @default(PENDING)
  payload        Json
  attempts       Int            @default(0)
  maxAttempts    Int            @default(3)
  nextAttemptAt  DateTime?
  lockedAt       DateTime?
  finishedAt     DateTime?
  errorCode      String?
  errorMetadata  Json?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  @@index([status, nextAttemptAt])
}
```

其余模型按以下字段和约束实现，不允许省略为无约束 JSON：

- `AuthSession(userId,tokenHash unique,expiresAt,revokedAt,lastSeenAt)`，User 删除时级联。
- `FileObject(ownerUserId,childId?,objectKey unique,mimeType,sizeBytes,sha256,purpose,status,deletedAt)`，业务实体只引用 file id。
- `Notification(userId,childId?,type,dedupeKey unique,targetRoute,targetParams,readAt,createdAt)`。
- `AuditLog(actorKind,actorId,action,entityType,entityId,sanitizedDiff,createdAt)`，敏感正文禁止进入 diff。
- `ModelConfig(name,baseUrl,encryptedApiKey,apiKeyIv,apiKeyTag,modelName,supportsVision,timeoutMs,maxOutputTokens,temperature,inputCostMicrosPer1k,outputCostMicrosPer1k,imageCostMicros,enabled)`。
- `ModelUsageLedger(callId unique,purpose,modelConfigId,status,inputTokens,outputTokens,imageCount,latencyMs,estimatedCostMicros,sanitizedError,createdAt)`。
- `AssessmentDefinition(key unique,name,enabled)`；`AssessmentVersion(definitionId,sequence,kind,configuration,checksum,publishedAt)` 以 `(definitionId,sequence)` 唯一。
- `AssessmentArtifact(runId,fileObjectId,ordinal)` 以 `(runId,ordinal)` 唯一；`AssessmentResult(runId unique,structuredResult,parentNarrative,modelCallId?,createdAt)`。
- `LearningProfile(childId unique,currentVersionId?)`；版本、证据字段使用上列定义，删除来源只能写 revokedAt 并重算。
- `LearningReport(childId,sequence,profileVersionId,status,structuredBody,parentNarrative,narrativeVersion,pdfFileObjectId?,createdAt)` 以 `(childId,sequence)` 唯一。
- `ReportShare(reportId,tokenHash unique,expiresAt,revokedAt,createdAt)`；数据库不保存原始 token。

`User -> ParentProfile/AuthSession`、`ParentProfile -> Child`、`Child -> assessment/evidence/profile/report/file` 使用显式外键；孩子采用软删除，不由数据库立即级联清除报告。可查询字段使用关系列，只有版本快照、供应商原始用量、任务 payload 和结构化报告正文使用 `Json`。

- [ ] **Step 4: 验证全新数据库迁移**

Run: `pnpm --filter @lightning-tiger/server exec prisma migrate reset --force --skip-seed && pnpm --filter @lightning-tiger/server exec prisma migrate deploy && pnpm --filter @lightning-tiger/server prisma:generate`

Expected: 空测试库只执行 `20260809090000_v2_baseline` 并成功生成客户端。

- [ ] **Step 5: 提交 schema 基线**

```bash
git add packages/admin/prisma packages/server/prisma packages/server/src/db packages/server/src/__tests__/schema.contract.test.ts
git commit -m "feat(db): create v2 learning foundation baseline"
```

## Task 3：让旧 V1 运行时退出新 schema 编译路径

**Files:**
- Delete: `packages/admin/src/app/api/auth/parent/login/route.ts`
- Delete: `packages/admin/src/app/api/auth/parent/register/route.ts`
- Delete: `packages/admin/src/app/api/auth/parent/me/route.ts`
- Delete: `packages/admin/src/app/api/teachers/route.ts`
- Delete: `packages/admin/src/app/api/teachers/[id]/route.ts`
- Delete: `packages/admin/src/app/api/parents/route.ts`
- Delete: `packages/admin/src/app/api/parents/[id]/route.ts`
- Delete: `packages/admin/src/app/api/bookings/route.ts`
- Delete: `packages/admin/src/app/api/bookings/[id]/route.ts`
- Delete: `packages/admin/src/app/api/reviews/route.ts`
- Delete: `packages/admin/src/app/api/reviews/[id]/route.ts`
- Delete: `packages/admin/src/app/api/memberships/route.ts`
- Delete: `packages/admin/src/app/api/memberships/[id]/route.ts`
- Delete: `packages/admin/src/app/api/finance/stats/route.ts`
- Delete: `packages/admin/src/app/api/finance/withdrawals/route.ts`
- Delete: `packages/admin/src/app/api/public/teachers/route.ts`
- Delete: `packages/admin/src/app/api/public/stats/route.ts`
- Delete: `packages/admin/src/app/api/public/bookings/route.ts`
- Delete: `packages/admin/src/app/api/public/reviews/route.ts`
- Delete: `packages/admin/src/app/api/diagnose/route.ts`
- Delete: `packages/admin/src/app/api/dashboard/stats/route.ts`
- Delete: `packages/admin/src/app/api/content/route.ts`
- Delete: `packages/admin/src/app/api/content/config/route.ts`
- Delete: `packages/admin/src/app/(dashboard)/teachers/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/teachers/[id]/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/teachers/new/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/parents/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/parents/[id]/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/bookings/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/reviews/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/memberships/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/finance/page.tsx`
- Delete: `packages/admin/src/app/(dashboard)/content/page.tsx`
- Delete: `packages/admin/src/lib/data.ts`
- Delete: `packages/admin/src/lib/prisma.ts`
- Modify: `packages/admin/src/app/api/auth/login/route.ts`
- Modify: `packages/admin/src/app/api/auth/logout/route.ts`
- Modify: `packages/admin/src/app/api/auth/me/route.ts`
- Modify: `packages/admin/src/app/api/auth/change-password/route.ts`
- Modify: `packages/admin/src/lib/auth.ts`
- Modify: `packages/admin/src/lib/api-auth.ts`
- Modify: `packages/admin/src/middleware.ts`
- Modify: `packages/admin/src/app/(dashboard)/layout.tsx`
- Test: `packages/admin/src/__tests__/legacy-runtime.contract.test.ts`
- Modify: `packages/admin/src/__tests__/release-hardening.test.ts`

- [ ] **Step 1: 写旧模型引用失败测试**

```ts
it("does not compile runtime code against removed v1 models", () => {
  const source = readRuntimeSources();
  expect(source).not.toMatch(/prisma\.(parent|teacher|booking|review|membership|withdrawal|order|diagnosisReport)\b/);
  expect(source).not.toMatch(/@lightning-tiger\/shared["'].*teachers/);
});
```

- [ ] **Step 2: 删除旧领域 API，保留视觉资产**

删除上列旧 API、旧领域页面与 `lib/data.ts`，不删除通用 UI 组件、全局样式、图表组件或移动端 tutors 页视觉样式。运营概览在 Task 15 改接 V2 聚合接口；运行时不能回退随机/静态数据。

将现有发布加固断言迁到 V2 适配层：动态 CORS 白名单、稳定错误响应、服务端 child 所有权、输入长度/类型限制、脱敏序列化和生产环境 secret 必填继续由 `release-hardening.test.ts` 覆盖；删除旧路由不等于删除这些安全保证。

- [ ] **Step 3: 将后台登录迁到 AdminSession**

登录校验 `AdminUser.passwordHash` 后签发随机不透明 token，只保存 tokenHash；Cookie 仍为 HttpOnly/Secure/SameSite=Lax。Edge `middleware.ts` 只做 Cookie 存在性跳转和动态 CORS，不导入 Prisma，也不把 Cookie 存在视为授权；Node.js dashboard layout 和每个 Route Handler 的 `authenticateAdmin` 查询未撤销且未过期 AdminSession。登出写 revokedAt，修改密码撤销该管理员全部旧 session；不再用一个 JWT 同时承载 admin 和 parent 身份。

- [ ] **Step 4: 生成新客户端并验证 Admin 构建**

Run: `pnpm --filter @lightning-tiger/server prisma:generate && pnpm --filter admin typecheck && pnpm --filter admin build && pnpm --filter admin test -- legacy-runtime.contract`

Expected: PASS，运行时源码没有旧 Prisma model 调用和静态老师导入。

- [ ] **Step 5: 提交旧运行时退场**

```bash
git add packages/admin
git commit -m "refactor(runtime): retire v1 data model adapters"
```

## Task 4：统一 API 契约、错误码和服务端角色上下文

**Files:**
- Modify: `packages/shared/api/index.ts`
- Modify: `packages/shared/types/index.ts`
- Create: `packages/server/src/errors/app-error.ts`
- Create: `packages/server/src/auth/session-service.ts`
- Create: `packages/server/src/auth/role-context.ts`
- Create: `packages/admin/src/lib/v2-handler.ts`
- Test: `packages/server/src/auth/session-service.test.ts`
- Test: `packages/admin/src/__tests__/v2-handler.test.ts`

- [ ] **Step 1: 写会话撤销与错误响应失败测试**

```ts
it("rejects an expired or revoked session", async () => {
  await expect(resolveSession("revoked-token")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});

it("serializes stable error codes", async () => {
  const response = await toHttpResponse(async () => {
    throw new AppError("FORBIDDEN", 403, "无权访问该孩子");
  });
  expect(await response.json()).toEqual({
    ok: false,
    error: { code: "FORBIDDEN", message: "无权访问该孩子", requestId: expect.any(String) }
  });
});
```

- [ ] **Step 2: 实现稳定契约**

```ts
export type ApiErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"
  | "QUOTA_EXCEEDED" | "RESOURCE_CONFLICT" | "MODEL_UNAVAILABLE"
  | "JOB_FAILED" | "INTERNAL_ERROR";

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: ApiErrorCode; message: string; requestId: string } };

export interface RequestContext {
  requestId: string;
  actor: { kind: "user"; userId: string; workspace: "account" | "parent" | "teacher";
           parentProfileId?: string; teacherProfileId?: string } |
         { kind: "admin"; adminUserId: string };
}
```

移动端只能按 `error.code` 选择恢复动作；中文 `message` 只用于展示。

- [ ] **Step 3: 运行单元测试**

Run: `pnpm --filter @lightning-tiger/server test -- session-service && pnpm --filter admin test -- v2-handler`

Expected: PASS。

- [ ] **Step 4: 提交契约与认证边界**

```bash
git add packages/shared packages/server/src/auth packages/server/src/errors packages/admin/src/lib/v2-handler.ts packages/admin/src/__tests__/v2-handler.test.ts
git commit -m "feat(api): add v2 contracts and role contexts"
```

## Task 5：微信一键登录与渐进式建档

**Files:**
- Create: `packages/server/src/auth/wechat-client.ts`
- Create: `packages/server/src/auth/login-service.ts`
- Create: `packages/admin/src/app/api/v2/auth/wechat/route.ts`
- Create: `packages/admin/src/app/api/v2/auth/session/route.ts`
- Create: `packages/mobile/src/pages/onboarding/index.tsx`
- Create: `packages/mobile/src/pages/onboarding/index.scss`
- Create: `packages/mobile/src/services/auth.ts`
- Test: `packages/server/src/auth/login-service.test.ts`
- Test: `packages/admin/src/__tests__/wechat-login.route.test.ts`

- [ ] **Step 1: 写重复 code 登录的幂等失败测试**

```ts
it("returns one user and rotates the session for repeated openid login", async () => {
  wechat.exchangeCode.mockResolvedValue({ openid: "o-parent-1", sessionKey: "secret" });
  const first = await service.loginWithCode("code-1");
  const second = await service.loginWithCode("code-2");
  expect(first.userId).toBe(second.userId);
  expect(await db.user.count({ where: { wechatOpenId: "o-parent-1" } })).toBe(1);
  expect(second.token).not.toBe(first.token);
});
```

- [ ] **Step 2: 实现微信交换与不透明会话**

`WechatClient.exchangeCode(code)` 调用 `https://api.weixin.qq.com/sns/jscode2session`，仅返回服务端使用的 `openid` 和 `session_key`。`AuthSession.tokenHash` 保存 `sha256(randomBytes(32))`，原始 token 只返回一次；默认 30 天过期，可撤销，不使用小程序 JWT 作为数据库会话替代品。

- [ ] **Step 3: 实现建档页面顺序**

家长主路径严格执行 `wx.login -> 家长称呼 -> 第一个孩子称呼/年级/目标 -> 学情引导`。登录页和无孩子“我的”提供次级“老师入驻”入口；V2.1 只保留已登录 `account` workspace 和入驻阶段状态，不创建 `ParentProfile` 或 `Child`，V2.3 再由该入口创建 `TeacherApplication` 草稿。完成孩子建档返回 `{ nextRoute: "/pages/learning/index" }`；跳过两项评估后写入 `onboardingCompletedAt`，以后启动进入智学。

- [ ] **Step 4: 运行认证契约和小程序类型检查**

Run: `pnpm --filter @lightning-tiger/server test -- login-service && pnpm --filter admin test -- wechat-login && pnpm --filter mobile typecheck`

Expected: PASS。

- [ ] **Step 5: 提交微信登录**

```bash
git add packages/server/src/auth packages/admin/src/app/api/v2/auth packages/mobile/src/pages/onboarding packages/mobile/src/services/auth.ts
git commit -m "feat(auth): add WeChat login and progressive onboarding"
```

## Task 6：多孩子档案与 activeChild 全局约束

**Files:**
- Create: `packages/server/src/families/child-service.ts`
- Create: `packages/admin/src/app/api/v2/children/route.ts`
- Create: `packages/admin/src/app/api/v2/children/[id]/route.ts`
- Create: `packages/admin/src/app/api/v2/children/active/route.ts`
- Modify: `packages/mobile/src/store/index.tsx`
- Create: `packages/mobile/src/hooks/useActiveChild.ts`
- Modify: `packages/mobile/src/pages/me/index.tsx`
- Test: `packages/server/src/families/child-service.test.ts`

- [ ] **Step 1: 写跨家庭切换与数量上限失败测试**

```ts
it("cannot activate another parent's child", async () => {
  await expect(service.setActiveChild(parentA.id, childB.id))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("limits a family to five active children", async () => {
  await createFiveChildren(parentA.id);
  await expect(service.createChild(parentA.id, validChild))
    .rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
});
```

- [ ] **Step 2: 实现事务化 activeChild**

`createChild`、`updateChild`、`setActiveChild` 都先校验 `child.parentId === parent.id`；新建第一个孩子时在同一事务设置 `activeChildId`。软删除当前孩子时选择该家庭最近创建的未删除孩子，否则设为 `null`。

- [ ] **Step 3: 将客户端持久状态缩小为会话和 activeChild 摘要**

```ts
export interface AppState {
  session: { token: string; userId: string } | null;
  workspace: "account" | "parent" | "teacher";
  parent: { id: string; displayName: string } | null;
  activeChild: { id: string; displayName: string; grade: Grade } | null;
  hydrated: boolean;
}
```

只有“我的”渲染新增、编辑、切换控件；智学、家教、学情通过 `useActiveChild()` 读取并在空值时 `Taro.switchTab({ url: "/pages/me/index" })`。

- [ ] **Step 4: 运行权限测试**

Run: `pnpm --filter @lightning-tiger/server test -- child-service && pnpm --filter mobile typecheck`

Expected: PASS，测试覆盖跨家庭读取、写入、删除和 activeChild 失效。

- [ ] **Step 5: 提交孩子上下文**

```bash
git add packages/server/src/families packages/admin/src/app/api/v2/children packages/mobile/src/store packages/mobile/src/hooks packages/mobile/src/pages/me
git commit -m "feat(family): add multi-child profiles and active context"
```

## Task 7：COS 私有文件与所有权

**Files:**
- Create: `packages/server/src/files/cos-client.ts`
- Create: `packages/server/src/files/file-service.ts`
- Create: `packages/admin/src/app/api/v2/files/upload-url/route.ts`
- Create: `packages/admin/src/app/api/v2/files/[id]/download-url/route.ts`
- Test: `packages/server/src/files/file-service.test.ts`

- [ ] **Step 1: 写类型、数量、大小和所有权失败测试**

```ts
it.each([
  [{ mimeType: "image/svg+xml", size: 100 }, "VALIDATION_ERROR"],
  [{ mimeType: "image/jpeg", size: 10_485_761 }, "VALIDATION_ERROR"]
])("rejects unsafe assessment files", async (file, code) => {
  await expect(service.issueUpload(parentCtx, child.id, "ASSESSMENT_INPUT", file))
    .rejects.toMatchObject({ code });
});
```

- [ ] **Step 2: 实现短期签名和对象登记**

上传允许 `image/jpeg`、`image/png`、`image/webp`，单文件不超过 10 MiB；PDF 只允许 Worker 创建。对象键固定为 `families/{parentId}/children/{childId}/{purpose}/{fileId}`，签名有效 10 分钟。数据库只保存对象键，不保存签名 URL。

- [ ] **Step 3: 运行文件安全测试**

Run: `pnpm --filter @lightning-tiger/server test -- file-service`

Expected: PASS，包含他人孩子、已删除文件和过期状态拒绝测试。

- [ ] **Step 4: 提交 COS 基础能力**

```bash
git add packages/server/src/files packages/admin/src/app/api/v2/files
git commit -m "feat(files): add private COS file lifecycle"
```

## Task 8：数据库事实任务与 Redis Worker 一致性

**Files:**
- Create: `packages/server/src/jobs/job-service.ts`
- Create: `packages/server/src/jobs/queue.ts`
- Create: `packages/worker/src/worker.ts`
- Create: `packages/admin/src/app/api/v2/jobs/[id]/route.ts`
- Test: `packages/server/src/jobs/job-service.test.ts`
- Test: `packages/worker/src/worker.test.ts`

- [ ] **Step 1: 写重复投递、重试和 Redis 丢失失败测试**

```ts
it("creates one database job for one dedupe key", async () => {
  const a = await jobs.enqueue("ASSESSMENT_ANALYZE", "run:1", { runId: "1" });
  const b = await jobs.enqueue("ASSESSMENT_ANALYZE", "run:1", { runId: "1" });
  expect(b.id).toBe(a.id);
});

it("requeues pending database jobs absent from Redis", async () => {
  await db.asyncJob.create({ data: pendingJob("profile:1") });
  await jobs.reconcile();
  expect(queue.add).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 实现状态机**

允许 `PENDING -> RUNNING -> SUCCEEDED`；临时错误走 `RUNNING -> RETRY_WAIT -> PENDING`，最多 3 次；文件损坏和模型 schema 不合法直接 `FAILED`；超限进入 `DEAD_LETTER`。每次转换写入数据库，Redis jobId 使用 `AsyncJob.id`。

- [ ] **Step 3: 运行 Worker 一致性测试**

Run: `pnpm --filter @lightning-tiger/server test -- job-service && pnpm --filter @lightning-tiger/worker test -- worker`

Expected: PASS。

- [ ] **Step 4: 提交任务基础能力**

```bash
git add packages/server/src/jobs packages/worker/src packages/admin/src/app/api/v2/jobs
git commit -m "feat(jobs): persist and reconcile asynchronous work"
```

## Task 9：OpenAI-compatible 模型网关与全局成本账本

**Files:**
- Create: `packages/server/src/models/crypto.ts`
- Create: `packages/server/src/models/model-config-service.ts`
- Create: `packages/server/src/models/openai-gateway.ts`
- Create: `packages/server/src/models/usage-service.ts`
- Create: `packages/admin/src/app/api/v2/admin/models/route.ts`
- Test: `packages/server/src/models/openai-gateway.test.ts`

- [ ] **Step 1: 写主请求、schema 错误和脱敏日志失败测试**

```ts
it("records failed model usage without secrets or prompt body", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "not-json" } }] }));
  await expect(gateway.completeStructured(request, wrongQuestionSchema)).rejects.toMatchObject({
    code: "MODEL_UNAVAILABLE"
  });
  expect(await lastUsage()).toMatchObject({ status: "FAILED", purpose: "ASSESSMENT" });
  expect(JSON.stringify(await lastUsage())).not.toContain("api-key");
  expect(JSON.stringify(await lastUsage())).not.toContain(request.messages[0].content);
});
```

- [ ] **Step 2: 实现配置和密钥覆盖更新**

`MODEL_KEY_ENCRYPTION_KEY` 必须是 32 字节 base64；使用 AES-256-GCM 保存 `ciphertext/iv/tag`。后台读取只返回 `hasApiKey: true`，从不返回明文。模型配置包含 base URL、模型名、视觉能力、超时、最大输出、温度、输入/输出/图片成本和启停状态。

- [ ] **Step 3: 实现统一调用与用量记录**

每次调用生成 `callId`，成功与失败都写 `ModelUsageLedger`：purpose、modelConfigId、inputTokens、outputTokens、imageCount、latencyMs、estimatedCostMicros、status、sanitizedError。评估调用不接触 V2.2 家庭额度。

- [ ] **Step 4: 运行模型网关测试**

Run: `pnpm --filter @lightning-tiger/server test -- openai-gateway`

Expected: PASS，覆盖超时、429、非 JSON、schema 不符和日志脱敏。

- [ ] **Step 5: 提交模型基础能力**

```bash
git add packages/server/src/models packages/admin/src/app/api/v2/admin/models
git commit -m "feat(models): add compatible gateway and cost ledger"
```

## Task 10：28 题学习风格测评

**Files:**
- Modify: `packages/shared/utils/mbti.ts`
- Create: `packages/shared/api/assessments.ts`
- Create: `packages/server/src/assessments/learning-style.ts`
- Create: `packages/server/src/assessments/assessment-service.ts`
- Create: `packages/admin/src/app/api/v2/assessments/learning-style/route.ts`
- Create: `packages/mobile/src/pages/assessment-style/index.tsx`
- Create: `packages/mobile/src/pages/assessment-style/index.scss`
- Test: `packages/server/src/assessments/learning-style.test.ts`

- [ ] **Step 1: 写确定性计分失败测试**

```ts
it("scores all four dimensions without model influence", () => {
  const result = scoreLearningStyle(Array.from({ length: 28 }, (_, index) => ({
    questionId: `q${index + 1}`,
    option: index % 2 === 0 ? "A" : "B"
  })));
  expect(result).toEqual({
    version: "learning-style-v1",
    dimensions: expect.objectContaining({ interaction: expect.any(Number), information: expect.any(Number),
      decision: expect.any(Number), rhythm: expect.any(Number) }),
    code: expect.stringMatching(/^[EI][SN][TF][JP]$/)
  });
});
```

- [ ] **Step 2: 将现有 28 题和规则固化为版本数据**

Seed 创建 `AssessmentDefinition(key="learning-style")` 与不可变 `AssessmentVersion(version=1)`；提交时必须正好包含 28 个已知 questionId，每题只能一个合法选项。代码先生成四维结果，模型只能基于该结果补充 `parentNarrative`，不能覆盖 code 或维度分数。

- [ ] **Step 3: 实现页面和免责声明**

页面支持逐题、返回、恢复草稿和提交；结果页固定显示“教学偏好参考，不是心理诊断或能力评价”。提交成功创建 `AssessmentResult`、`LearningEvidence` 并投递画像任务。

- [ ] **Step 4: 运行计分和类型检查**

Run: `pnpm --filter @lightning-tiger/server test -- learning-style && pnpm --filter mobile typecheck`

Expected: PASS，覆盖缺题、重复题、非法选项和相同输入相同结果。

- [ ] **Step 5: 提交学习风格测评**

```bash
git add packages/shared packages/server/src/assessments packages/admin/src/app/api/v2/assessments/learning-style packages/mobile/src/pages/assessment-style
git commit -m "feat(assessment): add deterministic learning style evaluation"
```

## Task 11：错题批次诊断

**Files:**
- Create: `packages/server/src/assessments/wrong-question-schema.ts`
- Create: `packages/server/src/assessments/wrong-question-service.ts`
- Create: `packages/worker/src/processors/assessment-analyze.ts`
- Create: `packages/admin/src/app/api/v2/assessments/wrong-questions/route.ts`
- Create: `packages/mobile/src/pages/assessment-wrong/index.tsx`
- Create: `packages/mobile/src/pages/assessment-wrong/index.scss`
- Test: `packages/server/src/assessments/wrong-question-service.test.ts`
- Test: `packages/worker/src/processors/assessment-analyze.test.ts`

- [ ] **Step 1: 写 1 至 9 图、幂等和失败无证据测试**

```ts
it("does not create evidence when model output is invalid", async () => {
  gateway.completeStructured.mockRejectedValue(new Error("schema invalid"));
  await processor.run({ runId: run.id });
  expect(await db.assessmentRun.findUnique({ where: { id: run.id } })).toMatchObject({ status: "FAILED" });
  expect(await db.learningEvidence.count({ where: { sourceId: run.id } })).toBe(0);
});
```

- [ ] **Step 2: 定义结构化结果 schema**

```ts
export const wrongQuestionResultSchema = z.object({
  questions: z.array(z.object({
    ordinal: z.number().int().positive(),
    recognizedText: z.string().min(1),
    knowledgePoints: z.array(z.string().min(1)),
    errorType: z.enum(["CONCEPT", "CALCULATION", "READING", "METHOD", "CARELESS", "UNKNOWN"]),
    analysis: z.string().min(1),
    mastery: z.number().min(0).max(100),
    suggestion: z.string().min(1)
  })).min(1),
  weakPoints: z.array(z.object({ name: z.string(), mastery: z.number().min(0).max(100) })),
  summary: z.string().min(1)
});
```

- [ ] **Step 3: 实现异步链路**

API 校验当前孩子和 1 至 9 个 `FileObject` 所有权，在事务中按 `(childId,idempotencyKey)` 创建 run/artifacts/job 后立即返回 `{ taskId, runId }`。Worker 获取服务端 COS 签名 URL，调用视觉模型，schema 校验成功后在同一事务保存 result 与唯一 evidence；失败保留 artifacts 供后台重试。

- [ ] **Step 4: 实现任务恢复页面**

小程序保存 `taskId`，每 2 秒查询数据库任务状态；切后台停止轮询，回前台恢复。失败显示“重新分析”并复用相同输入生成新的管理员可追踪 attempt，不创建错题本、收藏、重新作答或掌握跟踪入口。

- [ ] **Step 5: 运行诊断测试**

Run: `pnpm --filter @lightning-tiger/server test -- wrong-question && pnpm --filter @lightning-tiger/worker test -- assessment-analyze && pnpm --filter mobile typecheck`

Expected: PASS。

- [ ] **Step 6: 提交错题诊断**

```bash
git add packages/server/src/assessments packages/worker/src/processors packages/admin/src/app/api/v2/assessments/wrong-questions packages/mobile/src/pages/assessment-wrong
git commit -m "feat(assessment): add batch wrong-question diagnosis"
```

## Task 12：证据、可信度与不可变画像版本

**Files:**
- Create: `packages/server/src/profiles/confidence.ts`
- Create: `packages/server/src/profiles/profile-service.ts`
- Create: `packages/worker/src/processors/profile-rebuild.ts`
- Test: `packages/server/src/profiles/confidence.test.ts`
- Test: `packages/server/src/profiles/profile-service.test.ts`

- [ ] **Step 1: 写可信度和版本不可变失败测试**

```ts
it("reduces confidence as evidence ages", () => {
  expect(scoreConfidence([evidenceAt("2026-08-01")], new Date("2026-08-09")))
    .toBeGreaterThan(scoreConfidence([evidenceAt("2025-08-01")], new Date("2026-08-09")));
});

it("creates a new snapshot instead of updating the current one", async () => {
  const first = await profiles.rebuild(child.id);
  await addEvidence(child.id);
  const second = await profiles.rebuild(child.id);
  expect(second.sequence).toBe(first.sequence + 1);
  expect((await loadVersion(first.id)).snapshot).toEqual(first.snapshot);
});
```

- [ ] **Step 2: 实现确定性可信度**

可信度由有效证据数、不同来源类型、知识点覆盖和 180 天指数衰减组成，并限制到 0–100；模型返回的任何 confidence 字段一律忽略。画像条目保留 `evidenceIds`、最近采集时间和计算依据。

- [ ] **Step 3: 实现序列化重算**

同一 child 使用 PostgreSQL advisory transaction lock；读取未撤销 evidence，创建新 `LearningProfileVersion`，再更新 `LearningProfile.currentVersionId`。空证据时创建空画像，不虚构弱项或建议。

- [ ] **Step 4: 运行画像测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- confidence profile-service && pnpm --filter @lightning-tiger/worker test -- profile-rebuild`

Expected: PASS。

```bash
git add packages/server/src/profiles packages/worker/src/processors/profile-rebuild.ts
git commit -m "feat(profile): build versioned evidence-based learning profiles"
```

## Task 13：综合报告、脱敏 PDF 和可撤销分享

**Files:**
- Create: `packages/server/src/reports/report-service.ts`
- Create: `packages/server/src/reports/share-service.ts`
- Create: `packages/worker/src/processors/report-build.ts`
- Create: `packages/worker/src/processors/report-pdf.ts`
- Create: `packages/admin/src/app/api/v2/reports/[id]/route.ts`
- Create: `packages/admin/src/app/api/v2/reports/[id]/pdf/route.ts`
- Create: `packages/admin/src/app/api/v2/reports/[id]/shares/route.ts`
- Create: `packages/admin/src/app/share/reports/[token]/route.ts`
- Create: `packages/mobile/src/pages/report/index.tsx`
- Create: `packages/mobile/src/pages/report/index.scss`
- Test: `packages/server/src/reports/report-service.test.ts`
- Test: `packages/server/src/reports/share-service.test.ts`
- Test: `packages/worker/src/processors/report-pdf.test.ts`

- [ ] **Step 1: 写任一评估可出报告、分享撤销和脱敏失败测试**

```ts
it("builds an initial report from one assessment", async () => {
  const report = await reports.createForProfile(profileWithStyleOnly.id);
  expect(report.structuredBody).toMatchObject({ evidenceCount: 1 });
});

it("stores only a share token hash and rejects revoked links", async () => {
  const issued = await shares.issue(report.id, parent.id, 3600);
  expect((await db.reportShare.findUnique({ where: { id: issued.id } }))?.tokenHash)
    .not.toBe(issued.token);
  await shares.revoke(issued.id, parent.id);
  await expect(shares.resolve(issued.token)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
```

- [ ] **Step 2: 实现结构化事实优先的报告**

先从画像快照生成 `structuredBody`，再让模型产生只读叙述；叙述校验器拒绝新增不存在的分数、知识点或诊断结论。每个报告绑定 profileVersionId、assessmentVersionIds、modelConfigId 和 narrativeVersion。

- [ ] **Step 3: 实现脱敏 PDF**

PDF 只展示孩子称呼首字符、年级、报告日期、结构化结论、证据范围和建议，不展示学校、家长手机号、文件 URL、模型提示词或原始错题图片。Worker 用 `@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2` 注册 PDFKit 字体，许可证随 npm 包进入镜像；生成结果写回受控 `FileObject`。

- [ ] **Step 4: 实现分享令牌**

生成 32 字节随机 token，数据库只存 SHA-256 hash；默认 24 小时，最大 7 天。公开路由每次校验 hash、expiresAt、revokedAt 和 report 状态后返回脱敏 PDF 的 5 分钟签名下载地址。

- [ ] **Step 5: 运行报告测试**

Run: `pnpm --filter @lightning-tiger/server test -- report && pnpm --filter @lightning-tiger/worker test -- report-pdf`

Expected: PASS；PDF 测试解析文本并断言不含手机号、学校和对象键。

- [ ] **Step 6: 提交报告能力**

```bash
git add packages/server/src/reports packages/worker/src/processors/report-* packages/admin/src/app/api/v2/reports packages/admin/src/app/share packages/mobile/src/pages/report
git commit -m "feat(report): add traceable reports and revocable PDFs"
```

## Task 14：四栏家长信息架构、学情执行页与“我的”聚合页

**Files:**
- Modify: `packages/mobile/src/app.config.ts`
- Modify: `packages/mobile/src/custom-tab-bar/index.tsx`
- Modify: `packages/mobile/src/custom-tab-bar/index.scss`
- Create: `packages/mobile/src/pages/smart/index.tsx`
- Create: `packages/mobile/src/pages/smart/index.scss`
- Rename: `packages/mobile/src/pages/match/*` -> `packages/mobile/src/pages/tutors/*`
- Rename: `packages/mobile/src/pages/test/*` -> `packages/mobile/src/pages/learning/*`
- Modify: `packages/mobile/src/pages/me/index.tsx`
- Modify: `packages/mobile/src/pages/me/index.scss`
- Modify: `packages/mobile/src/services/api.ts`
- Delete: `packages/mobile/src/components/LoginModal.tsx`
- Delete: `packages/shared/data/teachers.ts`
- Delete: `packages/shared/utils/match.ts`
- Modify: `packages/shared/index.ts`
- Test: `packages/mobile/src/__tests__/navigation.contract.test.ts`

- [ ] **Step 1: 写四栏名称和孩子切换位置失败测试**

```ts
it("uses the approved four parent tabs", () => {
  expect(appConfig.tabBar.list.map((item) => item.text)).toEqual(["智学", "家教", "学情", "我的"]);
});

it("exposes child switching only from me", () => {
  expect(readPage("me")).toContain("ChildSwitcher");
  expect(readPage("smart") + readPage("tutors") + readPage("learning")).not.toContain("ChildSwitcher");
});

it("does not retain v1 password or public teacher endpoints", () => {
  expect(readMobileSources()).not.toMatch(/auth\/parent\/(login|register)|api\/public\/teachers/);
});
```

- [ ] **Step 2: 修改导航和启动路由**

`pages` 顺序固定为 smart、tutors、learning、me；tab 文案固定为“智学、家教、学情、我的”。已完成 onboarding 的家长启动进入智学；刚创建首个孩子进入学情。V2.1 的智学和家教分别显示不可操作的阶段状态，不读取静态老师或虚假统计；V2.2、V2.3 上线后原位替换，不改变 tab 路径。删除 `shared/data/teachers.ts`、旧 `shared/utils/match.ts` 及其导出，现有视觉样式保留在 tutors 页面；V2.3 的匹配规则由 server 领域服务重新实现。

`services/api.ts` 只保留统一 `ApiResult` 请求器、session/child/assessment/job/report/notification 客户端，删除手机号密码登录、公开静态老师、旧预约、旧评价和同步 `/api/diagnose` 调用；删除旧 `LoginModal`，登录统一走 Task 5 的 `wx.login` 服务。

- [ ] **Step 3: 收敛页面职责**

学情页只展示两项评估入口、最近即时结果和重新评估；综合报告、历史趋势、PDF、待办、通知、预约和孩子管理全部放入“我的”。任何业务页无 activeChild 时跳转“我的”建档。

- [ ] **Step 4: 构建微信小程序**

Run: `pnpm --filter mobile typecheck && pnpm --filter mobile build:weapp`

Expected: PASS；生成配置中恰好四个 tab，文字均为两个汉字。

- [ ] **Step 5: 提交信息架构**

```bash
git add packages/mobile/src
git commit -m "feat(mobile): adopt four-tab family workspace navigation"
```

## Task 15：后台运营入口、通知和敏感审计

**Files:**
- Modify: `packages/admin/src/components/dashboard/sidebar.tsx`
- Create: `packages/admin/src/app/(dashboard)/families/page.tsx`
- Modify: `packages/admin/src/app/(dashboard)/assessments/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/agents/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/notifications/page.tsx`
- Create: `packages/server/src/notifications/notification-service.ts`
- Create: `packages/server/src/audit/audit-service.ts`
- Test: `packages/server/src/audit/audit-service.test.ts`
- Test: `packages/admin/src/__tests__/v2-sidebar.test.tsx`

- [ ] **Step 1: 写后台导航和审计失败测试**

```ts
it("shows v2.1 operational domains and no finance or membership links", () => {
  expect(labels()).toEqual(expect.arrayContaining(["运营概览", "家庭管理", "学情中心", "智能体中心", "通知中心", "系统设置"]));
  expect(labels()).not.toEqual(expect.arrayContaining(["财务管理", "会员管理"]));
});
```

- [ ] **Step 2: 实现单 superadmin 页面和站内通知**

后台可查看家庭/孩子、失败评估重试、报告/PDF/分享状态、评估模型配置、调用用量和通知。报告删除、模型密钥覆盖、失败任务重试都写 `AuditLog`，日志只保存实体 ID、动作和脱敏差异。

- [ ] **Step 3: 运行后台测试并构建**

Run: `pnpm --filter admin test -- v2-sidebar && pnpm --filter admin typecheck && pnpm --filter admin build`

Expected: PASS。

- [ ] **Step 4: 提交运营后台**

```bash
git add packages/admin/src packages/server/src/notifications packages/server/src/audit
git commit -m "feat(admin): add learning foundation operations"
```

## Task 16：隐私删除、证据撤销和 30 天孩子恢复期

**Files:**
- Create: `packages/server/src/privacy/deletion-service.ts`
- Create: `packages/worker/src/processors/privacy-cleanup.ts`
- Create: `packages/admin/src/app/api/v2/privacy/children/[id]/route.ts`
- Create: `packages/admin/src/app/api/v2/privacy/files/[id]/route.ts`
- Test: `packages/server/src/privacy/deletion-service.test.ts`

- [ ] **Step 1: 写删除级联失败测试**

```ts
it("revokes evidence and rebuilds profile when an assessment image is deleted", async () => {
  await privacy.deleteAssessmentSource(parentCtx, artifact.fileId);
  expect(await activeEvidenceFor(result.id)).toHaveLength(0);
  expect(queue.add).toHaveBeenCalledWith(expect.objectContaining({ type: "PROFILE_REBUILD" }));
  expect(await activeSharesFor(report.id)).toHaveLength(0);
});
```

- [ ] **Step 2: 实现删除规则**

删除原始评估图片或结果时撤销相关 evidence、撤销依赖报告分享并投递画像/报告重建。删除孩子先写 `deletedAt` 和 `purgeAfter=now+30d`，立即禁止业务访问；恢复时清除两字段；到期 Worker 删除 COS 文件与敏感正文，只保留匿名化审计事件。

- [ ] **Step 3: 运行隐私测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- deletion-service && pnpm --filter @lightning-tiger/worker test -- privacy-cleanup`

Expected: PASS。

```bash
git add packages/server/src/privacy packages/worker/src/processors/privacy-cleanup.ts packages/admin/src/app/api/v2/privacy
git commit -m "feat(privacy): add evidence-aware deletion lifecycle"
```

## Task 17：部署、监控、迁移和 V2.1 验收

**Files:**
- Modify: `packages/admin/Dockerfile`
- Create: `packages/worker/Dockerfile`
- Modify: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Modify: `nginx.conf`
- Modify: `.github/workflows/ci.yml`
- Modify: `packages/admin/.env.example`
- Create: `scripts/release-v2.ps1`
- Create: `scripts/rollback-v2.ps1`
- Create: `docs/runbooks/v2-1-deploy.md`
- Test: `packages/server/src/__tests__/v2-1-acceptance.test.ts`

- [ ] **Step 1: 写 V2.1 端到端验收测试**

测试使用真实测试 PostgreSQL 和 Redis、微信/COS/模型替身，覆盖：微信登录；两个孩子创建与切换；跨家庭 403；学习风格评估；错题任务成功和失败重试；画像版本递增；PDF 脱敏；分享过期/撤销；删除后证据撤销。

- [ ] **Step 2: 修正发布职责**

Admin/Worker 镜像只启动进程，Docker `CMD` 不执行 migration。开发 compose 可启动本地 PostgreSQL/Redis；`docker-compose.prod.yml` 只启动 admin/worker 并通过 `DATABASE_URL`、`REDIS_URL` 连接腾讯云资源。`scripts/release-v2.ps1` 依次执行冻结安装、全套检查、对空临时库 `migrate deploy`、构建两个镜像、显式目标库 migration、健康检查、切流；任一步失败则不切流。

- [ ] **Step 3: 配置健康和结构化日志**

Admin `/api/health/ready` 检查 PostgreSQL、Redis、COS 配置；Worker 每 30 秒写 heartbeat。日志包含 requestId、userId、childId、jobId 或 modelCallId，不含密钥、系统提示词、原始证件/错题正文。

`packages/admin/.env.example` 明确列出 `DATABASE_URL`、`REDIS_URL`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`、`MODEL_KEY_ENCRYPTION_KEY`、`PUBLIC_API_BASE_URL`，只写说明性空值，不提交真实腾讯云凭证。

- [ ] **Step 4: 执行全量验证**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm --filter @lightning-tiger/server exec prisma migrate deploy && pnpm build:admin && pnpm build:worker && pnpm build:weapp`

Expected: 所有命令退出码 0。

- [ ] **Step 5: 执行 V2.1 人工真机验收**

在微信开发者工具与至少一台 iOS、一台 Android 上验证：微信授权、1/9 张图片上传、切后台任务恢复、弱网重试、四栏无遮挡、多孩子只能在“我的”切换、PDF 下载与过期分享。将截图、requestId 和任务 ID 记录到发布单。

- [ ] **Step 6: 验证首次基线切换和回滚**

首次 V2.1 不在 V1 数据库原地替换表，而是在新的 `lightning_tiger_v2` 数据库或独立 schema 执行基线；切流前 V1 继续连接旧库。由于已确认旧库无生产数据，切流失败时可在 Beta 开放前把流量和连接一起退回 V1；开始接收 V2 真实数据后，禁止回退到不识别 V2 schema 的 V1 镜像，只能切换到上一份 schema 兼容的 V2.1 镜像或进入维护模式。`rollback-v2.ps1` 必须校验目标镜像声明的 schema compatibility，不能执行数据库 down migration。

- [ ] **Step 7: 提交发布能力**

```bash
git add packages/admin/Dockerfile packages/worker/Dockerfile docker-compose.yml nginx.conf .github/workflows/ci.yml scripts docs/runbooks/v2-1-deploy.md packages/server/src/__tests__/v2-1-acceptance.test.ts
git commit -m "chore(release): make v2.1 independently deployable"
```

## V2.1 完成定义

- 自动化检查、空库迁移、Admin/Worker/小程序构建全部通过。
- 新用户不使用手机号密码即可登录；纯老师入口不强制建孩子。
- 每个家庭最多 5 个孩子，activeChild 只能在“我的”切换，服务端每次校验所属关系。
- 两项评估互相独立，任何一项完成即可生成画像和报告；失败不生成虚假证据。
- PDF 脱敏、限时、可撤销，COS 密钥与签名 URL 不落客户端持久存储。
- 数据库 `AsyncJob` 在 Redis 丢失后仍可恢复，所有模型成功/失败调用进入全局成本账本。
- 不存在错题本、语音、在线购买、支付、会员、提现或 RBAC 功能入口。
- 预发布完成发布与旧镜像回滚验证，真机验收证据归档。
