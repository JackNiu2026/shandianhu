"use client";

/**
 * 路由级错误边界（App Router）
 * 捕获子路由抛出的运行时错误，提供重试入口
 * 替代已删除的 Pages Router _error.tsx
 */
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Route Error]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        页面出错了
      </h1>
      <p style={{ color: "#756E69", marginBottom: "1.5rem" }}>
        {error.message || "发生未知错误，请稍后重试"}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1.5rem",
          border: "2px solid #151617",
          background: "#967AE9",
          color: "#fff",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 600,
          boxShadow: "4px 4px 0 0 #151617",
        }}
      >
        重试
      </button>
    </div>
  );
}
