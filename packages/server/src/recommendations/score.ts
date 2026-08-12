/**
 * V2.3 确定性可解释推荐评分模块
 *
 * 本模块仅包含纯函数：
 * - hardFilter：在评分前剔除不满足硬条件的老师（与软评分解耦）
 * - scoreCompatibility：确定性计算各维度分数（可复算）
 * - buildReasons：根据评分结果生成前 3 条非敏感可解释原因
 * - rankTeachers：编排上述函数并产出确定性排序结果
 *
 * 设计原则：
 * 1. 相同输入必须产生相同输出（无随机、无时间依赖）
 * 2. 不向家长暴露 MBTI、心理诊断等敏感画像字段
 * 3. 排序 tie-breaker 严格定义：总分降序 → 经验降序 → id 升序
 */
import {
  SENSITIVE_LABELS,
  type AvailabilitySlot,
  type RankedTeacher,
  type RecommendationReason,
  type RecommendationRequestInternal,
  type ScoreBreakdown,
  type TeacherCandidate,
} from "./types";

/**
 * 计算两个字符串数组的交集大小。
 * 用于度量老师的 teachingTags 与孩子需求/弱点的重合度。
 */
export function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  return new Set(a.filter((item) => setB.has(item))).size;
}

/**
 * 硬筛选：剔除不满足以下任一硬条件的老师：
 * - serviceStatus !== ACTIVE
 * - 不教授请求的 subject
 * - 不覆盖请求的 schoolStage
 * - 指定了 preferredMode 但老师不支持该 mode
 * - 指定了 budgetMaxPerHour 但老师 pricePerHour 超预算
 * - 指定了 minExperienceYears 但老师经验不足
 *
 * 注：可用时段匹配在 rankTeachers 中处理（不在此处过滤），
 * 因为没有可用时段的老师也应进入排序（仅得 0 分）以便家长浏览。
 */
export function hardFilter(
  candidates: TeacherCandidate[],
  request: RecommendationRequestInternal,
): TeacherCandidate[] {
  const { child, preferredMode, budgetMaxPerHour, minExperienceYears } = request;
  return candidates.filter((teacher) => {
    if (teacher.serviceStatus !== "ACTIVE") return false;
    if (!teacher.subjects.includes(child.subject)) return false;
    if (!teacher.schoolStages.includes(child.schoolStage)) return false;
    if (preferredMode && !teacher.teachingModes.includes(preferredMode)) return false;
    if (budgetMaxPerHour !== undefined && teacher.pricePerHour > budgetMaxPerHour) return false;
    if (minExperienceYears !== undefined && teacher.experienceYears < minExperienceYears) return false;
    return true;
  });
}

/**
 * 计算单个老师针对当前孩子请求的评分明细。
 *
 * 各维度分值（与设计文档一致）：
 * - schedule: 25 分（hasScheduleFit ? 25 : 0）
 * - mode: 15 分（满足 preferredMode 时得满分）
 * - budget: 15 分（按超出预算的程度线性衰减）
 * - experience: 15 分（每年 2 分，封顶 15 分）
 * - teachingFit: 10 分 × 重合数（teachingTags ∩ teachingPreferences）
 * - subjectNeed: 10 分 × 重合数（teachingTags ∩ weakKnowledgePoints）
 *
 * 总分 = 各维度之和，最大 100 分。
 */
export function scoreCompatibility(
  teacher: TeacherCandidate,
  request: RecommendationRequestInternal,
  hasScheduleFit: boolean,
): ScoreBreakdown {
  const schedule = hasScheduleFit ? 25 : 0;
  const mode =
    request.preferredMode && teacher.teachingModes.includes(request.preferredMode) ? 15 : 0;
  const budget = Math.max(
    0,
    15 - Math.max(0, teacher.pricePerHour - (request.budgetMaxPerHour ?? teacher.pricePerHour)) * 0.3,
  );
  const experience = Math.min(15, teacher.experienceYears * 2);
  const teachingFit = overlap(teacher.teachingTags, request.child.teachingPreferences) * 10;
  const subjectNeed = overlap(teacher.teachingTags, request.child.weakKnowledgePoints) * 10;
  const total = schedule + mode + budget + experience + teachingFit + subjectNeed;
  return { schedule, mode, budget, experience, teachingFit, subjectNeed, total };
}

/**
 * 判断某个时段是否与请求的偏好时间窗口有重叠。
 * - 若未指定任何一端，视为匹配任何时段
 * - 若只指定一端，则以该端为开/闭区间判断
 * - 若两端都指定，要求区间相交（半开 [startsAt, endsAt)）
 */
export function slotMatchesPreferred(
  slot: AvailabilitySlot,
  request: RecommendationRequestInternal,
): boolean {
  const { preferredStartsAt, preferredEndsAt } = request;
  if (!preferredStartsAt && !preferredEndsAt) return true;
  if (preferredStartsAt && !preferredEndsAt) {
    return slot.endsAt > preferredStartsAt;
  }
  if (!preferredStartsAt && preferredEndsAt) {
    return slot.startsAt < preferredEndsAt;
  }
  return slot.startsAt < preferredEndsAt! && slot.endsAt > preferredStartsAt!;
}

/**
 * 检测文本是否包含敏感关键词（用于过滤可解释原因）。
 */
function containsSensitiveLabel(text: string): boolean {
  return SENSITIVE_LABELS.some((label) => text.includes(label));
}

/**
 * 根据评分明细和请求，构造最多 3 条非敏感的具体原因。
 * 优先级（高到低）：
 *   1. schedule（hasScheduleFit）：本周可试听
 *   2. subjectNeed：覆盖当前科目薄弱知识点
 *   3. teachingFit：教学偏好契合
 *   4. experience：经验丰富
 *   5. mode：支持偏好的授课方式
 *   6. budget：价格在预算内
 *
 * 每条原因的 text 都必须经过敏感标签过滤；包含敏感词的原因被跳过。
 */
export function buildReasons(
  teacher: TeacherCandidate,
  score: ScoreBreakdown,
  request: RecommendationRequestInternal,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  const subjectLabel = subjectDisplayName(request.child.subject);

  if (score.schedule > 0) {
    const text = "本周有可用试听时段";
    reasons.push({ code: "schedule.fit", text });
  }

  if (score.subjectNeed > 0) {
    const text = `覆盖当前${subjectLabel}薄弱知识点`;
    reasons.push({ code: "subject.weak", text });
  }

  if (score.teachingFit > 0) {
    const text = "教学偏好与孩子情况契合";
    reasons.push({ code: "teaching.fit", text });
  }

  if (reasons.length < 3 && score.experience >= 10) {
    const text = `教龄 ${teacher.experienceYears} 年，经验丰富`;
    reasons.push({ code: "experience.rich", text });
  }

  if (reasons.length < 3 && score.mode > 0 && request.preferredMode) {
    const text = `支持${modeDisplayName(request.preferredMode)}授课`;
    reasons.push({ code: "mode.supported", text });
  }

  if (reasons.length < 3 && score.budget >= 12) {
    const text = "价格在预算范围内";
    reasons.push({ code: "budget.fit", text });
  }

  // 过滤掉任何意外包含敏感关键词的原因，并截断到 3 条
  const filtered = reasons.filter((reason) => !containsSensitiveLabel(reason.text));
  return filtered.slice(0, 3);
}

/** 把 Subject 枚举值映射为家长可读的中文名称。 */
function subjectDisplayName(subject: string): string {
  switch (subject) {
    case "CHINESE":
      return "语文";
    case "MATH":
      return "数学";
    case "ENGLISH":
      return "英语";
    case "PHYSICS":
      return "物理";
    case "CHEMISTRY":
      return "化学";
    default:
      return "当前";
  }
}

/** 把 TeachingMode 枚举值映射为家长可读的中文名称。 */
function modeDisplayName(mode: string): string {
  switch (mode) {
    case "ONLINE":
      return "在线";
    case "IN_HOME":
      return "上门";
    case "IN_CENTER":
      return "中心";
    default:
      return "所选";
  }
}

/**
 * 编排硬筛选 + 评分 + 原因构造，输出确定性排序结果。
 *
 * 排序规则：
 *   1. score.total 降序
 *   2. teacher.experienceYears 降序
 *   3. teacher.id 升序（保证完全确定性的 tie-breaker）
 *
 * @param scheduleMap 老师 ID -> 可用时段列表；空数组或缺失视为无可用时段
 */
export function rankTeachers(
  candidates: TeacherCandidate[],
  request: RecommendationRequestInternal,
  scheduleMap: Map<string, AvailabilitySlot[]>,
): RankedTeacher[] {
  const filtered = hardFilter(candidates, request);

  const ranked: RankedTeacher[] = filtered.map((teacher) => {
    const slots = scheduleMap.get(teacher.id) ?? [];
    const hasScheduleFit =
      slots.length > 0 && slots.some((slot) => slotMatchesPreferred(slot, request));
    const score = scoreCompatibility(teacher, request, hasScheduleFit);
    const reasons = buildReasons(teacher, score, request);
    return { teacher, score, reasons, availabilitySlots: slots };
  });

  ranked.sort((left, right) => {
    if (right.score.total !== left.score.total) {
      return right.score.total - left.score.total;
    }
    if (right.teacher.experienceYears !== left.teacher.experienceYears) {
      return right.teacher.experienceYears - left.teacher.experienceYears;
    }
    return left.teacher.id < right.teacher.id ? -1 : left.teacher.id > right.teacher.id ? 1 : 0;
  });

  return ranked;
}
