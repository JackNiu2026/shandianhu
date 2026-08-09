# 闪电虎 V2.3 真人家教闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同一微信小程序内交付真实老师入驻、审核、画像推荐、试听排期、课程反馈、家长评价和学习画像回流的真人家教闭环。

**Architecture:** 同一 `User` 可拥有家长和老师身份，但每个请求携带明确 workspace/role，领域服务同时校验角色、服务关系和 DataGrant。推荐使用确定性规则并输出可解释原因；试听接受、改期和课程占位使用 PostgreSQL 事务与排他约束，通知、画像和报告更新复用 V2.1 Worker。

**Tech Stack:** V2.1/V2.2 技术栈、Prisma/PostgreSQL exclusion-safe scheduling、腾讯云 COS 私有资质文件、Taro 角色工作区

---

## 文件结构

- `packages/server/src/teachers/*`：申请、资质、审核、公开资料和角色激活。
- `packages/server/src/recommendations/*`：硬筛选、确定性评分和脱敏解释。
- `packages/server/src/scheduling/*`：周期可用时间、日期例外、试听/课程冲突。
- `packages/server/src/bookings/*`：试听状态机、改期历史和通知。
- `packages/server/src/grants/*`：家长授权、最小学习摘要和撤销。
- `packages/server/src/lessons/*`：课程完成、老师反馈、家长评价和证据回流。
- `packages/admin/src/app/api/v2/teacher/*`：老师端薄适配 API。
- `packages/admin/src/app/api/v2/tutors/*`：家长推荐、浏览和试听 API。
- `packages/admin/src/app/(dashboard)/teachers/*`：申请与资质审核。
- `packages/admin/src/app/(dashboard)/academics/*`：试听、排期、课程、反馈和评价。
- `packages/mobile/src/pages/teacher-*/*`：老师工作区。
- `packages/mobile/src/pages/tutors/*`、`tutor-detail/*`、`trial-booking/*`：家长真人家教流程。
- `packages/shared/api/human-tutoring.ts`：角色、状态和 DTO。

## Task 1：扩展 V2.3 老师、排期、授权和课程 schema

**Files:**
- Modify: `packages/server/prisma/schema.prisma`
- Create: `packages/server/prisma/migrations/20260809150000_v2_3_human_tutoring/migration.sql`
- Create: `packages/shared/api/human-tutoring.ts`
- Modify: `packages/shared/api/index.ts`
- Test: `packages/server/src/__tests__/v2-3-schema.contract.test.ts`

- [ ] **Step 1: 写 schema 失败契约**

```ts
it("contains the human tutor closed-loop entities", () => {
  const names = Prisma.dmmf.datamodel.models.map((model) => model.name);
  expect(names).toEqual(expect.arrayContaining([
    "TeacherApplication", "TeacherQualification", "TeacherAuditRecord", "TeacherProfile",
    "TeacherAvailabilityRule", "TeacherAvailabilityException", "ScheduleReservation", "TrialBooking", "BookingChange",
    "Lesson", "TeacherFeedback", "ParentReview", "DataGrant"
  ]));
});
```

- [ ] **Step 2: 添加审核与公开资料模型**

```prisma
model TeacherApplication {
  id             String @id @default(cuid())
  userId         String
  status         TeacherApplicationStatus @default(DRAFT)
  legalName      String
  education      String?
  subjects       Subject[]
  schoolStages   SchoolStage[]
  experienceYears Int?
  pricePerHour   Int?
  version        Int @default(0)
  submittedAt    DateTime?
  qualifications TeacherQualification[]
  auditRecords   TeacherAuditRecord[]
  @@index([userId, status])
}

model TeacherQualification {
  id             String @id @default(cuid())
  applicationId  String
  type           QualificationType
  fileObjectId   String
  reviewStatus   QualificationReviewStatus @default(PENDING)
  reviewReason   String?
  @@unique([applicationId, type, fileObjectId])
}

model TeacherProfile {
  id             String @id @default(cuid())
  userId         String @unique
  applicationId  String @unique
  displayName    String
  bio            String
  subjects       Subject[]
  schoolStages   SchoolStage[]
  teachingModes  TeachingMode[]
  serviceAreaCodes String[]
  teachingTags   String[]
  experienceYears Int
  pricePerHour   Int
  serviceStatus  TeacherServiceStatus @default(ACTIVE)
  version        Int @default(0)
}
```

该 migration 同时为 `ParentProfile` 增加可选 `serviceAreaCode String?`；只有选择上门授课时才参与距离/区域筛选，线上授课不要求地址。

- [ ] **Step 3: 添加排期、授权和课程模型**

```prisma
model TrialBooking {
  id               String @id @default(cuid())
  idempotencyKey   String
  parentProfileId  String
  childId          String
  teacherProfileId String
  subject          Subject
  startsAt         DateTime
  endsAt           DateTime
  status           TrialBookingStatus @default(REQUESTED)
  version          Int @default(0)
  changes          BookingChange[]
  lesson           Lesson?
  @@unique([parentProfileId, idempotencyKey])
  @@index([teacherProfileId, startsAt, endsAt])
}

model ScheduleReservation {
  id               String @id @default(cuid())
  teacherProfileId String
  sourceType       ScheduleSourceType
  sourceId         String
  startsAt         DateTime
  endsAt           DateTime
  active           Boolean @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@unique([sourceType, sourceId])
  @@index([teacherProfileId, startsAt, endsAt])
}

model Lesson {
  id               String @id @default(cuid())
  trialBookingId   String? @unique
  childId          String
  teacherProfileId String
  subject          Subject
  startsAt         DateTime
  endsAt           DateTime
  status           LessonStatus @default(SCHEDULED)
  feedbackVersions TeacherFeedback[]
  review           ParentReview?
  @@index([teacherProfileId, startsAt, endsAt])
}

model DataGrant {
  id               String @id @default(cuid())
  parentProfileId  String
  childId          String
  teacherProfileId String
  scopes           DataGrantScope[]
  validFrom        DateTime
  validUntil       DateTime?
  revokedAt        DateTime?
  sourceBookingId  String?
  @@index([teacherProfileId, childId, revokedAt])
}
```

`TeacherFeedback` 使用 `(lessonId,sequence)` 唯一约束、`supersedesId` 自关联和 `isCurrent` 标记保留修订历史；migration 用部分唯一索引 `CREATE UNIQUE INDEX ... ON "TeacherFeedback" ("lessonId") WHERE "isCurrent" = true` 保证同一 lesson 只有一个 current 版本。补充 AvailabilityRule/Exception、BookingChange、ParentReview 的外键和唯一约束；任何实体都不出现收入、佣金、支付、订单、提现字段。

- [ ] **Step 4: 定义状态 DTO**

```ts
export type TeacherApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_MORE_INFO"
  | "APPROVED" | "PAUSED" | "BANNED";

export type TrialBookingStatus =
  | "REQUESTED" | "ACCEPTED" | "RESCHEDULE_PROPOSED" | "REJECTED"
  | "PARENT_CONFIRMED" | "READY" | "COMPLETED" | "CANCELLED";
```

- [ ] **Step 5: 验证 migration 并提交**

Run: `pnpm --filter @lightning-tiger/server exec prisma migrate deploy && pnpm --filter @lightning-tiger/server prisma:generate && pnpm --filter @lightning-tiger/server test -- v2-3-schema.contract`

Expected: PASS。

```bash
git add packages/server/prisma packages/shared/api
git commit -m "feat(db): add v2.3 human tutoring schema"
```

## Task 2：老师自主申请与私有资质材料

**Files:**
- Create: `packages/server/src/teachers/application-service.ts`
- Create: `packages/server/src/teachers/qualification-service.ts`
- Create: `packages/admin/src/app/api/v2/teacher/application/route.ts`
- Create: `packages/admin/src/app/api/v2/teacher/application/submit/route.ts`
- Create: `packages/mobile/src/pages/teacher-apply/index.tsx`
- Create: `packages/mobile/src/pages/teacher-apply/index.scss`
- Test: `packages/server/src/teachers/application-service.test.ts`

- [ ] **Step 1: 写纯老师无需孩子和提交校验失败测试**

```ts
it("allows an account workspace without ParentProfile to draft an application", async () => {
  const application = await service.getOrCreateDraft(accountCtx);
  expect(application.userId).toBe(user.id);
  expect(await db.parentProfile.findUnique({ where: { userId: user.id } })).toBeNull();
});

it("rejects submission without required qualifications", async () => {
  await expect(service.submit(incomplete.id, userOnlyCtx))
    .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});
```

- [ ] **Step 2: 实现申请状态机**

DRAFT 可编辑；SUBMITTED/UNDER_REVIEW 只读；NEEDS_MORE_INFO 可补材料后重新提交；APPROVED 后原申请不可改；PAUSED/BANNED 只由管理员操作。提交必须包含实名、学历、至少一科/学段、经历、价格、可授课方式、身份证明和学历证明。

- [ ] **Step 3: 复用 COS 私有文件规则**

资质文件 purpose 为 `TEACHER_QUALIFICATION`，只允许申请者本人和 superadmin 获取 5 分钟签名，公开资料永不返回文件对象或 URL。前台只展示管理员核验结论。

- [ ] **Step 4: 实现小程序申请页**

登录页和无孩子“我的”保留次级“老师入驻”；分步保存草稿，上传状态可恢复，提交后展示审核状态。申请流程不创建虚假孩子或家长资料。

- [ ] **Step 5: 运行测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- application-service && pnpm --filter mobile typecheck`

Expected: PASS。

```bash
git add packages/server/src/teachers packages/admin/src/app/api/v2/teacher/application packages/mobile/src/pages/teacher-apply
git commit -m "feat(teacher): add self-service application and qualifications"
```

## Task 3：管理员逐项审核、补材料、通过和停用

**Files:**
- Create: `packages/server/src/teachers/audit-service.ts`
- Create: `packages/admin/src/app/api/v2/admin/teacher-applications/route.ts`
- Create: `packages/admin/src/app/api/v2/admin/teacher-applications/[id]/route.ts`
- Create: `packages/admin/src/app/api/v2/admin/teacher-applications/[id]/review/route.ts`
- Create: `packages/admin/src/app/(dashboard)/teachers/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/teachers/[id]/page.tsx`
- Test: `packages/server/src/teachers/audit-service.test.ts`

- [ ] **Step 1: 写审核与公开字段失败测试**

```ts
it("cannot approve while any required qualification is unverified", async () => {
  await expect(audit.approve(application.id, adminCtx))
    .rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
});

it("publishes only approved public fields", async () => {
  const profile = await audit.approve(verified.id, adminCtx);
  expect(JSON.stringify(profile)).not.toContain(verified.legalName);
  expect(JSON.stringify(profile)).not.toContain(qualification.fileObjectId);
});
```

- [ ] **Step 2: 实现逐项审核记录**

每项材料保存 PASS/FAIL、原因、管理员、时间；补材料必须提供家长可读原因并发站内通知。全部必需项 PASS 后方可 APPROVED，并在同一事务创建/更新 TeacherProfile 与老师角色。

- [ ] **Step 3: 实现暂停和封禁**

PAUSED 暂停新推荐/新预约但保留已确认课程；BANNED 禁止老师工作区写操作并由管理员处理存量课程。每次变更写 TeacherAuditRecord 和 AuditLog。

- [ ] **Step 4: 运行审核测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- audit-service && pnpm --filter admin build`

Expected: PASS。

```bash
git add packages/server/src/teachers packages/admin/src/app/api/v2/admin/teacher-applications "packages/admin/src/app/(dashboard)/teachers"
git commit -m "feat(admin): review and publish verified teachers"
```

## Task 4：明确角色上下文与老师工作区切换

**Files:**
- Modify: `packages/server/src/auth/role-context.ts`
- Modify: `packages/mobile/src/store/index.tsx`
- Modify: `packages/mobile/src/pages/me/index.tsx`
- Create: `packages/mobile/src/components/WorkspaceSwitcher.tsx`
- Create: `packages/mobile/src/components/TeacherWorkspaceNav.tsx`
- Create: `packages/mobile/src/components/TeacherWorkspaceNav.scss`
- Create: `packages/mobile/src/config/workspaces.ts`
- Modify: `packages/mobile/src/app.config.ts`
- Test: `packages/server/src/auth/role-context.test.ts`
- Test: `packages/mobile/src/__tests__/workspace-navigation.test.ts`

- [ ] **Step 1: 写角色混用失败测试**

```ts
it("does not authorize a parent request with teacher context", async () => {
  await expect(resolveRoleContext(session, "teacher", { childId: child.id }))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("shows switching only to approved teachers", () => {
  expect(workspacesFor(parentOnly)).toEqual(["parent"]);
  expect(workspacesFor(parentAndApprovedTeacher)).toEqual(["parent", "teacher"]);
});
```

- [ ] **Step 2: 实现请求角色头**

小程序请求设置 `X-Workspace: parent|teacher`；服务端从会话解析 User 后再校验该身份存在且有效，不能信任 header 自报角色。后台管理员继续使用独立 AdminSession。

- [ ] **Step 3: 实现角色导航**

普通家长不弹角色选择；只有 APPROVED 且 ACTIVE 老师在“我的”看到工作区切换。家长继续使用 app.config 中 4 项原生 custom tabBar；老师页面不加入原生 tabBar，而是在每个老师页面底部渲染固定 `TeacherWorkspaceNav`，文案为 `工作 | 课程 | 学生 | 我的`，点击使用 `Taro.reLaunch`，避免微信 tabBar 最多 5 项限制和路由栈增长。家长进入老师工作区用 `reLaunch`，老师返回家长工作区用 `switchTab("/pages/me/index")`；切换清理敏感页面缓存但不更换微信会话。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- role-context && pnpm --filter mobile test -- workspace-navigation && pnpm --filter mobile build:weapp`

Expected: PASS。

```bash
git add packages/server/src/auth packages/mobile/src
git commit -m "feat(auth): separate parent and teacher workspaces"
```

## Task 5：确定性可解释推荐

**Files:**
- Create: `packages/server/src/recommendations/types.ts`
- Create: `packages/server/src/recommendations/score.ts`
- Create: `packages/server/src/recommendations/recommendation-service.ts`
- Create: `packages/admin/src/app/api/v2/tutors/recommendations/route.ts`
- Create: `packages/admin/src/app/api/v2/tutors/route.ts`
- Test: `packages/server/src/recommendations/score.test.ts`
- Test: `packages/server/src/recommendations/recommendation-service.test.ts`

- [ ] **Step 1: 写硬条件和解释失败测试**

```ts
it("filters hard constraints before ranking", () => {
  const result = rankTeachers(childProfile, [wrongStage, inactive, matching], request);
  expect(result.map((item) => item.teacherId)).toEqual([matching.id]);
});

it("does not expose MBTI or sensitive profile labels", () => {
  const [result] = rankTeachers(childProfile, [matching], request);
  expect(result.reasons.join(" ")).not.toMatch(/MBTI|INTJ|心理|诊断/);
});
```

- [ ] **Step 2: 实现硬筛选**

先按 ACTIVE、科目、学段、请求时间存在可用段过滤；再按授课方式、预算上限、经验下限和可选距离过滤。家长可清除软筛选并浏览所有满足硬条件老师。

- [ ] **Step 3: 实现可复算评分**

```ts
export function scoreCompatibility(input: RecommendationInput): ScoreBreakdown {
  return {
    schedule: input.scheduleFit ? 25 : 0,
    mode: input.modeFit ? 15 : 0,
    budget: Math.max(0, 15 - input.budgetDistance * 3),
    experience: Math.min(15, input.experienceYears * 2),
    teachingFit: overlap(input.teacherTags, input.safeLearningNeeds) * 10,
    subjectNeed: overlap(input.teacherStrengths, input.weakKnowledgePoints) * 10
  };
}
```

返回前三条非敏感具体原因，例如“擅长分步讲解”“本周六下午可试听”“覆盖当前数学薄弱知识点”，不展示原始画像 JSON、MBTI 代码或统一总分标签。

- [ ] **Step 4: 运行推荐测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- score recommendation-service`

Expected: PASS，相同输入排序稳定，分数相同时按审核时间再按 id。

```bash
git add packages/server/src/recommendations packages/admin/src/app/api/v2/tutors
git commit -m "feat(match): add deterministic explainable teacher recommendations"
```

## Task 6：可授课时间、例外和时区规则

**Files:**
- Create: `packages/server/src/scheduling/availability-service.ts`
- Create: `packages/server/src/scheduling/slot-service.ts`
- Create: `packages/admin/src/app/api/v2/teacher/availability/route.ts`
- Create: `packages/mobile/src/pages/teacher-schedule/index.tsx`
- Create: `packages/mobile/src/pages/teacher-schedule/index.scss`
- Test: `packages/server/src/scheduling/availability-service.test.ts`

- [ ] **Step 1: 写周期规则、例外和边界失败测试**

```ts
it("applies date exceptions over weekly availability", async () => {
  await availability.setWeekly(teacher.id, [{ weekday: 6, startMinute: 540, endMinute: 720 }]);
  await availability.setException(teacher.id, "2026-08-15", "UNAVAILABLE", 540, 720);
  expect(await slots.list(teacher.id, "2026-08-15", "Asia/Shanghai")).toEqual([]);
});
```

- [ ] **Step 2: 实现北京时间规则**

持久时间使用 UTC，周期规则使用 `Asia/Shanghai` weekday + minute-of-day；展示再转北京时间。end 必须大于 start，单段 30–240 分钟，同一天规则不可重叠；特定日期 AVAILABLE/UNAVAILABLE 例外优先于周期规则。

- [ ] **Step 3: 实现老师排期页**

支持按周编辑周期时间、添加停课/临时开放例外、查看试听和课程占用；冲突项明确标识且不能保存。使用时间选择器，不使用自由文本时间。

- [ ] **Step 4: 运行测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- availability-service && pnpm --filter mobile typecheck`

Expected: PASS，覆盖午夜、相邻不重叠、夏令时不适用和例外优先。

```bash
git add packages/server/src/scheduling packages/admin/src/app/api/v2/teacher/availability packages/mobile/src/pages/teacher-schedule
git commit -m "feat(schedule): manage teacher availability and exceptions"
```

## Task 7：试听申请、接受、拒绝和改期状态机

**Files:**
- Create: `packages/server/src/bookings/trial-state-machine.ts`
- Create: `packages/server/src/bookings/trial-service.ts`
- Create: `packages/server/src/bookings/contact-service.ts`
- Create: `packages/admin/src/app/api/v2/tutors/[id]/trials/route.ts`
- Create: `packages/admin/src/app/api/v2/teacher/trials/[id]/actions/route.ts`
- Create: `packages/admin/src/app/api/v2/auth/wechat-phone/route.ts`
- Create: `packages/mobile/src/components/PhoneAuthorizationButton.tsx`
- Create: `packages/mobile/src/pages/trial-booking/index.tsx`
- Create: `packages/mobile/src/pages/trial-booking/index.scss`
- Test: `packages/server/src/bookings/trial-state-machine.test.ts`

- [ ] **Step 1: 写合法转换和幂等失败测试**

```ts
it.each([
  ["REQUESTED", "ACCEPT", "ACCEPTED"],
  ["REQUESTED", "REJECT", "REJECTED"],
  ["REQUESTED", "PROPOSE_RESCHEDULE", "RESCHEDULE_PROPOSED"],
  ["ACCEPTED", "PROPOSE_RESCHEDULE", "RESCHEDULE_PROPOSED"],
  ["ACCEPTED", "PARENT_CONFIRM", "PARENT_CONFIRMED"],
  ["RESCHEDULE_PROPOSED", "PARENT_CONFIRM", "PARENT_CONFIRMED"],
  ["PARENT_CONFIRMED", "MARK_READY", "READY"],
  ["READY", "COMPLETE", "COMPLETED"]
])("transitions %s with %s to %s", (from, event, to) => {
  expect(transition(from, event)).toBe(to);
});
```

- [ ] **Step 2: 实现申请和动作权限**

家长只能为 activeChild 向 ACTIVE 老师提交未来可用时段，`(parentId,idempotencyKey)` 幂等。仅该老师可接受、拒绝、建议改期；仅该家长可确认或取消。接受或建议改期时创建/移动统一日程占位，冲突立即返回 `RESOURCE_CONFLICT`；拒绝/取消释放占位。每次变化追加 BookingChange，旧历史不覆盖。

- [ ] **Step 3: 实现站内通知**

申请、接受、拒绝、建议改期、家长确认、取消和完成都创建 Notification，目标路由按 workspace 区分；只在小程序内显示，不调用微信订阅消息。

- [ ] **Step 4: 仅在确认联系时获取微信手机号**

首次确认试听且 `User.phone` 为空时显示 `PhoneAuthorizationButton`，将 `getPhoneNumber` 返回的一次性 code 发送服务端并通过微信接口换取手机号；登录、建档、评估、AI 辅导和老师申请均不得要求手机号。手机号只向存在已确认试听和有效 DataGrant 的对应老师提供，授权撤销后不再返回。

- [ ] **Step 5: 运行状态机测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- trial-state-machine trial-service`

Expected: PASS。

```bash
git add packages/server/src/bookings packages/admin/src/app/api/v2/tutors packages/admin/src/app/api/v2/teacher/trials packages/admin/src/app/api/v2/auth/wechat-phone packages/mobile/src/pages/trial-booking packages/mobile/src/components/PhoneAuthorizationButton.tsx
git commit -m "feat(trials): add auditable booking state machine"
```

## Task 8：事务化排期冲突控制和课程创建

**Files:**
- Create: `packages/server/src/scheduling/conflict-service.ts`
- Modify: `packages/server/src/bookings/trial-service.ts`
- Create: `packages/server/src/lessons/lesson-service.ts`
- Test: `packages/server/src/scheduling/conflict-service.integration.test.ts`

- [ ] **Step 1: 写并发占位失败测试**

```ts
it("allows only one of two concurrent teacher accepts for an overlapping slot", async () => {
  const results = await Promise.allSettled([
    trials.accept(teacherCtx, bookingA.id, bookingA.version),
    trials.accept(teacherCtx, bookingB.id, bookingB.version)
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
```

- [ ] **Step 2: 添加统一数据库范围冲突保护**

Migration 启用 `btree_gist`，在 `ScheduleReservation` 上建立 `teacherProfileId WITH =` + `tstzrange(startsAt,endsAt,'[)') WITH &&` 的排他约束，条件为 `WHERE (active = true)`。TrialBooking 和 Lesson 都不得自行判断跨表冲突，只能通过该占位表；相邻时段允许，任何重叠拒绝。

- [ ] **Step 3: 实现乐观版本和事务**

接受、建议改期和确认必须携带 version；事务验证 availability、exception、统一排他约束和当前状态。接受/建议改期创建或更新 TrialBooking 的 reservation；家长确认创建 Lesson 和限范围 DataGrant，并在同一事务把 reservation 的 source 从 TrialBooking 交接到 Lesson，不释放后重新抢占。唯一冲突统一映射 `RESOURCE_CONFLICT`，不泄露其他家庭信息。

- [ ] **Step 4: 运行真实 PostgreSQL 集成测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- conflict-service.integration`

Expected: PASS，必须使用测试 PostgreSQL，不能用内存 mock 代替排他约束。

```bash
git add packages/server/prisma packages/server/src/scheduling packages/server/src/bookings packages/server/src/lessons
git commit -m "feat(schedule): prevent concurrent teacher booking conflicts"
```

## Task 9：最小范围 DataGrant 与老师学生摘要

**Files:**
- Create: `packages/server/src/grants/grant-service.ts`
- Create: `packages/server/src/grants/student-summary-service.ts`
- Create: `packages/admin/src/app/api/v2/grants/[id]/revoke/route.ts`
- Create: `packages/admin/src/app/api/v2/teacher/students/route.ts`
- Create: `packages/admin/src/app/api/v2/teacher/students/[childId]/route.ts`
- Create: `packages/mobile/src/pages/teacher-students/index.tsx`
- Create: `packages/mobile/src/pages/teacher-students/index.scss`
- Test: `packages/server/src/grants/grant-service.test.ts`

- [ ] **Step 1: 写服务关系、范围和撤销失败测试**

```ts
it("returns only granted learning summary fields", async () => {
  const summary = await grants.readStudentSummary(teacherCtx, child.id);
  expect(summary).toEqual({
    displayName: child.displayName,
    grade: child.grade,
    learningGoals: child.learningGoals,
    weakKnowledgePoints: expect.any(Array),
    teachingPreferences: expect.any(Array)
  });
  expect(summary).not.toHaveProperty("parentPhone");
  expect(summary).not.toHaveProperty("rawAssessment");
});
```

- [ ] **Step 2: 实现授权生命周期**

家长确认试听后创建 scopes=`BASIC_PROFILE,LEARNING_NEEDS`，有效期到服务结束后 7 天；家长可随时撤销。读取同时要求 ACTIVE 老师、该 child 的有效试听/课程关系、grant 未撤销未过期且 scope 包含所请求字段。

- [ ] **Step 3: 实现老师学生页**

列表只显示有效服务关系孩子；详情显示称呼、年级、目标、相关薄弱摘要和教学偏好，不显示 MBTI 标签、原始错题、完整 AI 对话、学校、家长手机号或其他学科无关信息。

- [ ] **Step 4: 运行越权测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- grant-service && pnpm --filter mobile typecheck`

Expected: PASS，覆盖其他老师、过期、撤销、暂停老师和无关系孩子。

```bash
git add packages/server/src/grants packages/admin/src/app/api/v2/grants packages/admin/src/app/api/v2/teacher/students packages/mobile/src/pages/teacher-students
git commit -m "feat(grants): expose minimum authorized student summaries"
```

## Task 10：老师工作台和课程列表

**Files:**
- Create: `packages/mobile/src/pages/teacher-work/index.tsx`
- Create: `packages/mobile/src/pages/teacher-work/index.scss`
- Create: `packages/mobile/src/pages/teacher-lessons/index.tsx`
- Create: `packages/mobile/src/pages/teacher-lessons/index.scss`
- Create: `packages/mobile/src/pages/teacher-me/index.tsx`
- Create: `packages/mobile/src/pages/teacher-me/index.scss`
- Create: `packages/admin/src/app/api/v2/teacher/dashboard/route.ts`
- Modify: `packages/mobile/src/components/TeacherWorkspaceNav.tsx`
- Test: `packages/server/src/teachers/dashboard-service.test.ts`

- [ ] **Step 1: 写工作台待办聚合失败测试**

```ts
it("returns only the current teacher's actionable items", async () => {
  const result = await dashboard.load(teacherCtx);
  expect(result.pendingTrials.every((item) => item.teacherProfileId === teacher.id)).toBe(true);
  expect(result.lessonsAwaitingFeedback.every((item) => item.teacherProfileId === teacher.id)).toBe(true);
});
```

- [ ] **Step 2: 实现四个老师 tab**

`工作` 聚合待处理试听、待反馈课程、审核通知；`课程` 展示日程、可用时间、改期和课程状态；`学生` 使用 Task 9 授权摘要；`我的` 展示申请进度、公开资料、工作区切换和设置。每页复用 `TeacherWorkspaceNav`，导航尺寸固定，文案为两个汉字。

- [ ] **Step 3: 实现状态恢复**

老师被暂停/封禁或授权撤销时，当前页面下一次请求返回稳定错误码并回“我的”状态页；客户端不继续显示缓存的学生敏感摘要。

- [ ] **Step 4: 构建并提交**

Run: `pnpm --filter @lightning-tiger/server test -- dashboard-service && pnpm --filter mobile build:weapp`

Expected: PASS。

```bash
git add packages/mobile/src/pages/teacher-* packages/mobile/src/components/TeacherWorkspaceNav.* packages/admin/src/app/api/v2/teacher/dashboard packages/server/src/teachers
git commit -m "feat(teacher): add role-specific work lesson and student tabs"
```

## Task 11：课程完成与结构化老师反馈

**Files:**
- Create: `packages/server/src/lessons/feedback-schema.ts`
- Create: `packages/server/src/lessons/feedback-service.ts`
- Create: `packages/admin/src/app/api/v2/teacher/lessons/[id]/complete/route.ts`
- Create: `packages/admin/src/app/api/v2/teacher/lessons/[id]/feedback/route.ts`
- Create: `packages/mobile/src/pages/teacher-feedback/index.tsx`
- Create: `packages/mobile/src/pages/teacher-feedback/index.scss`
- Test: `packages/server/src/lessons/feedback-service.test.ts`

- [ ] **Step 1: 写署名、幂等和不可篡改失败测试**

```ts
it("creates one signed evidence record for one lesson feedback", async () => {
  const first = await feedback.submit(teacherCtx, lesson.id, "feedback-op-1", validFeedback);
  const second = await feedback.submit(teacherCtx, lesson.id, "feedback-op-1", validFeedback);
  expect(second.id).toBe(first.id);
  expect(await evidenceFor(first.id)).toMatchObject({ sourceType: "TEACHER_FEEDBACK" });
});
```

- [ ] **Step 2: 定义结构化反馈**

```ts
export const teacherFeedbackSchema = z.object({
  lessonContent: z.array(z.string().min(1)).min(1).max(10),
  performance: z.enum(["STRONG", "STEADY", "NEEDS_SUPPORT"]),
  difficulties: z.array(z.string().min(1)).max(10),
  suggestions: z.array(z.string().min(1)).min(1).max(10),
  privateTeacherNote: z.string().max(1000).optional()
});
```

- [ ] **Step 3: 实现反馈与画像回流**

仅该课程老师可在课程结束后完成并提交一次反馈；修改必须创建修订版本和更正原因，不覆盖旧记录。家长不能直接编辑或单独删除。家长可申请更正；孩子整体删除按 V2.1 清理。公开字段写 LearningEvidence，privateTeacherNote 不进入画像。

- [ ] **Step 4: 投递画像和报告更新**

反馈成功在事务提交后投递 PROFILE_REBUILD、REPORT_BUILD 和站内通知；重复消费不重复 evidence。

- [ ] **Step 5: 运行测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- feedback-service && pnpm --filter mobile typecheck`

Expected: PASS。

```bash
git add packages/server/src/lessons packages/admin/src/app/api/v2/teacher/lessons packages/mobile/src/pages/teacher-feedback
git commit -m "feat(lessons): add signed feedback and profile evidence"
```

## Task 12：与已完成课程绑定的真实家长评价

**Files:**
- Create: `packages/server/src/lessons/review-service.ts`
- Create: `packages/admin/src/app/api/v2/lessons/[id]/review/route.ts`
- Create: `packages/mobile/src/pages/lesson-review/index.tsx`
- Create: `packages/mobile/src/pages/lesson-review/index.scss`
- Test: `packages/server/src/lessons/review-service.test.ts`

- [ ] **Step 1: 写真实性和唯一性失败测试**

```ts
it("rejects reviews without a completed lesson owned by the parent", async () => {
  await expect(reviews.create(otherParentCtx, completedLesson.id, input))
    .rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(reviews.create(parentCtx, scheduledLesson.id, input))
    .rejects.toMatchObject({ code: "RESOURCE_CONFLICT" });
});
```

- [ ] **Step 2: 实现真实评价**

每个 completed Lesson 仅一个 ParentReview，评分 1–5，正文 10–1000 字；author 从会话和课程关系推导，客户端不传作者/老师/家长 ID。公开展示仅家长称呼脱敏、评分、正文和课程月份。

- [ ] **Step 3: 运行测试并提交**

Run: `pnpm --filter @lightning-tiger/server test -- review-service && pnpm --filter mobile typecheck`

Expected: PASS。

```bash
git add packages/server/src/lessons/review-service.ts packages/admin/src/app/api/v2/lessons packages/mobile/src/pages/lesson-review
git commit -m "feat(reviews): bind parent reviews to completed lessons"
```

## Task 13：家长家教页面、老师详情和试听状态

**Files:**
- Modify: `packages/mobile/src/pages/tutors/index.tsx`
- Modify: `packages/mobile/src/pages/tutors/index.scss`
- Create: `packages/mobile/src/pages/tutor-detail/index.tsx`
- Create: `packages/mobile/src/pages/tutor-detail/index.scss`
- Create: `packages/mobile/src/pages/trial-status/index.tsx`
- Create: `packages/mobile/src/pages/trial-status/index.scss`
- Modify: `packages/mobile/src/pages/me/index.tsx`
- Test: `packages/mobile/src/__tests__/human-tutoring-flow.test.tsx`

- [ ] **Step 1: 写家长流程信息架构失败测试**

```ts
it("keeps matching in 家教 and booking history in 我的", () => {
  expect(readPage("tutors")).toContain("RecommendationReasons");
  expect(readPage("tutors")).not.toContain("ChildSwitcher");
  expect(readPage("me")).toContain("TrialAndLessonHistory");
});
```

- [ ] **Step 2: 实现家教列表与自主浏览**

默认展示画像推荐及具体原因，提供科目、授课方式、预算、经验、时间筛选；“浏览全部”只绕过软评分，不绕过科目/学段/ACTIVE 硬条件。老师卡展示核验结论，不展示证件或敏感画像。

- [ ] **Step 3: 实现详情与试听状态**

详情展示公开资料、适用科目/学段、方式、价格、可选时段和真实评价。试听状态页展示完整 BookingChange 时间线并提供当前角色允许的单一下一步。预约、课程、评价历史集中“我的”，不塞入学情页。

- [ ] **Step 4: 构建并提交**

Run: `pnpm --filter mobile test -- human-tutoring-flow && pnpm --filter mobile build:weapp`

Expected: PASS。

```bash
git add packages/mobile/src/pages/tutors packages/mobile/src/pages/tutor-detail packages/mobile/src/pages/trial-status packages/mobile/src/pages/me
git commit -m "feat(mobile): complete parent human tutoring journey"
```

## Task 14：教务后台、通知和无支付负向约束

**Files:**
- Modify: `packages/admin/src/components/dashboard/sidebar.tsx`
- Create: `packages/admin/src/app/(dashboard)/academics/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/academics/trials/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/academics/lessons/page.tsx`
- Create: `packages/admin/src/app/(dashboard)/academics/feedback/page.tsx`
- Test: `packages/admin/src/__tests__/no-payment-surface.test.ts`

- [ ] **Step 1: 写无支付/静态老师失败测试**

```ts
it("has no payment, membership, withdrawal or shared teacher fallback", () => {
  const files = allRuntimeSourceFiles();
  expect(files).not.toEqual(expect.arrayContaining([
    expect.stringMatching(/finance/), expect.stringMatching(/membership/),
    expect.stringMatching(/withdrawal/), expect.stringMatching(/shared[\\/]data[\\/]teachers/)
  ]));
});
```

- [ ] **Step 2: 实现教务页面**

教务管理按试听、排期、课程、反馈、评价组织；管理员可查看状态与关联 ID、处理异常和暂停服务，但不能代替老师伪造反馈、代替家长评价或绕过冲突强制确认。

- [ ] **Step 3: 清除旧商业化表面**

删除财务/会员/提现页面、API 和侧栏项；断言 V2.1 已删除的 shared 静态老师运行时降级没有重新出现。旧展示数据只可留在 `archive/`，生产 API 查询不到静态 fallback。确认 Prisma V2 baseline 已无 Order/Membership/Withdrawal。

- [ ] **Step 4: 测试构建并提交**

Run: `pnpm --filter admin test -- no-payment-surface && pnpm --filter admin build && pnpm --filter mobile build:weapp`

Expected: PASS。

```bash
git add packages/admin
git commit -m "feat(admin): add academics operations and remove payment surfaces"
```

## Task 15：V2.3 安全、部署、验收和回滚

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docker-compose.yml`
- Create: `docs/runbooks/v2-3-deploy.md`
- Create: `packages/server/src/__tests__/v2-3-acceptance.test.ts`
- Create: `packages/mobile/src/__tests__/v2-3-flow.test.tsx`

- [ ] **Step 1: 写完整真人闭环验收测试**

真实 PostgreSQL/Redis + COS 替身覆盖：纯老师无孩子申请；材料逐项审核/补充/通过；未通过不能切老师工作区；推荐硬筛选和脱敏原因；自主浏览；并发试听冲突；接受/拒绝/改期/确认；DataGrant 最小读取与撤销；课程完成；老师反馈唯一证据；真实评价；通知；画像和报告新版本。

- [ ] **Step 2: 写安全回归测试**

覆盖跨家庭 childId、非本老师 booking/lesson、无 grant/过期/revoked grant、暂停/封禁老师、公开 API 证件泄露、分享中老师私密笔记泄露、管理员敏感操作缺 AuditLog。所有拒绝使用稳定错误码。

- [ ] **Step 3: 执行全量自动验证**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm --filter @lightning-tiger/server exec prisma migrate deploy && pnpm build:admin && pnpm build:worker && pnpm build:weapp`

Expected: 所有命令退出码 0。

- [ ] **Step 4: 执行双角色真机验收**

使用三个微信测试号：纯家长、纯老师、家长+老师。验证不必要的角色弹窗不会出现、两套四栏切换、资质上传、审核通知、弱网预约、并发时段冲突、授权撤销后缓存清空、反馈和评价。确认全程无付款、课程包、会员、收入或提现入口。

- [ ] **Step 5: 验证回滚**

切回 V2.2 镜像后智学、学情、报告和家庭档案继续工作；V2.3 表保留但旧应用不读取。回滚前将新试听入口置为维护状态，已确认课程数据不删除；恢复 V2.3 后状态历史完整且不重复通知。

- [ ] **Step 6: 提交发布能力**

```bash
git add .github/workflows/ci.yml docker-compose.yml docs/runbooks/v2-3-deploy.md packages/server/src/__tests__/v2-3-acceptance.test.ts packages/mobile/src/__tests__/v2-3-flow.test.tsx
git commit -m "chore(release): make v2.3 human tutoring independently deployable"
```

## V2.3 完成定义

- 纯老师可不建孩子完成申请；只有逐项审核通过的真实老师才进入老师工作区和推荐结果。
- 家长端仍是“智学、家教、学情、我的”，老师端固定为“工作、课程、学生、我的”，请求身份不能混用。
- 推荐先硬筛选后确定性排序，原因可复算且不泄露 MBTI、敏感画像或统一标签。
- 试听接受/拒绝/改期/确认有不可覆盖历史；并发重叠时只有一个事务成功。
- 老师只在有效服务关系和 DataGrant 范围内读取必要摘要，家长撤销后立即失效。
- 反馈是老师署名、版本化服务记录，评价必须绑定真实已完成课程，二者不可由管理员伪造。
- 老师反馈进入 LearningEvidence 并产生新画像/报告版本，失败不写虚假证据。
- 生产运行时不存在静态老师降级、支付、课程包、退款、分账、会员、收入或提现功能。
- V2.1/V2.2 在 V2.3 发布和旧镜像回滚后保持可用。
