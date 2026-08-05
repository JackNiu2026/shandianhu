"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { statusToVariant, formatDate } from "@/lib/utils";
import { getParentById } from "@/lib/data";

interface ParentDetail {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  childGrade: string;
  prefs: { grade: string; subject: string; budget: number } | null;
  mbtiResult: { code: string; label: string; advice: string[] } | null;
  likedTeachers: string[];
  bookingCount: number;
  status: string;
  createdAt: string;
  bookings: { id: string; teacherName: string; subject: string; slot: string; status: string }[];
  memberships: { id: string; duration: string; amount: number; status: string }[];
}

export default function ParentDetailPage() {
  const params = useParams();
  const [parent, setParent] = useState<ParentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.id) {
      getParentById(params.id as string)
        .then((data) => { setParent(data as ParentDetail); setLoading(false); })
        .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
    }
  }, [params.id]);

  if (loading) return <div className="text-center py-12 text-ink-muted">加载中...</div>;
  if (error) return <div className="text-center py-12 text-danger">{error}</div>;
  if (!parent) return <div className="text-center py-12 text-ink-muted">家长不存在</div>;

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-4">
        <Link href="/parents"><Button size="sm">← 返回列表</Button></Link>
        <Badge variant={statusToVariant(parent.status)}>{parent.status === "active" ? "正常" : "已封禁"}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="基本信息" />
          <div className="flex items-center gap-4 mb-4">
            <span className="w-12 h-12 rounded-full bg-growth-soft flex items-center justify-center text-xl font-bold">{parent.avatar}</span>
            <div>
              <h3 className="font-bold">{parent.name}</h3>
              <p className="text-sm text-ink-muted">{parent.phone}</p>
            </div>
          </div>
          <div className="text-sm space-y-2">
            <div><span className="text-ink-muted">孩子学段：</span>{parent.childGrade}</div>
            <div><span className="text-ink-muted">预约数：</span>{parent.bookingCount}</div>
            <div><span className="text-ink-muted">注册时间：</span>{formatDate(parent.createdAt)}</div>
          </div>
        </Card>

        <Card>
          <CardHeader title="筛选偏好" />
          {parent.prefs ? (
            <div className="text-sm space-y-2">
              <div><span className="text-ink-muted">学段：</span>{parent.prefs.grade}</div>
              <div><span className="text-ink-muted">科目：</span>{parent.prefs.subject}</div>
              <div><span className="text-ink-muted">预算：</span>¥{parent.prefs.budget}</div>
            </div>
          ) : <p className="text-sm text-ink-muted">暂无偏好设置</p>}
        </Card>

        {parent.mbtiResult && (
          <Card>
            <CardHeader title="MBTI 测评结果" />
            <div className="text-sm space-y-2">
              <div className="text-lg font-bold text-growth">{parent.mbtiResult.code}</div>
              <div className="text-ink-muted">{parent.mbtiResult.label}</div>
              <div className="space-y-1">
                {parent.mbtiResult.advice.map((a, i) => (
                  <div key={i} className="flex items-start gap-2"><span className="text-success">✓</span> {a}</div>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="收藏老师" />
          <div className="flex flex-wrap gap-2">
            {(parent.likedTeachers || []).map((name) => (
              <span key={name} className="px-3 py-1 text-sm border-2 border-ink rounded-lg bg-surface-soft">{name}</span>
            ))}
            {(!parent.likedTeachers || parent.likedTeachers.length === 0) && <span className="text-sm text-ink-muted">暂无收藏</span>}
          </div>
        </Card>
      </div>

      {parent.bookings && parent.bookings.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="预约记录" />
          <div className="space-y-2">
            {parent.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-ink/10 pb-2 text-sm">
                <span>{b.teacherName} · {b.subject} · {b.slot}</span>
                <Badge variant={statusToVariant(b.status)}>{b.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
