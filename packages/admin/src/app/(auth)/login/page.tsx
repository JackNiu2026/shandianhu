"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * 登录表单内容（使用 useSearchParams，需要 Suspense 包裹）
 * 通过 /api/auth/login API Route 设置 HttpOnly Cookie
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "登录失败" }));
        setError(data.error || "用户名或密码错误");
        setLoading(false);
        return;
      }

      // Cookie 已由服务端通过 HttpOnly 设置
      const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full">
      <div className="bg-surface-paper border-2 border-ink rounded-2xl shadow-nb-lg p-8">
        {/* 标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black text-ink flex items-center justify-center gap-2">
            <span>⚡</span>
            <span>闪电虎管理后台</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">请登录以继续</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="用户名"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            autoComplete="username"
            required
          />

          <Input
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoComplete="current-password"
            error={error || undefined}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? "登录中..." : "登 录"}
          </Button>
        </form>

        {/* 默认凭据提示 */}
        <div className="mt-6 p-3 rounded-lg border-2 border-dashed border-ink-muted/40 bg-surface-soft">
          <p className="text-xs text-ink-muted text-center">
            默认账号: <span className="font-mono font-bold text-ink">admin</span> /{" "}
            <span className="font-mono font-bold text-ink">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 登录页
 * - 通过 /api/auth/login API 设置 HttpOnly Cookie（安全）
 * - 不再使用 document.cookie 明文写入
 */
export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-md w-full">
          <div className="bg-surface-paper border-2 border-ink rounded-2xl shadow-nb-lg p-8">
            <div className="h-64 flex items-center justify-center">
              <span className="text-ink-muted">加载中...</span>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
