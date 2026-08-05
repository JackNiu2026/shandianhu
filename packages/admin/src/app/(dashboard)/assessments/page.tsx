"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, CardHeader, Badge } from "@/components/ui";
import { questions } from "@lightning-tiger/shared";
import { statusToVariant } from "@/lib/utils";

const dimLabels: Record<string, string> = {
  EI: "外向/内省",
  SN: "务实/联想",
  TF: "思辨/共情",
  JP: "计划/灵活",
};

export default function AssessmentsPage() {
  const [filter, setFilter] = useState("ALL");
  // 本地 state 副本，避免直接修改 shared 导出的数组
  const [questionsList] = useState(() => [...questions]);

  const filtered = filter === "ALL" ? questionsList : questionsList.filter((q) => q.dim === filter);

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">测评题库</h2>
      <div className="flex gap-2 mb-4">
        {["ALL", "EI", "SN", "TF", "JP"].map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-3 py-1 text-sm border-2 border-ink rounded-lg ${filter === d ? "bg-growth text-white" : "bg-white"}`}
          >
            {d === "ALL" ? "全部" : dimLabels[d]}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((q, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold bg-surface-soft px-2 py-0.5 rounded">Q{i + 1}</span>
                  <Badge variant="default">{q.dim}</Badge>
                </div>
                <p className="text-sm font-medium">{q.title}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {q.options.map((opt) => (
                <div key={opt.letter} className="text-sm border-2 border-ink/20 rounded-lg p-2">
                  <span className="font-bold text-growth mr-2">{opt.letter}</span>
                  {opt.text}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
