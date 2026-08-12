/**
 * V2.2 学科智能体目录
 *
 * 定义经批准的 13 个学科/学段智能体槽位。
 * 物理和化学只在初中和高中开放，小学不设。
 * 目录仅声明槽位，不包含提示词内容或模型配置；
 * 每个槽位必须由管理员上传测试并发布的提示词后才能启用。
 */

export type SubjectCode = "CHINESE" | "MATH" | "ENGLISH" | "PHYSICS" | "CHEMISTRY";
export type SchoolStageCode = "PRIMARY" | "MIDDLE" | "HIGH";

export const AGENT_CATALOG: ReadonlyArray<readonly [SubjectCode, SchoolStageCode]> = [
  ["CHINESE", "PRIMARY"],
  ["CHINESE", "MIDDLE"],
  ["CHINESE", "HIGH"],
  ["MATH", "PRIMARY"],
  ["MATH", "MIDDLE"],
  ["MATH", "HIGH"],
  ["ENGLISH", "PRIMARY"],
  ["ENGLISH", "MIDDLE"],
  ["ENGLISH", "HIGH"],
  ["PHYSICS", "MIDDLE"],
  ["PHYSICS", "HIGH"],
  ["CHEMISTRY", "MIDDLE"],
  ["CHEMISTRY", "HIGH"],
];

/**
 * 将数字年级映射到学段。
 * 1–6 年级 → PRIMARY
 * 7–9 年级 → MIDDLE
 * 10–12 年级 → HIGH
 *
 * 年级无效时返回 null，调用方需决定如何处理。
 */
export function stageForGrade(grade: string | null): SchoolStageCode | null {
  if (!grade) return null;
  const chineseGrades: Record<string, number> = {
    "\u4e00": 1,
    "\u4e8c": 2,
    "\u4e09": 3,
    "\u56db": 4,
    "\u4e94": 5,
    "\u516d": 6,
    "\u4e03": 7,
    "\u516b": 8,
    "\u4e5d": 9,
  };
  let normalizedGrade = grade.trim();
  if (normalizedGrade.startsWith("\u521d")) {
    normalizedGrade = String((chineseGrades[normalizedGrade[1]] ?? Number(normalizedGrade[1])) + 6);
  } else if (normalizedGrade.startsWith("\u9ad8")) {
    normalizedGrade = String((chineseGrades[normalizedGrade[1]] ?? Number(normalizedGrade[1])) + 9);
  } else {
    normalizedGrade = normalizedGrade.replace(/[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d]/g, (char) => String(chineseGrades[char]));
  }
  const normalized = normalizedGrade.replace(/\D/g, "");
  const numeric = Number.parseInt(normalized, 10);
  if (Number.isNaN(numeric) || numeric < 1 || numeric > 12) return null;
  if (numeric <= 6) return "PRIMARY";
  if (numeric <= 9) return "MIDDLE";
  return "HIGH";
}

/**
 * 返回指定学段可用的学科列表。
 * 物理和化学在小学不开放。
 */
export function subjectsForStage(stage: SchoolStageCode): SubjectCode[] {
  if (stage === "PRIMARY") return ["CHINESE", "MATH", "ENGLISH"];
  return ["CHINESE", "MATH", "ENGLISH", "PHYSICS", "CHEMISTRY"];
}

/**
 * 判断指定学科/学段组合是否在批准的目录中。
 */
export function isApprovedAgent(subject: SubjectCode, stage: SchoolStageCode): boolean {
  return AGENT_CATALOG.some(([s, st]) => s === subject && st === stage);
}
