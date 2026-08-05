import { teachers, subjects, grades, budgetOptions, questions } from "@lightning-tiger/shared";
import type { Teacher } from "@lightning-tiger/shared";
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

/* ============ 工具：生成 ID ============ */
let _id = 0;
const nextId = (prefix: string) => `${prefix}-${++_id}`;

/* ============ 老师数据（扩展自 shared） ============ */
const teacherStatusList: TeacherAdmin["status"][] = [
  "active", "active", "active", "active", "pending", "active", "active", "active",
];

export const teacherList: TeacherAdmin[] = teachers.map((t, i) => ({
  ...t,
  id: nextId("t"),
  status: teacherStatusList[i] || "active",
  createdAt: new Date(2026, 6, 1 + i * 3).toISOString(),
  updatedAt: new Date(2026, 7, 1 + i * 2).toISOString(),
  totalRevenue: [12680, 15200, 9800, 8400, 4200, 11000, 7600, 13800][i] || 5000,
  pendingRevenue: [2460, 1800, 1200, 900, 0, 1500, 800, 2100][i] || 0,
  availableRevenue: [8920, 9800, 6800, 5600, 2800, 7200, 4800, 9100][i] || 3000,
  totalLessons: [186, 210, 142, 168, 85, 154, 120, 198][i] || 50,
}));

/* ============ 家长数据 ============ */
const parentNames = [
  { name: "陈晓彤", avatar: "陈", phone: "138****6688", grade: "初中" as const },
  { name: "王思远", avatar: "王", phone: "139****2233", grade: "高中" as const },
  { name: "李明轩", avatar: "李", phone: "137****5566", grade: "小学" as const },
  { name: "张雨晴", avatar: "张", phone: "136****8899", grade: "初中" as const },
  { name: "刘子涵", avatar: "刘", phone: "135****1100", grade: "高中" as const },
  { name: "赵欣然", avatar: "赵", phone: "133****2244", grade: "小学" as const },
  { name: "周博文", avatar: "周", phone: "132****5577", grade: "初中" as const },
  { name: "吴若溪", avatar: "吴", phone: "131****8890", grade: "高中" as const },
  { name: "郑好", avatar: "郑", phone: "188****3322", grade: "初中" as const },
  { name: "孙嘉怡", avatar: "孙", phone: "187****6611", grade: "小学" as const },
];

const mbtiResults = [
  { code: "INTJ", label: "内省 · 联想 · 思辨 · 计划", advice: ["需要留白和等待", "适合先讲整体逻辑", "对数据敏感", "固定节奏最安心"] },
  { code: "ENFP", label: "外向 · 联想 · 共情 · 灵活", advice: ["在互动中学得最快", "适合先讲整体逻辑", "需要先被肯定", "需要弹性安排"] },
  { code: "ISTJ", label: "内省 · 务实 · 思辨 · 计划", advice: ["需要留白和等待", "适合先给清晰步骤", "对数据敏感", "固定节奏最安心"] },
  { code: "ENFJ", label: "外向 · 联想 · 共情 · 计划", advice: ["在互动中学得最快", "适合先讲整体逻辑", "需要先被肯定", "固定节奏最安心"] },
  { code: "ISFP", label: "内省 · 务实 · 共情 · 灵活", advice: ["需要留白和等待", "适合先给清晰步骤", "需要先被肯定", "需要弹性安排"] },
  { code: "ENTP", label: "外向 · 联想 · 思辨 · 灵活", advice: ["在互动中学得最快", "适合先讲整体逻辑", "对数据敏感", "需要弹性安排"] },
  null,
  { code: "ISTP", label: "内省 · 务实 · 思辨 · 灵活", advice: ["需要留白和等待", "适合先给清晰步骤", "对数据敏感", "需要弹性安排"] },
  null,
  { code: "ESFJ", label: "外向 · 务实 · 共情 · 计划", advice: ["在互动中学得最快", "适合先给清晰步骤", "需要先被肯定", "固定节奏最安心"] },
];

const parentStatuses: Parent["status"][] = [
  "active", "active", "active", "active", "blocked", "active", "active", "active", "active", "active",
];

export const parentList: Parent[] = parentNames.map((p, i) => ({
  id: nextId("p"),
  name: p.name,
  avatar: p.avatar,
  phone: p.phone,
  childGrade: p.grade,
  prefs: i % 3 === 0
    ? null
    : { grade: p.grade, subject: subjects[i % subjects.length], budget: budgetOptions[i % budgetOptions.length].value },
  mbtiResult: mbtiResults[i % mbtiResults.length],
  likedTeachers: teacherList.slice(0, (i % 3) + 1).map((t) => t.name),
  bookingCount: (i % 4) + (i % 2),
  status: parentStatuses[i],
  createdAt: new Date(2026, 5, 5 + i * 4).toISOString(),
}));

/* ============ 预约数据 ============ */
const bookingSlots = ["周六 14:00", "周日 10:00", "周五 19:30", "周六 09:00", "周三 18:30", "周四 19:00", "周六 13:00", "周日 16:30"];
const bookingStatuses: Booking["status"][] = [
  "completed", "confirmed", "pending", "cancelled", "completed", "confirmed", "pending", "completed",
  "confirmed", "pending", "completed", "cancelled", "confirmed", "pending", "completed",
];

export const bookingList: Booking[] = Array.from({ length: 15 }, (_, i) => {
  const parent = parentList[i % parentList.length];
  const teacher = teacherList[i % teacherList.length];
  return {
    id: nextId("b"),
    parentName: parent.name,
    teacherName: teacher.name,
    subject: teacher.subject,
    slot: bookingSlots[i % bookingSlots.length],
    status: bookingStatuses[i],
    createdAt: new Date(2026, 7, 1 + i).toISOString(),
    parentPhone: parent.phone,
  };
});

/* ============ 评价数据 ============ */
const reviewTexts = [
  "孩子以前一看应用题就跳过，现在会主动把思路讲给我听。",
  "每次课后都有一条很具体的反馈，不是那种复制粘贴的模板。",
  "上了两个月，孩子敢在课堂上开口了，这个比分数更让我意外。",
  "作文批改很细，会标出哪句是中式表达。",
  "陈老师会先问孩子哪一步卡住，而不是直接讲答案。",
  "老教师的经验很明显，考点抓得准。",
  "口算速度上来了，考试终于不因为时间不够丢分。",
  "衔接课安排得很稳，孩子没有那种断层的慌张。",
  "作文从四十分出头提到五十分，思路清楚了很多。",
  "会带着孩子拆题干，这个方法能用到别的科目。",
  "会用实验视频讲原理，孩子说这样才记得住。",
  "错题本是老师帮着一起整理的，很省心。",
  "动画演示很直观，孩子第一次说物理有意思。",
  "讲题耐心，问三遍也不会不高兴。",
  "从不催孩子，单词是靠句子记住的，不是罚抄。",
  "上门很守时，二十年经验不是白说的。",
  "老师很专业，讲解清晰，孩子进步明显。",
  "沟通顺畅，会及时反馈孩子的学习情况。",
  "课程安排合理，孩子学得很开心。",
  "推荐给了身边好几个朋友，大家都说好。",
];
const reviewStatuses: Review["status"][] = [
  "approved", "approved", "pending", "approved", "approved", "approved", "approved", "approved",
  "approved", "approved", "approved", "approved", "pending", "approved", "approved",
  "approved", "pending", "rejected", "approved", "approved",
];

export const reviewList: Review[] = Array.from({ length: 20 }, (_, i) => {
  const teacher = teacherList[i % teacherList.length];
  const review = teacher.reviews[i % teacher.reviews.length];
  return {
    id: nextId("r"),
    teacherName: teacher.name,
    author: review.by,
    text: reviewTexts[i],
    rating: 4 + (i % 2),
    status: reviewStatuses[i],
    createdAt: new Date(2026, 6, 1 + i).toISOString(),
  };
});

/* ============ 会员数据 ============ */
export const membershipList: Membership[] = [
  { id: nextId("m"), parentName: "陈晓彤", duration: "月度会员", amount: 19.9, startDate: "2026-07-01", endDate: "2026-08-01", status: "active" },
  { id: nextId("m"), parentName: "王思远", duration: "季度会员", amount: 49.9, startDate: "2026-06-15", endDate: "2026-09-15", status: "active" },
  { id: nextId("m"), parentName: "李明轩", duration: "月度会员", amount: 19.9, startDate: "2026-06-01", endDate: "2026-07-01", status: "expired" },
  { id: nextId("m"), parentName: "张雨晴", duration: "年度会员", amount: 199, startDate: "2026-01-01", endDate: "2026-12-31", status: "active" },
  { id: nextId("m"), parentName: "刘子涵", duration: "月度会员", amount: 19.9, startDate: "2026-05-01", endDate: "2026-06-01", status: "cancelled" },
];

/* ============ 提现数据 ============ */
export const withdrawalList: Withdrawal[] = [
  { id: nextId("w"), teacherName: "林知夏", amount: 5000, status: "pending", createdAt: "2026-08-01" },
  { id: nextId("w"), teacherName: "周予安", amount: 3000, status: "processed", createdAt: "2026-07-28" },
  { id: nextId("w"), teacherName: "陈默", amount: 2000, status: "pending", createdAt: "2026-08-03" },
  { id: nextId("w"), teacherName: "叶承川", amount: 4000, status: "processed", createdAt: "2026-07-20" },
];

/* ============ 月度收益 ============ */
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

/* ============ 内容配置 ============ */
export const contentConfig: ContentConfig = {
  subjects: [...subjects],
  grades: [...grades],
  budgetOptions: [...budgetOptions],
  platformStats: {
    teacherCount: 856,
    parentCount: 1240,
  },
};

/* ============ 科目分布 ============ */
export const subjectDistribution = subjects.map((s) => ({
  name: s,
  count: teacherList.filter((t) => t.subject === s).length,
}));

/* ============ 评分分布 ============ */
export const ratingDistribution = [
  { name: "4.9", count: teacherList.filter((t) => t.rating === "4.9").length },
  { name: "4.8", count: teacherList.filter((t) => t.rating === "4.8").length },
  { name: "4.7", count: teacherList.filter((t) => t.rating === "4.7").length },
];

/* ============ MBTI 维度分布 ============ */
export const mbtiDimensionStats = [
  { dim: "EI", E: 4, I: 6 },
  { dim: "SN", S: 5, N: 5 },
  { dim: "TF", T: 6, F: 4 },
  { dim: "JP", J: 7, P: 3 },
];

/* ============ CRUD 函数（模拟异步） ============ */
const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

export async function getTeachers(): Promise<TeacherAdmin[]> {
  await delay();
  return [...teacherList];
}

export async function getTeacherById(id: string): Promise<TeacherAdmin | null> {
  await delay();
  return teacherList.find((t) => t.id === id) || null;
}

export async function createTeacher(data: Partial<TeacherAdmin>): Promise<TeacherAdmin> {
  await delay();
  const newTeacher: TeacherAdmin = {
    id: nextId("t"),
    name: data.name || "",
    age: data.age || "",
    school: data.school || "",
    subject: data.subject || "数学",
    grades: data.grades || ["初中"],
    mode: data.mode || "线上",
    tags: data.tags || [],
    color: data.color || "#f2cabc",
    note: data.note || "",
    rating: "0.0",
    students: "0",
    years: data.years || "1 年",
    price: data.price || 100,
    slots: data.slots || [],
    video: data.video || "",
    checks: data.checks || [],
    reviews: [],
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalRevenue: 0,
    pendingRevenue: 0,
    availableRevenue: 0,
    totalLessons: 0,
  };
  teacherList.push(newTeacher);
  return newTeacher;
}

export async function updateTeacher(id: string, data: Partial<TeacherAdmin>): Promise<void> {
  await delay();
  const idx = teacherList.findIndex((t) => t.id === id);
  if (idx >= 0) {
    teacherList[idx] = { ...teacherList[idx], ...data, updatedAt: new Date().toISOString() };
  }
}

export async function deleteTeacher(id: string): Promise<void> {
  await delay();
  const idx = teacherList.findIndex((t) => t.id === id);
  if (idx >= 0) teacherList.splice(idx, 1);
}

export async function getParents(): Promise<Parent[]> {
  await delay();
  return [...parentList];
}

export async function getParentById(id: string): Promise<Parent | null> {
  await delay();
  return parentList.find((p) => p.id === id) || null;
}

export async function getBookings(): Promise<Booking[]> {
  await delay();
  return [...bookingList];
}

export async function getBookingById(id: string): Promise<Booking | null> {
  await delay();
  return bookingList.find((b) => b.id === id) || null;
}

export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<void> {
  await delay();
  const idx = bookingList.findIndex((b) => b.id === id);
  if (idx >= 0) bookingList[idx].status = status;
}

export async function getReviews(): Promise<Review[]> {
  await delay();
  return [...reviewList];
}

export async function updateReviewStatus(id: string, status: Review["status"]): Promise<void> {
  await delay();
  const idx = reviewList.findIndex((r) => r.id === id);
  if (idx >= 0) reviewList[idx].status = status;
}

export async function getMemberships(): Promise<Membership[]> {
  await delay();
  return [...membershipList];
}

export async function getWithdrawals(): Promise<Withdrawal[]> {
  await delay();
  return [...withdrawalList];
}

export async function updateWithdrawalStatus(id: string, status: Withdrawal["status"]): Promise<void> {
  await delay();
  const idx = withdrawalList.findIndex((w) => w.id === id);
  if (idx >= 0) withdrawalList[idx].status = status;
}

/* ============ 仪表盘统计 ============ */
export async function getDashboardStats() {
  await delay();
  return {
    teacherCount: teacherList.length,
    parentCount: parentList.length,
    bookingCount: bookingList.length,
    totalRevenue: teacherList.reduce((s, t) => s + t.totalRevenue, 0),
    pendingReviews: reviewList.filter((r) => r.status === "pending").length,
    pendingBookings: bookingList.filter((b) => b.status === "pending").length,
    pendingTeachers: teacherList.filter((t) => t.status === "pending").length,
    activeMemberships: membershipList.filter((m) => m.status === "active").length,
  };
}
