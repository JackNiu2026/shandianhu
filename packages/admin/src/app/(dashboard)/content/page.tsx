"use client";

import * as React from "react";
import { contentConfig } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty_state";

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function ContentPage() {
  const [subjects, setSubjects] = React.useState<string[]>([
    ...contentConfig.subjects,
  ]);
  const [grades, setGrades] = React.useState<string[]>([
    ...contentConfig.grades,
  ]);
  const [budgets, setBudgets] = React.useState<
    { label: string; value: number }[]
  >([...contentConfig.budgetOptions]);

  const [newSubject, setNewSubject] = React.useState("");
  const [newGrade, setNewGrade] = React.useState("");
  const [newBudgetLabel, setNewBudgetLabel] = React.useState("");
  const [newBudgetValue, setNewBudgetValue] = React.useState("");

  const [teacherCount, setTeacherCount] = React.useState(
    contentConfig.platformStats.teacherCount,
  );
  const [parentCount, setParentCount] = React.useState(
    contentConfig.platformStats.parentCount,
  );

  const addSubject = () => {
    const v = newSubject.trim();
    if (!v || subjects.includes(v)) return;
    setSubjects((prev) => [...prev, v]);
    setNewSubject("");
  };

  const addGrade = () => {
    const v = newGrade.trim();
    if (!v || grades.includes(v)) return;
    setGrades((prev) => [...prev, v]);
    setNewGrade("");
  };

  const addBudget = () => {
    const label = newBudgetLabel.trim();
    const value = Number(newBudgetValue);
    if (!label || !value || budgets.some((b) => b.value === value)) return;
    setBudgets((prev) => [...prev, { label, value }]);
    setNewBudgetLabel("");
    setNewBudgetValue("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">内容配置</h1>
        <p className="mt-1 text-sm text-ink/50">
          管理平台基础配置项：科目、学段、预算档位与统计数据
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 科目管理 */}
        <Card title="科目管理" description={`共 ${subjects.length} 个科目`}>
          <div className="space-y-2">
            {subjects.length === 0 ? (
              <EmptyState title="暂无科目" />
            ) : (
              subjects.map((s) => (
                <div
                  key={s}
                  className="flex items-center justify-between rounded-lg border border-ink/10 bg-surface-soft px-3 py-2"
                >
                  <Badge variant="primary">{s}</Badge>
                  <button
                    onClick={() =>
                      setSubjects((prev) => prev.filter((x) => x !== s))
                    }
                    className="flex h-6 w-6 items-center justify-center rounded text-ink/40 transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`删除 ${s}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-ink/10 pt-4">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubject()}
              placeholder="新科目名称"
            />
            <Button variant="primary" size="md" onClick={addSubject}>
              <PlusIcon />
              添加
            </Button>
          </div>
        </Card>

        {/* 学段管理 */}
        <Card title="学段管理" description={`共 ${grades.length} 个学段`}>
          <div className="space-y-2">
            {grades.length === 0 ? (
              <EmptyState title="暂无学段" />
            ) : (
              grades.map((g) => (
                <div
                  key={g}
                  className="flex items-center justify-between rounded-lg border border-ink/10 bg-surface-soft px-3 py-2"
                >
                  <Badge variant="success">{g}</Badge>
                  <button
                    onClick={() =>
                      setGrades((prev) => prev.filter((x) => x !== g))
                    }
                    className="flex h-6 w-6 items-center justify-center rounded text-ink/40 transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`删除 ${g}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-ink/10 pt-4">
            <Input
              value={newGrade}
              onChange={(e) => setNewGrade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGrade()}
              placeholder="新学段名称"
            />
            <Button variant="primary" size="md" onClick={addGrade}>
              <PlusIcon />
              添加
            </Button>
          </div>
        </Card>

        {/* 预算档位 */}
        <Card title="预算档位" description={`共 ${budgets.length} 个档位`}>
          <div className="space-y-2">
            {budgets.length === 0 ? (
              <EmptyState title="暂无预算档位" />
            ) : (
              budgets.map((b) => (
                <div
                  key={b.value}
                  className="flex items-center justify-between rounded-lg border border-ink/10 bg-surface-soft px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {b.label}
                    </span>
                    <span className="font-mono text-xs text-ink/40">
                      ¥{b.value}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setBudgets((prev) =>
                        prev.filter((x) => x.value !== b.value),
                      )
                    }
                    className="flex h-6 w-6 items-center justify-center rounded text-ink/40 transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`删除 ${b.label}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 space-y-2 border-t border-ink/10 pt-4">
            <Input
              value={newBudgetLabel}
              onChange={(e) => setNewBudgetLabel(e.target.value)}
              placeholder="档位标签（如 ¥50–100）"
            />
            <div className="flex items-center gap-2">
              <Input
                value={newBudgetValue}
                onChange={(e) => setNewBudgetValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBudget()}
                placeholder="金额上限"
                type="number"
              />
              <Button variant="primary" size="md" onClick={addBudget}>
                <PlusIcon />
                添加
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 平台统计 */}
      <Card
        title="平台统计"
        description="用于首页与营销页面的展示数据，可手动校正"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              老师入驻数
            </label>
            <Input
              value={teacherCount}
              onChange={(e) =>
                setTeacherCount(Number(e.target.value) || 0)
              }
              type="number"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/60">
              家长注册数
            </label>
            <Input
              value={parentCount}
              onChange={(e) => setParentCount(Number(e.target.value) || 0)}
              type="number"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-soft px-4 py-3">
          <p className="text-xs text-ink/50">
            预览：已有{" "}
            <span className="font-mono font-semibold text-growth">
              {teacherCount.toLocaleString("zh-CN")}
            </span>{" "}
            位老师入驻 ·{" "}
            <span className="font-mono font-semibold text-growth">
              {parentCount.toLocaleString("zh-CN")}
            </span>{" "}
            位家长注册
          </p>
          <Button variant="primary" size="sm">
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
}
