import type {
  TeacherAdmin,
  Parent,
  Booking,
  Review,
  Membership,
  Withdrawal,
} from "./types";

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

export async function createMembership(data: {
  parentId: string;
  duration: string;
  amount: number;
  startDate: string;
  endDate: string;
}): Promise<Membership> {
  const res = await fetch("/api/memberships", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("创建会员失败");
  return res.json();
}

export async function updateMembershipStatus(id: string, status: Membership["status"]): Promise<void> {
  const res = await fetch(`/api/memberships/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("更新会员状态失败");
}

export async function deleteMembership(id: string): Promise<void> {
  const res = await fetch(`/api/memberships/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("删除会员失败");
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

/* ============ 平台配置 API ============ */

export async function getPlatformConfig(): Promise<{ platformName: string; contact: string }> {
  const res = await fetch("/api/content/config");
  if (!res.ok) throw new Error("获取平台配置失败");
  return res.json();
}

export async function updatePlatformConfig(data: { platformName: string; contact: string }): Promise<void> {
  const res = await fetch("/api/content/config", {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新平台配置失败");
}

/* ============ 修改密码 API ============ */

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "修改密码失败");
  }
}

/* ============ 家长状态更新 API ============ */

export async function updateParentStatus(id: string, status: string): Promise<void> {
  const res = await fetch(`/api/parents/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("更新家长状态失败");
}
