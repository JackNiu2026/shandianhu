"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, Badge, DataTable } from "@/components/ui";
import { statusToVariant, formatCurrency } from "@/lib/utils";
import { getMemberships } from "@/lib/data";
import type { Membership } from "@/lib/types";

const statusLabels: Record<string, string> = {
  active: "有效",
  expired: "已过期",
  cancelled: "已取消",
};

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMemberships()
      .then((data) => { setMemberships(data); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  const columns = [
    { key: "parentName", header: "家长" },
    { key: "duration", header: "套餐" },
    { key: "amount", header: "金额", render: (m: Membership) => formatCurrency(m.amount) },
    { key: "startDate", header: "开始日期" },
    { key: "endDate", header: "结束日期" },
    { key: "status", header: "状态", render: (m: Membership) => <Badge variant={statusToVariant(m.status)}>{statusLabels[m.status] || m.status}</Badge> },
  ];

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">会员管理</h2>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <Card>
        <DataTable columns={columns} data={memberships} loading={loading} emptyMessage="暂无会员数据" />
      </Card>
    </div>
  );
}
