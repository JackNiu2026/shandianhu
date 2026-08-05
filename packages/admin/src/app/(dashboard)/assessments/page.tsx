"use client";

import * as React from "react";
import { questions } from "@lightning-tiger/shared";
import type { Question, Dim } from "@lightning-tiger/shared";
import { mbtiDimensionStats } from "@/lib/data";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const DIM_VARIANT: Record<Dim, "primary" | "success" | "notice" | "danger"> = {
  EI: "primary",
  SN: "success",
  TF: "notice",
  JP: "danger",
};

const DIM_LABEL: Record<Dim, string> = {
  EI: "外向 / 内省",
  SN: "务实 / 联想",
  TF: "思辨 / 共情",
  JP: "计划 / 灵活",
};

export default function AssessmentsPage() {
  const [tab, setTab] = React.useState("questions");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<Question | null>(null);

  const openEdit = (q: Question, index: number) => {
    setEditing(index);
    setDraft(JSON.parse(JSON.stringify(q)));
  };

  const saveEdit = () => {
    if (editing !== null && draft) {
      questions[editing] = draft;
    }
    setEditing(null);
    setDraft(null);
  };

  const columns: Column<Question>[] = [
    {
      key: "index",
      header: "题号",
      align: "center",
      render: (_q, i) => (
        <span className="font-mono font-semibold text-ink">Q{String(i + 1).padStart(2, "0")}</span>
      ),
    },
    {
      key: "dim",
      header: "维度",
      align: "center",
      render: (q) => <Badge variant={DIM_VARIANT[q.dim]}>{q.dim}</Badge>,
    },
    {
      key: "title",
      header: "题目",
      render: (q) => <span className="text-ink">{q.title}</span>,
    },
    {
      key: "a",
      header: "选项 A",
      render: (q) => (
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-soft text-xs font-mono text-ink/60">
            {q.options[0].letter}
          </span>
          <span className="text-ink/70">{q.options[0].text}</span>
        </div>
      ),
    },
    {
      key: "b",
      header: "选项 B",
      render: (q) => (
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-soft text-xs font-mono text-ink/60">
            {q.options[1].letter}
          </span>
          <span className="text-ink/70">{q.options[1].text}</span>
        </div>
      ),
    },
    {
      key: "action",
      header: "操作",
      align: "right",
      render: (q, i) => (
        <Button size="sm" onClick={() => openEdit(q, i)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">测评题库</h1>
          <p className="mt-1 text-sm text-ink/50">
            管理 MBTI 测评题目与维度统计
          </p>
        </div>
        <Tabs
          tabs={[
            { value: "questions", label: "题目管理", count: questions.length },
            { value: "stats", label: "结果统计" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "questions" ? (
        <DataTable
          columns={columns}
          data={questions}
          rowKey={(_q, i) => String(i)}
        />
      ) : (
        <div className="space-y-5">
          <Card title="维度分布概览" description="基于平台全部已测评家长的 MBTI 维度统计">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {mbtiDimensionStats.map((stat) => {
                const dim = stat.dim as Dim;
                const letterA = stat.dim[0]; // E / S / T / J
                const letterB = stat.dim[1]; // I / N / F / P
                const countA = (stat as Record<string, unknown>)[letterA] as number;
                const countB = (stat as Record<string, unknown>)[letterB] as number;
                const total = countA + countB;
                const aPct = total > 0 ? Math.round((countA / total) * 100) : 0;
                const bPct = 100 - aPct;
                return (
                  <div
                    key={stat.dim}
                    className="rounded-xl border border-ink/10 bg-surface-soft p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={DIM_VARIANT[dim]}>{stat.dim}</Badge>
                        <span className="text-sm font-medium text-ink">
                          {DIM_LABEL[dim]}
                        </span>
                      </div>
                      <span className="text-xs text-ink/40">
                        共 <span className="font-mono text-ink">{total}</span> 人
                      </span>
                    </div>
                    <div className="mt-3 flex h-8 w-full overflow-hidden rounded-lg border border-ink/10">
                      <div
                        className="flex items-center justify-start bg-growth px-2 text-xs font-medium text-white transition-all"
                        style={{ width: `${aPct}%` }}
                      >
                        {aPct > 12 && (
                          <span>
                            {letterA} · <span className="font-mono">{aPct}%</span>
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center justify-end bg-action px-2 text-xs font-medium text-ink transition-all"
                        style={{ width: `${bPct}%` }}
                      >
                        {bPct > 12 && (
                          <span>
                            <span className="font-mono">{bPct}%</span> · {letterB}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-ink/60">
                      <span>
                        {letterA}：<span className="font-mono text-ink">{countA}</span> 人
                      </span>
                      <span>
                        {letterB}：<span className="font-mono text-ink">{countB}</span> 人
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="维度释义" description="四个维度的两极含义">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(DIM_LABEL).map(([key, label]) => (
                <div
                  key={key}
                  className="rounded-lg border border-ink/10 bg-surface-soft p-3"
                >
                  <Badge variant={DIM_VARIANT[key as Dim]}>{key}</Badge>
                  <p className="mt-2 text-sm text-ink">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`编辑题目 Q${editing !== null ? String(editing + 1).padStart(2, "0") : ""}`}
        footer={
          <>
            <Button variant="default" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button variant="primary" onClick={saveEdit}>
              保存
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink/60">
                题目内容
              </label>
              <Input
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {draft.options.map((opt, idx) => (
                <div key={idx}>
                  <label className="mb-1 block text-xs font-medium text-ink/60">
                    选项 {String.fromCharCode(65 + idx)}（{opt.letter}）
                  </label>
                  <Input
                    value={opt.text}
                    onChange={(e) => {
                      const next = [...draft.options];
                      next[idx] = { ...opt, text: e.target.value };
                      setDraft({ ...draft, options: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
