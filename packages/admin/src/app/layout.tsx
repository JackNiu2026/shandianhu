import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "闪电虎管理后台",
  description: "闪电虎 B 端管理后台 - Next.js 15",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
