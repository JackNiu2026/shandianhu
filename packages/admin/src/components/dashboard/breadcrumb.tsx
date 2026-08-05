"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * 路径分段到中文标签的映射
 */
const pathLabelMap: Record<string, string> = {
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
  login: "登录",
};

/**
 * Neo-brutalism 面包屑
 * - 使用 usePathname 获取路径
 * - 将路径分段映射为中文标签
 * - 用 "/" 分隔，最后一项加粗
 */
export default function Breadcrumb() {
  const pathname = usePathname();

  // 拆分路径并过滤空段
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav className="flex items-center text-sm">
        <span className="font-bold text-ink">首页</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <span className="text-ink-muted">首页</span>
      {segments.map((seg, index) => {
        const isLast = index === segments.length - 1;
        const label = pathLabelMap[seg] || seg;

        return (
          <React.Fragment key={`${seg}-${index}`}>
            <span className="text-ink-muted">/</span>
            {isLast ? (
              <span className="font-bold text-ink">{label}</span>
            ) : (
              <span className="text-ink-muted">{label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
