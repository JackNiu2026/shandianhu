import * as React from "react";
import Sidebar from "@/components/dashboard/sidebar";
import Topbar from "@/components/dashboard/topbar";

/**
 * 后台布局
 * - flex h-screen
 * - 左侧 Sidebar（w-64 flex-shrink-0）
 * - 右侧 flex-1 flex flex-col overflow-hidden：Topbar + main
 * - main 区域 flex-1 overflow-y-auto p-6 bg-surface-base
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 左侧侧边栏 */}
      <Sidebar />

      {/* 右侧主区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部栏 */}
        <Topbar />

        {/* 内容区 */}
        <main className="flex-1 overflow-y-auto p-6 bg-surface-base">
          {children}
        </main>
      </div>
    </div>
  );
}
