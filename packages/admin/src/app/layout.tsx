import type { Metadata } from "next";
import * as React from "react";
import "./globals.css";

/**
 * 根布局元数据
 */
export const metadata: Metadata = {
  title: "闪电虎管理后台",
  description: "闪电虎 B 端管理后台 - 老师管理、家长管理、预约管理、财务管理等",
};

/**
 * 根布局
 * - html lang="zh-CN"
 * - body className="font-sans antialiased"
 * - 引入 globals.css
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
