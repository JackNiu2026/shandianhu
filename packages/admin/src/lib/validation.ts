/**
 * API 输入验证 Schemas（使用 zod）
 * 用于在 API Route Handler 中验证请求体
 */
import { z } from "zod";

/** 登录请求 */
export const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50),
  password: z.string().min(1, "密码不能为空").max(100),
});

/** 修改密码请求 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(8, "新密码长度至少 8 位").max(100),
});

/** 创建老师请求 */
export const createTeacherSchema = z.object({
  name: z.string().min(1, "老师姓名不能为空").max(50),
  age: z.string().max(20).optional().default(""),
  school: z.string().max(100).optional().default(""),
  subject: z.string().min(1, "科目不能为空").max(20),
  grades: z.array(z.string()).optional().default([]),
  mode: z.string().max(20).optional().default("线上"),
  tags: z.array(z.string()).optional().default([]),
  color: z.string().max(20).optional().default("#f2cabc"),
  note: z.string().max(500).optional().default(""),
  rating: z.string().max(10).optional().default("0.0"),
  students: z.string().max(20).optional().default("0"),
  years: z.string().max(20).optional().default("1年"),
  price: z.number().int().min(0).max(10000).optional().default(100),
  slots: z.array(z.string()).optional().default([]),
  video: z.string().max(500).optional().default(""),
  checks: z.array(z.string()).optional().default([]),
  status: z.enum(["active", "pending", "blocked"]).optional().default("pending"),
});

/** 更新老师请求（所有字段可选） */
export const updateTeacherSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  age: z.string().max(20).optional(),
  school: z.string().max(100).optional(),
  subject: z.string().min(1).max(20).optional(),
  grades: z.array(z.string()).optional(),
  mode: z.string().max(20).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().max(20).optional(),
  note: z.string().max(500).optional(),
  rating: z.string().max(10).optional(),
  students: z.string().max(20).optional(),
  years: z.string().max(20).optional(),
  price: z.number().int().min(0).max(10000).optional(),
  slots: z.array(z.string()).optional(),
  video: z.string().max(500).optional(),
  checks: z.array(z.string()).optional(),
  status: z.enum(["active", "pending", "blocked"]).optional(),
});

/** 更新预约状态请求 */
export const updateBookingStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

/** 更新评价状态请求 */
export const updateReviewStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

/** 更新提现状态请求 */
export const updateWithdrawalSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "processed"]),
});

/** 平台配置请求 */
export const platformConfigSchema = z.object({
  platformName: z.string().min(1, "平台名称不能为空").max(50),
  contact: z.string().max(100).optional().default(""),
});

/** 更新家长状态请求 */
export const updateParentStatusSchema = z.object({
  status: z.enum(["active", "blocked"]),
});

/** 创建会员请求 */
export const createMembershipSchema = z.object({
  parentId: z.string().min(1, "家长 ID 不能为空"),
  duration: z.enum(["月度会员", "季度会员", "年度会员"]),
  amount: z.number().min(0, "金额不能为负").max(10000),
  startDate: z.string().min(1, "开始日期不能为空"),
  endDate: z.string().min(1, "结束日期不能为空"),
  status: z.enum(["active", "expired", "cancelled"]).optional().default("active"),
});

/** 更新会员状态请求 */
export const updateMembershipStatusSchema = z.object({
  status: z.enum(["active", "expired", "cancelled"]),
});

/** 创建预约请求 */
export const createBookingSchema = z.object({
  parentId: z.string().min(1, "家长 ID 不能为空"),
  teacherId: z.string().min(1, "老师 ID 不能为空"),
  subject: z.string().min(1, "科目不能为空").max(20),
  slot: z.string().min(1, "时间段不能为空").max(100),
});

/** 创建评价请求 */
export const createReviewSchema = z.object({
  teacherId: z.string().min(1, "老师 ID 不能为空"),
  author: z.string().min(1, "评价人不能为空").max(50),
  text: z.string().min(1, "评价内容不能为空").max(500),
  rating: z.number().int().min(1, "评分至少 1").max(5, "评分最多 5"),
});

/** 家长注册请求 */
export const parentBookingSchema = createBookingSchema.omit({ parentId: true });
export const parentReviewSchema = createReviewSchema.omit({ author: true });

export const parentRegisterSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(50),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  password: z.string().min(8, "密码长度至少 8 位").max(100),
  childGrade: z.string().min(1, "孩子年级不能为空").max(20),
});

/** 家长登录请求 */
export const parentLoginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

/** 更新提现状态请求（含驳回） */
export const updateWithdrawalSchemaV2 = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "processed", "rejected"]),
  rejectReason: z.string().max(200).optional().default(""),
});

/** 更新平台配置请求（含分润比例） */
export const platformConfigSchemaV2 = z.object({
  platformName: z.string().min(1, "平台名称不能为空").max(50),
  contact: z.string().max(100).optional().default(""),
  profitSharingRatio: z.number().min(0, "分润比例不能为负").max(1, "分润比例最大 1").optional(),
});

/** 分页参数解析 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** 学情诊断请求 */
export const diagnoseSchema = z.object({
  subject: z.string().min(1, "学科不能为空").max(20),
  grade: z.string().min(1, "年级不能为空").max(20),
  images: z.array(z.string().min(1)).min(1, "至少上传一张错题照片").max(9, "最多上传 9 张照片"),
});
