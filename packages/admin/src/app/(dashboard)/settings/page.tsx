"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function changePassword() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "密码修改失败");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码修改失败");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">系统设置</h1>
        <p className="mt-1 text-sm text-ink-muted">管理当前管理员会话与登录密码。</p>
      </div>
      <Card title="修改密码">
        <div className="space-y-4">
          <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="当前密码" />
          <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="新密码（至少 8 位）" />
          {message && <p className="text-sm text-danger">{message}</p>}
          <Button variant="primary" onClick={changePassword} disabled={saving}>{saving ? "保存中..." : "更新密码"}</Button>
        </div>
      </Card>
      <Card title="退出登录">
        <Button variant="danger" onClick={logout}>退出当前账号</Button>
      </Card>
    </div>
  );
}
