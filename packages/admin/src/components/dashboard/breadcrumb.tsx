"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const routeNames: Record<string, string> = {
  dashboard: "运营概览",
  families: "家庭管理",
  assessments: "学情中心",
  academics: "教务管理",
  trials: "试听管理",
  lessons: "课程管理",
  feedback: "反馈管理",
  teachers: "老师审核",
  agents: "智能体中心",
  "audit-logs": "安全审计",
  notifications: "通知中心",
  settings: "系统设置",
};

export function Breadcrumb() {
  const pathname = usePathname() || "";
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-2 text-sm text-ink-muted mb-4">
      <Link href="/dashboard" className="hover:text-ink transition-colors">
        运营概览
      </Link>
      {segments.map((seg, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const name = routeNames[seg] || seg;
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex items-center gap-2">
            <span className="text-ink-muted">/</span>
            {isLast ? (
              <span className="text-ink font-medium">{name}</span>
            ) : (
              <Link href={path} className="hover:text-ink transition-colors">
                {name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
