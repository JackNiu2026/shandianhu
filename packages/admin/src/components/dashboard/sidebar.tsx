"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "运营概览", icon: "概" },
  { href: "/families", label: "家庭管理", icon: "家" },
  { href: "/assessments", label: "学情中心", icon: "学" },
  { href: "/academics", label: "教务管理", icon: "教" },
  { href: "/agents", label: "智能体中心", icon: "智" },
  { href: "/audit-logs", label: "安全审计", icon: "审" },
  { href: "/notifications", label: "通知监控", icon: "通" },
  { href: "/settings", label: "系统设置", icon: "设" },
];

export function Sidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r-2 border-ink bg-surface-paper md:flex">
      <div className="border-b-2 border-ink p-5">
        <h1 className="flex items-center gap-2 text-lg font-bold text-ink">闪电虎</h1>
        <p className="mt-1 text-xs text-ink-muted">家庭教育工作站</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm font-medium transition-all",
              isActive ? "border-ink bg-growth text-white" : "border-transparent text-ink hover:bg-growth-soft",
            )}>
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
