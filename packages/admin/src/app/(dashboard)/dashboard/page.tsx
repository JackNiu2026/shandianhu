import Link from "next/link";
import { prisma } from "@/server/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [families, children, activeTeachers, pendingTrials, activeLessons, unreadNotifications] = await Promise.all([
    prisma.parentProfile.count(), prisma.child.count({ where: { deletedAt: null } }), prisma.teacherProfile.count({ where: { serviceStatus: "ACTIVE" } }), prisma.trialBooking.count({ where: { status: "REQUESTED" } }), prisma.lesson.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } } }), prisma.notification.count({ where: { status: "UNREAD" } }),
  ]);
  const stats = [{ label: "家庭", value: families, href: "/families" }, { label: "孩子档案", value: children, href: "/families" }, { label: "在服老师", value: activeTeachers, href: "/teachers" }, { label: "待确认试听", value: pendingTrials, href: "/academics/trials" }, { label: "进行中课程", value: activeLessons, href: "/academics/lessons" }, { label: "未读业务通知", value: unreadNotifications, href: "/notifications" }];
  return <div className="space-y-6"><div><h2 className="text-xl font-bold">运营概览</h2><p className="mt-1 text-sm text-ink-muted">家庭、老师、教务与通知的实时监督摘要。</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map((item) => <Link href={item.href} key={item.label}><Card className="transition-transform hover:-translate-y-0.5"><p className="text-sm text-ink-muted">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></Card></Link>)}</div></div>;
}
