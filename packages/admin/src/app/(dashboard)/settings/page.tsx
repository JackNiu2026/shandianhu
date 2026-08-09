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
      if (!response.ok) throw new Error(result.error || "Password update failed");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password update failed");
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
        <h1 className="text-2xl font-bold text-ink">Account settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage this administrator session and password.</p>
      </div>
      <Card title="Change password">
        <div className="space-y-4">
          <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" />
          <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (at least 8 characters)" />
          {message && <p className="text-sm text-danger">{message}</p>}
          <Button variant="primary" onClick={changePassword} disabled={saving}>{saving ? "Saving..." : "Update password"}</Button>
        </div>
      </Card>
      <Card title="Sign out">
        <Button variant="danger" onClick={logout}>Sign out</Button>
      </Card>
    </div>
  );
}
