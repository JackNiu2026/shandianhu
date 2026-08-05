"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const routeNames: Record<string, string> = {
  dashboard: "数据看板",
  teachers: "老师管理",
  parents: "家长管理",
  bookings: "预约管理",
  assessments: "测评题库",
  reviews: "评价管理",
  finance: "财务管理",
  memberships: "会员管理",
  content: "内容配置",
  settings: "系统设置",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-2 text-sm text-ink-muted mb-4">
      <Link href="/dashboard" className="hover:text-ink transition-colors">
        首页
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
