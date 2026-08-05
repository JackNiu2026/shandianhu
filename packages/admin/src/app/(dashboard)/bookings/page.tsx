"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, Badge, DataTable, Button } from "@/components/ui";
import { statusToVariant, formatDateTime } from "@/lib/utils";
import { getBookings, updateBookingStatus } from "@/lib/data";
import type { Booking } from "@/lib/types";

const statusLabels: Record<string, string> = {
  pending: "待确认",
  confirmed: "已确认",
  completed: "已完成",
  cancelled: "已取消",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getBookings()
      .then((data) => { setBookings(data); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  async function handleUpdateStatus(id: string, status: Booking["status"]) {
    try {
      await updateBookingStatus(id, status);
      setBookings(bookings.map((b) => (b.id === id ? { ...b, status } : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  const columns = [
    { key: "parentName", header: "家长" },
    { key: "teacherName", header: "老师" },
    { key: "subject", header: "科目" },
    { key: "slot", header: "时段" },
    { key: "createdAt", header: "创建时间", render: (b: Booking) => formatDateTime(b.createdAt) },
    { key: "status", header: "状态", render: (b: Booking) => <Badge variant={statusToVariant(b.status)}>{statusLabels[b.status] || b.status}</Badge> },
    {
      key: "actions", header: "操作", render: (b: Booking) => (
        <div className="flex gap-2">
          {b.status === "pending" && <Button size="sm" variant="success" onClick={() => handleUpdateStatus(b.id, "confirmed")}>确认</Button>}
          {(b.status === "pending" || b.status === "confirmed") && <Button size="sm" variant="danger" onClick={() => handleUpdateStatus(b.id, "cancelled")}>取消</Button>}
          {b.status === "confirmed" && <Button size="sm" variant="primary" onClick={() => handleUpdateStatus(b.id, "completed")}>完成</Button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">预约管理</h2>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <Card>
        <DataTable columns={columns} data={bookings} loading={loading} emptyMessage="暂无预约数据" />
      </Card>
    </div>
  );
}
