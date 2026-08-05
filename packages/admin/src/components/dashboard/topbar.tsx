"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "./breadcrumb";

/**
 * Neo-brutalism 顶部栏
 * - 左侧：面包屑
 * - 右侧：管理员信息 + 登出按钮
 * - 登出通过 /api/auth/logout API Route 清除 HttpOnly Cookie
 */
export default function Topbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      // 即使 API 失败也跳转到登录页
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

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
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-lg border-2 border-ink bg-white text-ink font-semibold shadow-nb-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer select-none disabled:opacity-50"
        >
          {loggingOut ? "登出中..." : "登出"}
        </button>
      </div>
    </header>
  );
}
