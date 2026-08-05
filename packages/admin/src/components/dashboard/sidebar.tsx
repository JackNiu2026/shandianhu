"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "数据看板", icon: "📊" },
  { href: "/teachers", label: "老师管理", icon: "👨‍🏫" },
  { href: "/parents", label: "家长管理", icon: "👨‍👩‍👧" },
  { href: "/bookings", label: "预约管理", icon: "📅" },
  { href: "/assessments", label: "测评题库", icon: "🧠" },
  { href: "/reviews", label: "评价管理", icon: "⭐" },
  { href: "/finance", label: "财务管理", icon: "💰" },
  { href: "/memberships", label: "会员管理", icon: "🎟️" },
  { href: "/content", label: "内容配置", icon: "⚙️" },
  { href: "/settings", label: "系统设置", icon: "🔧" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-surface-paper border-r-2 border-ink h-screen sticky top-0 flex flex-col">
      <div className="p-5 border-b-2 border-ink">
        <h1 className="text-lg font-bold text-ink flex items-center gap-2">
          <span>⚡</span>
          <span>闪电虎</span>
        </h1>
        <p className="text-xs text-ink-muted mt-1">管理后台</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-growth text-white border-l-4 border-ink"
                  : "text-ink hover:bg-growth-soft border-l-4 border-transparent",
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
