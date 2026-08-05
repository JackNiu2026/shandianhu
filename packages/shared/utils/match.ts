import type { Teacher, Prefs } from "../types";
import { teachers as defaultTeachers } from "../data/teachers";

/**
 * 根据筛选条件匹配老师
 * - 严格匹配：科目 + 学段 + 预算
 * - 若严格匹配无结果，放宽到仅科目匹配
 *
 * @param prefs 筛选条件
 * @param teacherList 可选，外部传入的老师列表（如从 API 获取）。不传则使用内置静态数据
 */
export function matchTeachers(prefs: Prefs | null, teacherList?: Teacher[]): Teacher[] {
  const list = teacherList ?? defaultTeachers;

  if (!prefs) return list;

  const strict = list.filter(
    (t) => t.subject === prefs.subject && t.grades.includes(prefs.grade) && t.price <= prefs.budget,
  );

  return strict.length ? strict : list.filter((t) => t.subject === prefs.subject);
}

/**
 * 判断当前匹配结果是否为放宽条件后的推荐
 */
export function isRelaxedMatch(prefs: Prefs | null, matched: Teacher[]): boolean {
  if (!prefs) return false;
  return matched.some((t) => t.price > prefs.budget || !t.grades.includes(prefs.grade));
}
