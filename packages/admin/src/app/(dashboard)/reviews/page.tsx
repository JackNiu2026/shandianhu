"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, Badge, Button, DataTable } from "@/components/ui";
import { statusToVariant, formatDateTime } from "@/lib/utils";
import { getReviews, updateReviewStatus, deleteReview } from "@/lib/data";
import type { Review } from "@/lib/types";

const statusLabels: Record<string, string> = {
  approved: "已通过",
  pending: "待审核",
  rejected: "已拒绝",
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getReviews()
      .then((data) => { setReviews(data); setLoading(false); })
      .catch((err) => { setError(err.message || "加载失败"); setLoading(false); });
  }, []);

  async function handleUpdateStatus(id: string, status: Review["status"]) {
    try {
      await updateReviewStatus(id, status);
      setReviews(reviews.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReview(id);
      setReviews(reviews.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  const columns = [
    { key: "teacherName", header: "老师" },
    { key: "author", header: "评价人" },
    { key: "text", header: "内容", render: (r: Review) => <span className="text-ink-muted line-clamp-1">{r.text}</span> },
    { key: "rating", header: "评分", render: (r: Review) => `⭐ ${r.rating}` },
    { key: "createdAt", header: "时间", render: (r: Review) => formatDateTime(r.createdAt) },
    { key: "status", header: "状态", render: (r: Review) => <Badge variant={statusToVariant(r.status)}>{statusLabels[r.status] || r.status}</Badge> },
    {
      key: "actions", header: "操作", render: (r: Review) => (
        <div className="flex gap-2">
          {r.status === "pending" && <>
            <Button size="sm" variant="success" onClick={() => handleUpdateStatus(r.id, "approved")}>通过</Button>
            <Button size="sm" variant="danger" onClick={() => handleUpdateStatus(r.id, "rejected")}>拒绝</Button>
          </>}
          <Button size="sm" onClick={() => handleDelete(r.id)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">评价管理</h2>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <Card>
        <DataTable columns={columns} data={reviews} loading={loading} emptyMessage="暂无评价数据" />
      </Card>
    </div>
  );
}
