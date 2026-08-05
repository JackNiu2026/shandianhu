import type { Teacher, Prefs, MBTIResult, Grade, Question } from "@lightning-tiger/shared";

/* ============ 老师管理扩展类型 ============ */
export type TeacherStatus = "active" | "pending" | "blocked";

export interface TeacherAdmin extends Teacher {
  id: string;
  status: TeacherStatus;
  createdAt: string;
  updatedAt: string;
  totalRevenue: number;
  pendingRevenue: number;
  availableRevenue: number;
  totalLessons: number;
}

/* ============ 家长类型 ============ */
export type ParentStatus = "active" | "blocked";

export interface Parent {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  childGrade: Grade;
  prefs: Prefs | null;
  mbtiResult: MBTIResult | null;
  likedTeachers: string[];
  bookingCount: number;
  status: ParentStatus;
  createdAt: string;
}

/* ============ 预约类型 ============ */
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Booking {
  id: string;
  parentName: string;
  teacherName: string;
  subject: string;
  slot: string;
  status: BookingStatus;
  createdAt: string;
  parentPhone: string;
}

/* ============ 评价类型 ============ */
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  teacherName: string;
  author: string;
  text: string;
  rating: number;
  status: ReviewStatus;
  createdAt: string;
}

/* ============ 会员类型 ============ */
export type MembershipStatus = "active" | "expired" | "cancelled";

export interface Membership {
  id: string;
  parentName: string;
  duration: string;
  amount: number;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
}

/* ============ 提现类型 ============ */
export type WithdrawalStatus = "pending" | "processed";

export interface Withdrawal {
  id: string;
  teacherName: string;
  amount: number;
  status: WithdrawalStatus;
  createdAt: string;
}

/* ============ 月度收益 ============ */
export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
}

/* ============ 内容配置 ============ */
export interface ContentConfig {
  subjects: string[];
  grades: Grade[];
  budgetOptions: { label: string; value: number }[];
  platformStats: {
    teacherCount: number;
    parentCount: number;
  };
}

/* ============ 管理员 ============ */
export interface AdminUser {
  username: string;
  role: "superadmin" | "editor";
}
