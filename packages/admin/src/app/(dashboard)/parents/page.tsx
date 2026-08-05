"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, Badge, DataTable } from "@/components/ui";
import { statusToVariant } from "@/lib/utils";
import { getParents } from "@/lib/data";

interface Parent {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  childGrade: string;
  bookingCount: number;
  status: string;
}

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getParents()
      .then((data) => { setParents(data as Parent[]); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  const columns = [
    { key: "name", header: "姓名", render: (p: Parent) => (
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-growth-soft flex items-center justify-center text-sm font-bold">{p.avatar}</span>
        <span className="font-medium">{p.name}</span>
      </div>
    ) },
    { key: "phone", header: "手机号" },
    { key: "childGrade", header: "孩子学段" },
    { key: "bookingCount", header: "预约数" },
    { key: "status", header: "状态", render: (p: Parent) => <Badge variant={statusToVariant(p.status)}>{p.status === "active" ? "正常" : "已封禁"}</Badge> },
    { key: "actions", header: "操作", render: (p: Parent) => <Link href={`/parents/${p.id}`} className="text-growth text-sm hover:underline">查看</Link> },
  ];

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">家长管理</h2>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <Card>
        <DataTable columns={columns} data={parents} loading={loading} emptyMessage="暂无家长数据" />
      </Card>
    </div>
  );
}
