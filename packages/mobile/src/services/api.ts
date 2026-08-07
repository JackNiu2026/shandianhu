/**
 * 移动端 API 客户端
 * 基于 Taro.request，兼容小程序和 H5
 */
import Taro from "@tarojs/taro";
import type { Teacher, Prefs } from "@lightning-tiger/shared";

/** API 基础地址 */
const API_BASE = process.env.TARO_APP_API_BASE || "http://localhost:3000";

/** 获取认证 token */
function getAuthToken(): string {
  try {
    return Taro.getStorageSync("auth-token") || "";
  } catch {
    return "";
  }
}

/** 设置认证 token */
export function setAuthToken(token: string) {
  try {
    Taro.setStorageSync("auth-token", token);
  } catch (e) {
    console.warn("[Storage] 保存 token 失败", e);
  }
}

/** 清除认证 token */
export function clearAuthToken() {
  try {
    Taro.removeStorageSync("auth-token");
  } catch (e) {
    console.warn("[Storage] 清除 token 失败", e);
  }
}

/** 请求选项（不含 url，由 request 函数拼接） */
type RequestOptions = Omit<Taro.request.Option, "url">;

/** 请求封装 */
async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  try {
    const token = getAuthToken();
    const header: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.header as Record<string, string> || {}),
    };
    if (token) {
      header["Authorization"] = `Bearer ${token}`;
    }

    const res = await Taro.request({
      url: `${API_BASE}${url}`,
      method: "GET",
      header,
      ...options,
    } as Taro.request.Option);

    // 401: token 过期/无效，清除 token（登录弹窗由各页面自行处理）
    if (res.statusCode === 401) {
      clearAuthToken();
      throw new Error("登录已过期，请重新登录");
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as T;
    }

    // 非 2xx：尝试提取错误信息并展示
    const errMsg = (res.data as { error?: string })?.error || "请求失败";
    Taro.showToast({ title: errMsg, icon: "none", duration: 2000 });
    throw new Error(errMsg);
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

/** 家长注册 */
export async function parentRegister(data: {
  name: string;
  phone: string;
  password: string;
  childGrade: string;
}): Promise<{ success: boolean; user: { id: string; name: string; phone: string } }> {
  const res = await request<{ success: boolean; user: { id: string; name: string; phone: string } }>(
    "/api/auth/parent/register",
    { method: "POST", data: JSON.stringify(data) },
  );
  return res;
}

/** 家长登录 */
export async function parentLogin(data: {
  phone: string;
  password: string;
}): Promise<{ success: boolean; token: string; user: { id: string; name: string; phone: string; childGrade: string } }> {
  const res = await request<{ success: boolean; token: string; user: { id: string; name: string; phone: string; childGrade: string } }>(
    "/api/auth/parent/login",
    { method: "POST", data: JSON.stringify(data) },
  );
  return res;
}

/** 获取当前家长信息 */
export async function fetchParentInfo(): Promise<{
  id: string;
  name: string;
  phone: string;
  avatar: string;
  childGrade: string;
  bookingCount: number;
  likedTeachers: string[];
}> {
  return request("/api/auth/parent/me");
}

/** 创建预约 — parentId 从 token 中提取，无需传入 */
export async function createBooking(data: {
  teacherId: string;
  subject: string;
  slot: string;
}): Promise<unknown> {
  return request("/api/public/bookings", {
    method: "POST",
    data: JSON.stringify(data),
  });
}

/** 创建评价 — author 从 token 中提取，无需传入 */
export async function createReview(data: {
  teacherId: string;
  text: string;
  rating: number;
}): Promise<unknown> {
  return request("/api/public/reviews", {
    method: "POST",
    data: JSON.stringify(data),
  });
}

/** 获取消息列表 */
export async function fetchMessages(contactId?: string): Promise<{
  data: Array<{
    id: string;
    senderId: string;
    content: string;
    read: boolean;
    time: string;
    mine: boolean;
  }>;
  total: number;
}> {
  const params = contactId ? `?contactId=${contactId}` : "";
  return request(`/api/messages${params}`);
}

/** 发送消息 */
export async function sendMessage(receiverId: string, content: string): Promise<{
  id: string;
  content: string;
  time: string;
  mine: boolean;
}> {
  return request("/api/messages", {
    method: "POST",
    data: JSON.stringify({ receiverId, content }),
  });
}
