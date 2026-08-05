/**
 * 移动端 React Hooks
 */
import { useEffect, useState, useCallback } from "react";
import { fetchTeachers, fetchPlatformStats } from "@/services/api";
import type { PlatformStats } from "@/services/api";
import type { Teacher, Prefs } from "@lightning-tiger/shared";

/**
 * 获取老师列表
 * - 支持按筛选条件获取
 * - 自动处理加载状态和错误
 */
export function useTeachers(prefs?: Prefs | null) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTeachers(prefs);
      setTeachers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      // 降级：API 不可用时返回空列表，让 UI 显示重试
      setTeachers([]);
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
 */
export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats>({ teacherCount: 0, parentCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return { stats, loading };
}
