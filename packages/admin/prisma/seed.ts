/**
 * 种子数据脚本
 * 使用 @lightning-tiger/shared 中的数据初始化数据库
 * 运行方式：npx tsx prisma/seed.ts 或 npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { teachers } from "@lightning-tiger/shared";
import type { Teacher, Prefs, MBTIResult } from "@lightning-tiger/shared";

const prisma = new PrismaClient();

/* ============ 老师状态列表 ============ */
const teacherStatusList = [
  "active", "active", "active", "active", "pending", "active", "active", "active",
] as const;

const teacherRevenue = [
  { total: 12680, pending: 2460, available: 8920, lessons: 186 },
  { total: 15200, pending: 1800, available: 9800, lessons: 210 },
  { total: 9800, pending: 1200, available: 6800, lessons: 142 },
  { total: 8400, pending: 900, available: 5600, lessons: 168 },
  { total: 4200, pending: 0, available: 2800, lessons: 85 },
  { total: 11000, pending: 1500, available: 7200, lessons: 154 },
  { total: 7600, pending: 800, available: 4800, lessons: 120 },
  { total: 13800, pending: 2100, available: 9100, lessons: 198 },
];

/* ============ 家长数据 ============ */
const parentData = [
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

const mbtiResults: (MBTIResult | null)[] = [
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

const parentStatuses = [
  "active", "active", "active", "active", "blocked", "active", "active", "active", "active", "active",
];

/* ============ 预约数据 ============ */
const bookingSlots = [
  "周六 14:00", "周日 10:00", "周五 19:30", "周六 09:00", "周三 18:30",
  "周四 19:00", "周六 13:00", "周日 16:30",
];
const bookingStatuses = [
  "completed", "confirmed", "pending", "cancelled", "completed",
  "confirmed", "pending", "completed", "confirmed", "pending",
  "completed", "cancelled", "confirmed", "pending", "completed",
];

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
const reviewStatuses = [
  "approved", "approved", "pending", "approved", "approved",
  "approved", "approved", "approved", "approved", "approved",
  "approved", "approved", "pending", "approved", "approved",
  "approved", "pending", "rejected", "approved", "approved",
];

/* ============ 会员数据 ============ */
const membershipData = [
  { parentName: "陈晓彤", duration: "月度会员", amount: 19.9, startDate: "2026-07-01", endDate: "2026-08-01", status: "active" },
  { parentName: "王思远", duration: "季度会员", amount: 49.9, startDate: "2026-06-15", endDate: "2026-09-15", status: "active" },
  { parentName: "李明轩", duration: "月度会员", amount: 19.9, startDate: "2026-06-01", endDate: "2026-07-01", status: "expired" },
  { parentName: "张雨晴", duration: "年度会员", amount: 199, startDate: "2026-01-01", endDate: "2026-12-31", status: "active" },
  { parentName: "刘子涵", duration: "月度会员", amount: 19.9, startDate: "2026-05-01", endDate: "2026-06-01", status: "cancelled" },
];

/* ============ 提现数据 ============ */
const withdrawalData = [
  { teacherName: "林知夏", amount: 5000, status: "pending", createdAt: new Date("2026-08-01") },
  { teacherName: "周予安", amount: 3000, status: "processed", createdAt: new Date("2026-07-28") },
  { teacherName: "陈默", amount: 2000, status: "pending", createdAt: new Date("2026-08-03") },
  { teacherName: "叶承川", amount: 4000, status: "processed", createdAt: new Date("2026-07-20") },
];

/* ============ 主函数 ============ */
async function main() {
  console.log("开始种子数据初始化...");

  // 清空现有数据
  console.log("清空现有数据...");
  await prisma.withdrawal.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.adminUser.deleteMany();

  // 1. 创建管理员用户
  console.log("创建管理员用户...");
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.create({
    data: {
      username: "admin",
      password: hashedPassword,
      role: "superadmin",
    },
  });
  console.log("  管理员用户创建完成 (admin / admin123)");

  // 2. 创建老师数据（来自 @lightning-tiger/shared）
  console.log("创建老师数据...");
  const teacherIds: string[] = [];
  for (let i = 0; i < teachers.length; i++) {
    const t: Teacher = teachers[i];
    const revenue = teacherRevenue[i] || { total: 5000, pending: 0, available: 3000, lessons: 50 };
    const teacher = await prisma.teacher.create({
      data: {
        name: t.name,
        age: t.age,
        school: t.school,
        subject: t.subject,
        grades: JSON.stringify(t.grades),
        mode: t.mode,
        tags: JSON.stringify(t.tags),
        color: t.color,
        note: t.note,
        rating: t.rating,
        students: t.students,
        years: t.years,
        price: t.price,
        slots: JSON.stringify(t.slots),
        video: t.video,
        checks: JSON.stringify(t.checks),
        status: teacherStatusList[i] || "active",
        totalRevenue: revenue.total,
        pendingRevenue: revenue.pending,
        availableRevenue: revenue.available,
        totalLessons: revenue.lessons,
        createdAt: new Date(2026, 6, 1 + i * 3),
        updatedAt: new Date(2026, 7, 1 + i * 2),
      },
    });
    teacherIds.push(teacher.id);
  }
  console.log(`  创建了 ${teacherIds.length} 位老师`);

  // 3. 创建家长数据
  console.log("创建家长数据...");
  const parentIds: string[] = [];
  for (let i = 0; i < parentData.length; i++) {
    const p = parentData[i];
    const prefs: Prefs | null = i % 3 === 0
      ? null
      : { grade: p.grade, subject: ["语文", "数学", "英语", "物理", "化学"][i % 5], budget: [100, 200, 999][i % 3] };
    const mbti = mbtiResults[i % mbtiResults.length];
    const likedTeachers = teachers.slice(0, (i % 3) + 1).map((t) => t.name);

    const parent = await prisma.parent.create({
      data: {
        name: p.name,
        avatar: p.avatar,
        phone: p.phone,
        childGrade: p.grade,
        prefs: prefs ? JSON.stringify(prefs) : null,
        mbtiResult: mbti ? JSON.stringify(mbti) : null,
        likedTeachers: JSON.stringify(likedTeachers),
        bookingCount: (i % 4) + (i % 2),
        status: parentStatuses[i],
        createdAt: new Date(2026, 5, 5 + i * 4),
      },
    });
    parentIds.push(parent.id);
  }
  console.log(`  创建了 ${parentIds.length} 位家长`);

  // 4. 创建预约数据（15 条）
  console.log("创建预约数据...");
  for (let i = 0; i < 15; i++) {
    const parentIdx = i % parentIds.length;
    const teacherIdx = i % teacherIds.length;
    await prisma.booking.create({
      data: {
        parentId: parentIds[parentIdx],
        teacherId: teacherIds[teacherIdx],
        subject: teachers[teacherIdx].subject,
        slot: bookingSlots[i % bookingSlots.length],
        status: bookingStatuses[i],
        createdAt: new Date(2026, 7, 1 + i),
      },
    });
  }
  console.log("  创建了 15 条预约");

  // 5. 创建评价数据（20 条）
  console.log("创建评价数据...");
  for (let i = 0; i < 20; i++) {
    const teacherIdx = i % teacherIds.length;
    const teacher = teachers[teacherIdx];
    const review = teacher.reviews[i % teacher.reviews.length];
    await prisma.review.create({
      data: {
        teacherId: teacherIds[teacherIdx],
        author: review.by,
        text: reviewTexts[i],
        rating: 4 + (i % 2),
        status: reviewStatuses[i],
        createdAt: new Date(2026, 6, 1 + i),
      },
    });
  }
  console.log("  创建了 20 条评价");

  // 6. 创建会员数据（5 条）
  console.log("创建会员数据...");
  for (const m of membershipData) {
    const parentIdx = parentData.findIndex((p) => p.name === m.parentName);
    if (parentIdx >= 0 && parentIds[parentIdx]) {
      await prisma.membership.create({
        data: {
          parentId: parentIds[parentIdx],
          duration: m.duration,
          amount: m.amount,
          startDate: m.startDate,
          endDate: m.endDate,
          status: m.status,
          createdAt: new Date(2026, 5, 1),
        },
      });
    }
  }
  console.log("  创建了 5 条会员记录");

  // 7. 创建提现数据（4 条）
  console.log("创建提现数据...");
  for (const w of withdrawalData) {
    await prisma.withdrawal.create({
      data: {
        teacherName: w.teacherName,
        amount: w.amount,
        status: w.status,
        createdAt: w.createdAt,
      },
    });
  }
  console.log("  创建了 4 条提现记录");

  console.log("\n种子数据初始化完成！");
  console.log("管理员账号: admin / admin123");
}

main()
  .catch((e) => {
    console.error("种子数据初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
