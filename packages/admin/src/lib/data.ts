import { subjects, grades, budgetOptions } from "@lightning-tiger/shared";
import type {
  TeacherAdmin,
  Parent,
  Booking,
  Review,
  Membership,
  Withdrawal,
  MonthlyRevenue,
  ContentConfig,
} from "./types";

/* ============ 静态数据（暂时保留，真实数据从 API 获取） ============ */

/** 月度收益（静态占位，内容配置页面尚未完全对接） */
export const monthlyRevenue: MonthlyRevenue[] = [
  { month: "1月", revenue: 8200, orders: 12 },
  { month: "2月", revenue: 9100, orders: 15 },
  { month: "3月", revenue: 12400, orders: 18 },
  { month: "4月", revenue: 10800, orders: 16 },
  { month: "5月", revenue: 14200, orders: 22 },
  { month: "6月", revenue: 15600, orders: 25 },
  { month: "7月", revenue: 18240, orders: 28 },
  { month: "8月", revenue: 9870, orders: 15 },
];

/** 内容配置（静态，真实数据可从 /api/content 获取） */
export const contentConfig: ContentConfig = {
  subjects: [...subjects],
  grades: [...grades],
  budgetOptions: [...budgetOptions],
  platformStats: {
    teacherCount: 856,
    parentCount: 1240,
  },
};

/** 科目分布（静态占位，真实数据从 /api/dashboard/stats 获取） */
export const subjectDistribution = subjects.map((s) => ({
  name: s,
  count: 0,
}));

/** 评分分布（静态占位，真实数据从 /api/dashboard/stats 获取） */
export const ratingDistribution = [
  { name: "4.9", count: 0 },
  { name: "4.8", count: 0 },
  { name: "4.7", count: 0 },
];

/** MBTI 维度分布（静态占位，真实数据从 /api/dashboard/stats 获取） */
export const mbtiDimensionStats = [
  { dim: "EI", E: 4, I: 6 },
  { dim: "SN", S: 5, N: 5 },
  { dim: "TF", T: 6, F: 4 },
  { dim: "JP", J: 7, P: 3 },
];

/* ============ 内部工具 ============ */

const JSON_HEADERS = { "Content-Type": "application/json" };

/** 解析列表接口响应（{ data: [...], total: number }） */
async function parseList<T>(res: Response): Promise<T[]> {
  const json = await res.json();
  return (json.data ?? []) as T[];
}

/* ============ 老师 API ============ */

export async function getTeachers(): Promise<TeacherAdmin[]> {
  const res = await fetch("/api/teachers");
  if (!res.ok) throw new Error("获取老师列表失败");
  return parseList<TeacherAdmin>(res);
}

export async function getTeacherById(id: string): Promise<TeacherAdmin | null> {
  const res = await fetch(`/api/teachers/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("获取老师详情失败");
  }
  return res.json();
}

export async function createTeacher(data: Partial<TeacherAdmin>): Promise<TeacherAdmin> {
  const res = await fetch("/api/teachers", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("创建老师失败");
  return res.json();
}

export async function updateTeacher(id: string, data: Partial<TeacherAdmin>): Promise<void> {
  const res = await fetch(`/api/teachers/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新老师信息失败");
}

export async function deleteTeacher(id: string): Promise<void> {
  const res = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("删除老师失败");
}

/* ============ 家长 API ============ */

export async function getParents(): Promise<Parent[]> {
  const res = await fetch("/api/parents");
  if (!res.ok) throw new Error("获取家长列表失败");
  return parseList<Parent>(res);
}

export async function getParentById(id: string): Promise<Parent | null> {
  const res = await fetch(`/api/parents/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("获取家长详情失败");
  }
  return res.json();
}

/* ============ 预约 API ============ */

export async function getBookings(): Promise<Booking[]> {
  const res = await fetch("/api/bookings");
  if (!res.ok) throw new Error("获取预约列表失败");
  return parseList<Booking>(res);
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const res = await fetch(`/api/bookings/${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("获取预约详情失败");
  }
  return res.json();
}

export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<void> {
  const res = await fetch(`/api/bookings/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("更新预约状态失败");
}

/* ============ 评价 API ============ */

export async function getReviews(): Promise<Review[]> {
  const res = await fetch("/api/reviews");
  if (!res.ok) throw new Error("获取评价列表失败");
  return parseList<Review>(res);
}

export async function updateReviewStatus(id: string, status: Review["status"]): Promise<void> {
  const res = await fetch(`/api/reviews/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("更新评价状态失败");
}

export async function deleteReview(id: string): Promise<void> {
  const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("删除评价失败");
}

/* ============ 会员 API ============ */

export async function getMemberships(): Promise<Membership[]> {
  const res = await fetch("/api/memberships");
  if (!res.ok) throw new Error("获取会员列表失败");
  return parseList<Membership>(res);
}

/* ============ 提现 API ============ */

export async function getWithdrawals(): Promise<Withdrawal[]> {
  const res = await fetch("/api/finance/withdrawals");
  if (!res.ok) throw new Error("获取提现列表失败");
  return parseList<Withdrawal>(res);
}

export async function updateWithdrawalStatus(id: string, status: Withdrawal["status"]): Promise<void> {
  const res = await fetch("/api/finance/withdrawals", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ id, status }),
  });
  if (!res.ok) throw new Error("处理提现失败");
}

/* ============ 仪表盘统计 API ============ */

export async function getDashboardStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("获取仪表盘统计失败");
  return res.json();
}
