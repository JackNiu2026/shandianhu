"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, Button, Badge, DataTable } from "@/components/ui";
import { statusToVariant, formatCurrency } from "@/lib/utils";
import { getTeachers } from "@/lib/data";

interface Teacher {
  id: string;
  name: string;
  subject: string;
  grades: string[];
  rating: string;
  price: number;
  status: string;
  students: string;
}

const statusLabels: Record<string, string> = {
  active: "已上线",
  pending: "待审核",
  blocked: "已封禁",
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeachers()
      .then((data) => { setTeachers(data as Teacher[]); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  const columns = [
    { key: "name", header: "姓名", render: (t: Teacher) => <span className="font-medium">{t.name}</span> },
    { key: "subject", header: "科目" },
    { key: "grades", header: "学段", render: (t: Teacher) => (t.grades || []).join(" / ") },
    { key: "rating", header: "评分", render: (t: Teacher) => `⭐ ${t.rating}` },
    { key: "price", header: "价格", render: (t: Teacher) => formatCurrency(t.price) },
    { key: "students", header: "学生数" },
    {
      key: "status",
      header: "状态",
      render: (t: Teacher) => <Badge variant={statusToVariant(t.status)}>{statusLabels[t.status] || t.status}</Badge>,
    },
    {
      key: "actions",
      header: "操作",
      render: (t: Teacher) => (
        <Link href={`/teachers/${t.id}`}>
          <Button size="sm">查看</Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-ink">老师管理</h2>
        <Link href="/teachers/new">
          <Button variant="primary">+ 新建老师</Button>
        </Link>
      </div>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <Card>
        <DataTable
          columns={columns}
          data={teachers}
          loading={loading}
          emptyMessage="暂无老师数据"
        />
      </Card>
    </div>
  );
}
