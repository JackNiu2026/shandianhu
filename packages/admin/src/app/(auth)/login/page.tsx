"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import {
  validateCredentials,
  generateToken,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";

/**
 * 登录表单内容（使用 useSearchParams，需要 Suspense 包裹）
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 验证凭据
    if (!validateCredentials(username, password)) {
      setError("用户名或密码错误");
      setLoading(false);
      return;
    }

    // 设置 admin-token Cookie
    const token = generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; expires=${expires}; SameSite=Lax`;

    // 获取回调 URL，默认跳转到 /dashboard
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    router.push(callbackUrl);
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
 * - 居中登录卡片：max-w-md w-full bg-surface-paper border-2 border-ink rounded-2xl shadow-nb-lg p-8
 * - 标题 "⚡ 闪电虎管理后台"
 * - 用户名 input + 密码 input
 * - 登录按钮（primary variant, w-full）
 * - 默认凭据提示
 * - 提交后验证，成功则 document.cookie 设置 admin-token，然后 router.push('/dashboard')
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
