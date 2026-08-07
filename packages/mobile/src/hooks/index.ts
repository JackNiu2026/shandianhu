/**
 * 移动端 React Hooks
 */
import { useEffect, useState, useCallback } from "react";
import { fetchTeachers, fetchPlatformStats } from "@/services/api";
import type { PlatformStats } from "@/services/api";
import type { Teacher, Prefs } from "@lightning-tiger/shared";
import { teachers as defaultTeachers } from "@lightning-tiger/shared";

/** 平台展示基数（API 不可用时降级显示） */
const BASE_TEACHER_COUNT = 856;
const BASE_PARENT_COUNT = 12800;

/**
 * 获取老师列表
 * - 支持按筛选条件获取
 * - API 不可用时降级使用内置老师数据，不显示错误
 */
export function useTeachers(prefs?: Prefs | null) {
  const [teachers, setTeachers] = useState<Teacher[]>(defaultTeachers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    // 已有内置默认数据，后台静默更新，不触发 loading 避免卡片布局跳动
    setError("");
    try {
      const data = await fetchTeachers(prefs);
      // API 成功：使用返回数据，若为空则降级到内置数据
      setTeachers(data.length > 0 ? data : defaultTeachers);
    } catch (err) {
      // API 不可用：降级使用内置老师数据，不设置 error
      setTeachers(defaultTeachers);
      console.warn("[useTeachers] API 不可用，降级使用内置数据", err);
    } finally {
      setLoading(false);
    }
  }, [prefs]);

  useEffect(() => {
    load();
  }, [load]);

  return { teachers, loading, error, reload: load };
}

/**
 * 获取平台统计数据
 * - API 不可用时降级显示基数 856
 * - API 成功时在基数基础上增加真实老师数
 */
export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats>({
    teacherCount: BASE_TEACHER_COUNT,
    parentCount: BASE_PARENT_COUNT,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats()
      .then((data) => {
        // 在基数基础上增加真实老师数
        setStats({
          teacherCount: BASE_TEACHER_COUNT + (data.teacherCount || 0),
          parentCount: BASE_PARENT_COUNT + (data.parentCount || 0),
        });
        setLoading(false);
      })
      .catch(() => {
        // API 不可用：保持默认基数
        setLoading(false);
      });
  }, []);

  return { stats, loading };
}
