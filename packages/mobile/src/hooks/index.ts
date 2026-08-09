import { useCallback, useEffect, useState } from "react";
import { fetchPlatformStats, fetchTeachers } from "@/services/api";
import type { PlatformStats } from "@/services/api";
import type { Prefs, Teacher } from "@lightning-tiger/shared";

export function useTeachers(prefs?: Prefs | null) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTeachers(await fetchTeachers(prefs));
    } catch (err) {
      setTeachers([]);
      setError("老师列表加载失败，请检查网络后重试");
      console.warn("[useTeachers] teacher list load failed", err);
    } finally {
      setLoading(false);
    }
  }, [prefs]);

  useEffect(() => {
    load();
  }, [load]);

  return { teachers, loading, error, reload: load, retry: load };
}

export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await fetchPlatformStats());
    } catch (err) {
      setStats(null);
      setError("平台数据加载失败，请稍后重试");
      console.warn("[usePlatformStats] platform stats load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, loading, error, reload: load, retry: load };
}
