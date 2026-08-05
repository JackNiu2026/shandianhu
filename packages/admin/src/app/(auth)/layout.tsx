import * as React from "react";

/**
 * 认证布局
 * - min-h-screen flex items-center justify-center bg-surface-base p-8
 * - 背景加 radial-gradient 光晕效果
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-surface-base p-8"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(150, 122, 233, 0.12) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(255, 190, 152, 0.12) 0%, transparent 45%)",
      }}
    >
      {children}
    </div>
  );
}
