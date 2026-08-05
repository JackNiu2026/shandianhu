"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, CardHeader } from "@/components/ui";

interface ContentConfig {
  subjects: string[];
  grades: string[];
  budgetOptions: { label: string; value: number }[];
  platformStats: { teacherCount: number; parentCount: number };
}

export default function ContentPage() {
  const [config, setConfig] = useState<ContentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/content")
      .then((res) => { if (!res.ok) throw new Error("加载失败"); return res.json(); })
      .then((data) => { setConfig(data); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  if (loading) return <div className="text-center py-12 text-ink-muted">加载中...</div>;
  if (error) return <div className="text-center py-12 text-danger">{error}</div>;
  if (!config) return <div className="text-center py-12 text-ink-muted">暂无数据</div>;

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">内容配置</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="科目配置" />
          <div className="flex flex-wrap gap-2">
            {config.subjects.map((s) => (
              <span key={s} className="px-3 py-1 text-sm border-2 border-ink rounded-lg bg-surface-soft">{s}</span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="学段配置" />
          <div className="flex flex-wrap gap-2">
            {config.grades.map((g) => (
              <span key={g} className="px-3 py-1 text-sm border-2 border-ink rounded-lg bg-surface-soft">{g}</span>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="预算配置" />
          <div className="space-y-2">
            {config.budgetOptions.map((b) => (
              <div key={b.value} className="flex justify-between text-sm">
                <span>{b.label}</span>
                <span className="text-ink-muted">¥{b.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="平台统计" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">老师总数</span><span className="font-bold">{config.platformStats.teacherCount}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">家长总数</span><span className="font-bold">{config.platformStats.parentCount}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
