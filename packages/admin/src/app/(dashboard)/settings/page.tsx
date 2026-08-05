"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword, getPlatformConfig, updatePlatformConfig } from "@/lib/data";

function LogOutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pwdMsg, setPwdMsg] = React.useState<{ type: "error" | "success"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const [platformName, setPlatformName] = React.useState("闪电虎");
  const [contact, setContact] = React.useState("contact@lightning-tiger.com");
  const [savingPlatform, setSavingPlatform] = React.useState(false);
  const [platformMsg, setPlatformMsg] = React.useState<{ type: "error" | "success"; text: string } | null>(null);

  React.useEffect(() => {
    getPlatformConfig()
      .then((cfg) => {
        if (cfg.platformName) setPlatformName(cfg.platformName);
        if (cfg.contact) setContact(cfg.contact);
      })
      .catch(() => {
        // 加载失败时保留默认值
      });
  }, []);

  const handleSavePassword = async () => {
    if (!currentPassword) {
      setPwdMsg({ type: "error", text: "请输入当前密码" });
      return;
    }
    if (!newPassword) {
      setPwdMsg({ type: "error", text: "请输入新密码" });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: "error", text: "密码长度至少 8 位" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: "error", text: "两次输入的密码不一致" });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwdMsg({ type: "success", text: "密码已更新" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwdMsg({ type: "error", text: err instanceof Error ? err.message : "修改密码失败" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePlatform = async () => {
    setSavingPlatform(true);
    setPlatformMsg(null);
    try {
      await updatePlatformConfig({ platformName, contact });
      setPlatformMsg({ type: "success", text: "平台信息已保存" });
    } catch (err) {
      setPlatformMsg({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">系统设置</h1>
        <p className="mt-1 text-sm text-ink/50">
          管理员账户、平台信息与危险操作
        </p>
      </div>

      {/* 管理员信息 */}
      <Card title="管理员信息" description="账户与密码管理">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                用户名
              </label>
              <Input value="admin" readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                当前角色
              </label>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-ink/15 bg-surface-soft px-3">
                <ShieldIcon />
                <span className="text-sm font-medium text-ink">超级管理员</span>
                <Badge variant="primary" className="ml-auto">
                  全部权限
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-t border-ink/10 pt-4">
            <p className="mb-3 text-sm font-medium text-ink">修改密码</p>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-ink/60">
                当前密码
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPwdMsg(null);
                }}
                placeholder="输入当前密码"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/60">
                  新密码
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPwdMsg(null);
                  }}
                  placeholder="输入新密码（至少 8 位）"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink/60">
                  确认密码
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPwdMsg(null);
                  }}
                  placeholder="再次输入新密码"
                />
              </div>
            </div>
            {pwdMsg && (
              <p
                className={`mt-2 text-xs ${
                  pwdMsg.type === "error" ? "text-danger" : "text-success"
                }`}
              >
                {pwdMsg.text}
              </p>
            )}
            <div className="mt-3">
              <Button variant="primary" onClick={handleSavePassword} disabled={savingPassword}>
                {savingPassword ? "保存中..." : "保存密码"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 平台信息 */}
      <Card title="平台信息" description="对外展示的基础信息">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              平台名称
            </label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              联系方式
            </label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="邮箱或电话"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" onClick={handleSavePlatform} disabled={savingPlatform}>
            {savingPlatform ? "保存中..." : "保存"}
          </Button>
          {platformMsg && (
            <span
              className={`text-xs font-medium ${
                platformMsg.type === "error" ? "text-danger" : "text-success"
              }`}
            >
              {platformMsg.text}
            </span>
          )}
        </div>
      </Card>

      {/* 危险操作 */}
      <Card title="危险操作" description="以下操作不可撤销，请谨慎执行">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">退出登录</p>
            <p className="mt-0.5 text-xs text-ink/50">
              退出当前管理员会话，返回登录页
            </p>
          </div>
          <Button
            variant="danger"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOutIcon />
            {loggingOut ? "登出中..." : "登出"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
