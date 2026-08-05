/**
 * 移动端 API 客户端
 * 基于 Taro.request，兼容小程序和 H5
 */
import Taro from "@tarojs/taro";
import type { Teacher, Prefs } from "@lightning-tiger/shared";

/** API 基础地址 */
const API_BASE = process.env.TARO_APP_API_BASE || "http://localhost:3000";

/** 请求封装 */
async function request<T>(url: string, options?: Taro.request.Option): Promise<T> {
  try {
    const res = await Taro.request({
      url: `${API_BASE}${url}`,
      method: "GET",
      ...options,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as T;
    }

    throw new Error((res.data as { error?: string })?.error || "请求失败");
  } catch (error) {
    console.error("[API Request Error]", url, error);
    throw error;
  }
}

/** 平台统计数据 */
export interface PlatformStats {
  teacherCount: number;
  parentCount: number;
}

/** 获取活跃老师列表 */
export async function fetchTeachers(prefs?: Prefs | null): Promise<Teacher[]> {
  const params = new URLSearchParams();
  if (prefs?.subject) params.set("subject", prefs.subject);
  if (prefs?.grade) params.set("grade", prefs.grade);

  const res = await request<{ data: Teacher[]; total: number }>(
    `/api/public/teachers?${params.toString()}`,
  );
  return res.data;
}

/** 获取平台统计 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/api/public/stats");
}
