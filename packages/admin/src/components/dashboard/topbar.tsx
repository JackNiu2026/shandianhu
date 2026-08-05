import * as React from "react";
import Link from "next/link";
import Breadcrumb from "./breadcrumb";

/**
 * Neo-brutalism 顶部栏
 * - h-16 bg-surface-paper border-b-2 border-ink flex items-center justify-between px-6
 * - 左侧：面包屑组件
 * - 右侧：管理员信息 "admin" + 登出按钮（使用 Link 到 /login）
 */
export default function Topbar() {
  return (
    <header className="h-16 bg-surface-paper border-b-2 border-ink flex items-center justify-between px-6 flex-shrink-0">
      {/* 左侧：面包屑 */}
      <Breadcrumb />

      {/* 右侧：管理员信息 + 登出 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg border-2 border-ink bg-growth flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <span className="text-sm font-semibold text-ink">admin</span>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-lg border-2 border-ink bg-white text-ink font-semibold shadow-nb-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer select-none"
        >
          登出
        </Link>
      </div>
    </header>
  );
}
