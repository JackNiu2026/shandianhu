import type { Teacher, Prefs } from "../types";
import { teachers } from "../data/teachers";

/**
 * 根据筛选条件匹配老师
 * - 严格匹配：科目 + 学段 + 预算
 * - 若严格匹配无结果，放宽到仅科目匹配
 */
export function matchTeachers(prefs: Prefs | null): Teacher[] {
  if (!prefs) return teachers;

  const strict = teachers.filter(
    (t) => t.subject === prefs.subject && t.grades.includes(prefs.grade) && t.price <= prefs.budget,
  );

  return strict.length ? strict : teachers.filter((t) => t.subject === prefs.subject);
}

/**
 * 判断当前匹配结果是否为放宽条件后的推荐
 */
export function isRelaxedMatch(prefs: Prefs | null, matched: Teacher[]): boolean {
  if (!prefs) return false;
  return matched.some((t) => t.price > prefs.budget || !t.grades.includes(prefs.grade));
}
