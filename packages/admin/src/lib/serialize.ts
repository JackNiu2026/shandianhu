/**
 * 数据序列化辅助工具
 * 将 Prisma 模型（含 JSON 字符串字段）转换为前端友好的对象
 */
import type { Teacher, Parent, Booking, Review, Membership, Withdrawal } from "@prisma/client";

/** 序列化老师数据 */
export function serializeTeacher(t: Teacher) {
  return {
    id: t.id,
    name: t.name,
    age: t.age,
    school: t.school,
    subject: t.subject,
    grades: JSON.parse(t.grades || "[]"),
    mode: t.mode,
    tags: JSON.parse(t.tags || "[]"),
    color: t.color,
    note: t.note,
    rating: t.rating,
    students: t.students,
    years: t.years,
    price: t.price,
    slots: JSON.parse(t.slots || "[]"),
    video: t.video,
    checks: JSON.parse(t.checks || "[]"),
    status: t.status,
    totalRevenue: t.totalRevenue,
    pendingRevenue: t.pendingRevenue,
    availableRevenue: t.availableRevenue,
    totalLessons: t.totalLessons,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** 序列化家长数据 */
export function serializeParent(p: Parent) {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    phone: p.phone,
    childGrade: p.childGrade,
    prefs: p.prefs ? JSON.parse(p.prefs) : null,
    mbtiResult: p.mbtiResult ? JSON.parse(p.mbtiResult) : null,
    likedTeachers: JSON.parse(p.likedTeachers || "[]"),
    bookingCount: p.bookingCount,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

/** 序列化预约数据 */
export function serializeBooking(
  b: Booking & { parent?: Parent | null; teacher?: Teacher | null },
) {
  return {
    id: b.id,
    parentId: b.parentId,
    teacherId: b.teacherId,
    parentName: b.parent?.name || "",
    parentPhone: b.parent?.phone || "",
    teacherName: b.teacher?.name || "",
    subject: b.subject,
    slot: b.slot,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  };
}

/** 序列化评价数据 */
export function serializeReview(
  r: Review & { teacher?: Teacher | null },
) {
  return {
    id: r.id,
    teacherId: r.teacherId,
    teacherName: r.teacher?.name || "",
    author: r.author,
    text: r.text,
    rating: r.rating,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

/** 序列化会员数据 */
export function serializeMembership(
  m: Membership & { parent?: Parent | null },
) {
  return {
    id: m.id,
    parentId: m.parentId,
    parentName: m.parent?.name || "",
    duration: m.duration,
    amount: m.amount,
    startDate: m.startDate,
    endDate: m.endDate,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  };
}

/** 序列化提现数据 */
export function serializeWithdrawal(
  w: Withdrawal & { teacher?: Teacher | null },
) {
  return {
    id: w.id,
    teacherName: w.teacher?.name || "",
    amount: w.amount,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
  };
}
