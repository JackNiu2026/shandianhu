"use client";

/**
 * 全局错误边界（App Router）
 * 当 root layout 自身抛错时触发，会替代 root layout 渲染
 * 必须包含 <html><body> 标签
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "#F5F2F0",
          color: "#151617",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          应用发生严重错误
        </h1>
        <p style={{ color: "#756E69", marginBottom: "1.5rem" }}>
          {error.message || "请刷新页面或联系管理员"}
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
      </body>
    </html>
  );
}
