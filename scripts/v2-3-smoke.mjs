#!/usr/bin/env node
/**
 * V2.3 部署前冒烟脚本（smoke）
 *
 * 触发：CI deploy job 第一步；失败则阻止发布。
 * 职责：
 *  1. 校验 schema 契约（所有 V2.3 新模型和枚举存在）
 *  2. 校验服务可实例化（ApplicationService, RecommendationService, TrialService, GrantService, FeedbackService, ReviewService, AuditService）
 *  3. 校验试听状态机转换正确
 *  4. 校验推荐评分确定性（相同输入相同输出）
 *
 * 不写入任何真实数据。所有检查均在内存中完成。
 */
import { Prisma } from "@prisma/client";
import {
  ApplicationService,
  AuditService as TeacherAuditService,
  RecommendationService,
  TrialService,
  GrantService,
  FeedbackService,
  ReviewService,
  transition,
  hardFilter,
  scoreCompatibility,
} from "@lightning-tiger/server";

const failures = [];
const passes = [];

function check(name, fn) {
  try {
    const ok = fn();
    if (ok !== false) {
      passes.push(name);
      console.log(`[PASS] ${name}`);
    } else {
      failures.push({ name, reason: "returned false" });
      console.error(`[FAIL] ${name}`);
    }
  } catch (e) {
    failures.push({ name, reason: String(e) });
    console.error(`[FAIL] ${name}:`, e && e.message ? e.message : e);
  }
}

async function checkAsync(name, fn) {
  try {
    const ok = await fn();
    if (ok !== false) {
      passes.push(name);
      console.log(`[PASS] ${name}`);
    } else {
      failures.push({ name, reason: "returned false" });
      console.error(`[FAIL] ${name}`);
    }
  } catch (e) {
    failures.push({ name, reason: String(e) });
    console.error(`[FAIL] ${name}:`, e && e.message ? e.message : e);
  }
}

// ─── 1. schema 契约 ──────────────────────────────────────────

check("schema 包含 V2.3 真人家教闭环模型", () => {
  const names = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const required = [
    "TeacherApplication", "TeacherQualification", "TeacherAuditRecord", "TeacherProfile",
    "TeacherAvailabilityRule", "TeacherAvailabilityException", "ScheduleReservation",
    "TrialBooking", "BookingChange", "Lesson", "TeacherFeedback", "ParentReview", "DataGrant",
  ];
  for (const name of required) {
    if (!names.includes(name)) {
      throw new Error(`missing model: ${name}`);
    }
  }
  return true;
});

check("schema 包含 V2.3 枚举", () => {
  const enums = Prisma.dmmf.datamodel.enums.map((e) => e.name);
  const required = [
    "TeacherApplicationStatus", "QualificationType", "QualificationReviewStatus",
    "TeacherServiceStatus", "TeachingMode", "ScheduleSourceType",
    "TrialBookingStatus", "LessonStatus", "DataGrantScope", "FeedbackPerformance",
  ];
  for (const name of required) {
    if (!enums.includes(name)) {
      throw new Error(`missing enum: ${name}`);
    }
  }
  return true;
});

check("schema 不包含支付/订单/佣金模型", () => {
  const names = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const forbidden = ["Order", "Membership", "Withdrawal", "Payment", "Commission", "Wallet"];
  for (const name of forbidden) {
    if (names.includes(name)) {
      throw new Error(`forbidden model found: ${name}`);
    }
  }
  return true;
});

check("TrialBooking 有幂等键和版本", () => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "TrialBooking");
  if (!model) throw new Error("TrialBooking model not found");
  const fields = model.fields.map((f) => f.name);
  if (!fields.includes("idempotencyKey")) throw new Error("missing idempotencyKey");
  if (!fields.includes("version")) throw new Error("missing version");
  return true;
});

check("TeacherFeedback 有 isCurrent 和 supersedesId 版本化字段", () => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "TeacherFeedback");
  if (!model) throw new Error("TeacherFeedback model not found");
  const fields = model.fields.map((f) => f.name);
  if (!fields.includes("isCurrent")) throw new Error("missing isCurrent");
  if (!fields.includes("supersedesId")) throw new Error("missing supersedesId");
  if (!fields.includes("sequence")) throw new Error("missing sequence");
  return true;
});

check("ParentReview 有 lessonId 唯一约束（每个 lesson 只有一个评价）", () => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "ParentReview");
  if (!model) throw new Error("ParentReview model not found");
  const lessonField = model.fields.find((f) => f.name === "lessonId");
  if (!lessonField) throw new Error("missing lessonId");
  if (!lessonField.isUnique) throw new Error("lessonId is not unique");
  return true;
});

// ─── 2. 服务可实例化 ─────────────────────────────────────────

check("V2.3 服务均可实例化（无 DB 依赖）", () => {
  new ApplicationService();
  new TeacherAuditService();
  new RecommendationService();
  new TrialService();
  new GrantService();
  new FeedbackService();
  new ReviewService();
  return true;
});

// ─── 3. 试听状态机转换 ───────────────────────────────────────

check("试听状态机：REQUESTED → ACCEPTED → PARENT_CONFIRMED → READY → COMPLETED", () => {
  if (transition("REQUESTED", "ACCEPT") !== "ACCEPTED") throw new Error("REQUESTED + ACCEPT failed");
  if (transition("ACCEPTED", "PARENT_CONFIRM") !== "PARENT_CONFIRMED") throw new Error("ACCEPTED + PARENT_CONFIRM failed");
  if (transition("PARENT_CONFIRMED", "MARK_READY") !== "READY") throw new Error("PARENT_CONFIRMED + MARK_READY failed");
  if (transition("READY", "COMPLETE") !== "COMPLETED") throw new Error("READY + COMPLETE failed");
  return true;
});

check("试听状态机：终态不接受任何事件", () => {
  let threw = false;
  try { transition("COMPLETED", "ACCEPT"); } catch { threw = true; }
  if (!threw) throw new Error("COMPLETED + ACCEPT should throw");
  threw = false;
  try { transition("REJECTED", "ACCEPT"); } catch { threw = true; }
  if (!threw) throw new Error("REJECTED + ACCEPT should throw");
  threw = false;
  try { transition("CANCELLED", "ACCEPT"); } catch { threw = true; }
  if (!threw) throw new Error("CANCELLED + ACCEPT should throw");
  return true;
});

check("试听状态机：CANCEL 对任何非终态合法", () => {
  if (transition("REQUESTED", "CANCEL") !== "CANCELLED") throw new Error("REQUESTED + CANCEL failed");
  if (transition("ACCEPTED", "CANCEL") !== "CANCELLED") throw new Error("ACCEPTED + CANCEL failed");
  if (transition("READY", "CANCEL") !== "CANCELLED") throw new Error("READY + CANCEL failed");
  return true;
});

// ─── 4. 推荐评分确定性 ───────────────────────────────────────

check("推荐评分确定性：相同输入产生相同输出", () => {
  // 构造确定性输入：teacher + request + hasScheduleFit
  const teacher = {
    id: "t1",
    displayName: "张老师",
    subjects: ["MATH"],
    schoolStages: ["PRIMARY"],
    teachingModes: ["ONLINE"],
    serviceAreaCodes: ["110000"],
    teachingTags: ["分步讲解"],
    experienceYears: 10,
    pricePerHour: 200,
    serviceStatus: "ACTIVE",
  };
  const request = {
    child: {
      childId: "c1",
      grade: "G6",
      schoolStage: "PRIMARY",
      subject: "MATH",
      weakKnowledgePoints: ["分数"],
      learningGoals: ["提高计算能力"],
      teachingPreferences: ["分步讲解"],
      serviceAreaCode: "110000",
    },
    preferredMode: "ONLINE",
    budgetMaxPerHour: 250,
  };
  const a = scoreCompatibility(teacher, request, true);
  const b = scoreCompatibility(teacher, request, true);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`score not deterministic: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  if (a.total <= 0) {
    throw new Error(`expected positive score, got ${a.total}`);
  }
  return true;
});

check("推荐硬筛选：剔除非 ACTIVE / 不匹配 subject / schoolStage", () => {
  const child = {
    childId: "c1",
    grade: "G6",
    schoolStage: "PRIMARY",
    subject: "MATH",
    weakKnowledgePoints: [],
    learningGoals: [],
    teachingPreferences: [],
    serviceAreaCode: null,
  };
  const candidates = [
    { id: "t1", displayName: "A", subjects: ["MATH"], schoolStages: ["PRIMARY"], teachingModes: ["ONLINE"], serviceAreaCodes: [], teachingTags: [], experienceYears: 5, pricePerHour: 200, serviceStatus: "ACTIVE" },
    { id: "t2", displayName: "B", subjects: ["MATH"], schoolStages: ["PRIMARY"], teachingModes: ["ONLINE"], serviceAreaCodes: [], teachingTags: [], experienceYears: 3, pricePerHour: 150, serviceStatus: "PAUSED" },
    { id: "t3", displayName: "C", subjects: ["CHINESE"], schoolStages: ["PRIMARY"], teachingModes: ["ONLINE"], serviceAreaCodes: [], teachingTags: [], experienceYears: 8, pricePerHour: 180, serviceStatus: "ACTIVE" },
  ];
  const filtered = hardFilter(candidates, { child });
  if (filtered.length !== 1 || filtered[0].id !== "t1") {
    throw new Error(`expected only t1, got ${JSON.stringify(filtered.map((c) => c.id))}`);
  }
  return true;
});

// ─── 汇总输出 ────────────────────────────────────────────────

console.log(`\n=== V2.3 Smoke Summary: ${passes.length} passed, ${failures.length} failed ===`);
if (failures.length) {
  for (const f of failures) {
    console.error("  FAIL:", f.name, "—", f.reason);
  }
  process.exit(1);
}
console.log("All V2.3 smoke checks passed.");
process.exit(0);
