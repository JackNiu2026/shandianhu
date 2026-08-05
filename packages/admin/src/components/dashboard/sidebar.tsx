"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

/**
 * 侧边栏导航项（10个）
 */
const navItems: NavItem[] = [
  { icon: "📊", label: "数据看板", href: "/dashboard" },
  { icon: "👥", label: "老师管理", href: "/teachers" },
  { icon: "👨‍👩‍👧", label: "家长管理", href: "/parents" },
  { icon: "📅", label: "预约管理", href: "/bookings" },
  { icon: "📝", label: "测评题库", href: "/assessments" },
  { icon: "⭐", label: "评价管理", href: "/reviews" },
  { icon: "💰", label: "财务管理", href: "/finance" },
  { icon: "👑", label: "会员管理", href: "/memberships" },
  { icon: "⚙️", label: "内容配置", href: "/content" },
  { icon: "🔧", label: "系统设置", href: "/settings" },
];

/**
 * Neo-brutalism 侧边栏
 * - w-64 h-full bg-surface-paper border-r-2 border-ink flex flex-col
 * - 使用 usePathname 高亮当前路由
 * - 选中项：bg-growth text-white border-2 border-ink shadow-nb-sm rounded-lg
 * - 未选中：hover:bg-surface-soft rounded-lg
 */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-full bg-surface-paper border-r-2 border-ink flex flex-col flex-shrink-0">
      {/* 品牌区 */}
      <div className="p-6 border-b-2 border-ink">
        <h1 className="text-xl font-black text-ink flex items-center gap-2">
          <span>⚡</span>
          <span>闪电虎</span>
        </h1>
        <p className="mt-1 text-xs font-medium text-ink-muted">管理后台</p>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 font-semibold text-sm transition-all",
                isActive
                  ? "bg-growth text-white border-2 border-ink shadow-nb-sm rounded-lg"
                  : "text-ink hover:bg-surface-soft rounded-lg border-2 border-transparent",
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 底部信息 */}
      <div className="p-4 border-t-2 border-ink">
        <p className="text-xs text-ink-muted text-center">
          v0.1.0 · Neo-brutalism
        </p>
      </div>
    </aside>
  );
}
