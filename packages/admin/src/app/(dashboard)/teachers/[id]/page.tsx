"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { statusToVariant, formatCurrency, formatDateTime } from "@/lib/utils";
import { getTeacherById } from "@/lib/data";

interface TeacherDetail {
  id: string;
  name: string;
  age: string;
  school: string;
  subject: string;
  grades: string[];
  mode: string;
  tags: string[];
  color: string;
  note: string;
  rating: string;
  students: string;
  years: string;
  price: number;
  slots: string[];
  video: string;
  checks: string[];
  status: string;
  totalRevenue: number;
  pendingRevenue: number;
  availableRevenue: number;
  totalLessons: number;
  createdAt: string;
  reviews: { id: string; author: string; text: string; rating: number; status: string }[];
  bookings: { id: string; parentName: string; subject: string; slot: string; status: string }[];
}

export default function TeacherDetailPage() {
  const params = useParams();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.id) {
      getTeacherById(params.id as string)
        .then((data) => { setTeacher(data as unknown as TeacherDetail); setLoading(false); })
        .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
    }
  }, [params.id]);

  if (loading) return <div className="text-center py-12 text-ink-muted">加载中...</div>;
  if (error) return <div className="text-center py-12 text-danger">{error}</div>;
  if (!teacher) return <div className="text-center py-12 text-ink-muted">老师不存在</div>;

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-4">
        <Link href="/teachers">
          <Button size="sm">← 返回列表</Button>
        </Link>
        <Badge variant={statusToVariant(teacher.status)}>{teacher.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="老师信息" />
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full border-2 border-ink flex items-center justify-center text-2xl font-bold"
                style={{ backgroundColor: teacher.color }}
              >
                {teacher.name[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold">{teacher.name}</h3>
                <p className="text-sm text-ink-muted">{teacher.age} · {teacher.school}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-ink-muted">科目：</span>{teacher.subject}</div>
              <div><span className="text-ink-muted">学段：</span>{(teacher.grades || []).join(" / ")}</div>
              <div><span className="text-ink-muted">模式：</span>{teacher.mode}</div>
              <div><span className="text-ink-muted">评分：</span>⭐ {teacher.rating}</div>
              <div><span className="text-ink-muted">学生：</span>{teacher.students}</div>
              <div><span className="text-ink-muted">教龄：</span>{teacher.years}</div>
              <div><span className="text-ink-muted">价格：</span>{formatCurrency(teacher.price)}</div>
              <div><span className="text-ink-muted">课时：</span>{teacher.totalLessons}</div>
            </div>
            {teacher.note && <p className="text-sm italic text-ink-muted border-l-2 border-ink pl-3">{teacher.note}</p>}
            <div className="flex flex-wrap gap-2">
              {(teacher.tags || []).map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-growth-soft text-growth rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="收益统计" />
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">总收入</span><span className="font-bold">{formatCurrency(teacher.totalRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">待结算</span><span>{formatCurrency(teacher.pendingRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">可提现</span><span className="text-success">{formatCurrency(teacher.availableRevenue)}</span></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader title="核验项" />
          <div className="space-y-2">
            {(teacher.checks || []).map((check) => (
              <div key={check} className="flex items-center gap-2 text-sm">
                <span className="text-success">✓</span> {check}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="可约时段" />
          <div className="flex flex-wrap gap-2">
            {(teacher.slots || []).map((slot) => (
              <span key={slot} className="px-3 py-1 text-sm border-2 border-ink rounded-lg bg-surface-soft">{slot}</span>
            ))}
          </div>
        </Card>
      </div>

      {teacher.reviews && teacher.reviews.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="评价" />
          <div className="space-y-3">
            {teacher.reviews.map((review) => (
              <div key={review.id} className="border-b border-ink/10 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{review.author}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⭐ {review.rating}</span>
                    <Badge variant={statusToVariant(review.status)}>{review.status}</Badge>
                  </div>
                </div>
                <p className="text-sm text-ink-muted">{review.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
