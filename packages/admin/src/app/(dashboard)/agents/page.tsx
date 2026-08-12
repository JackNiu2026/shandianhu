"use client";
/**
 * V2.2 智能体运营后台
 * - 左侧：Agent 列表（13 学科×学段槽位，状态、已发布版本号、主/备模型启用状态）
 * - 右侧：选中 Agent 的 Prompt 版本列表（DRAFT/TESTING/PUBLISHED），可编辑新建测试、发布、回滚
 * - 顶栏：按学科/学段筛选
 */
import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";

type Subject = "CHINESE" | "MATH" | "ENGLISH" | "PHYSICS" | "CHEMISTRY" | "BIOLOGY" | "HISTORY" | "GEOGRAPHY" | "POLITICS";
type Stage = "PRIMARY" | "JUNIOR" | "SENIOR";
interface AgentSummaryRow {
  id: string;
  subject: Subject;
  schoolStage: Stage;
  status: "ENABLED" | "DISABLED";
  publishedPromptSequence: number | null;
  hasPrimaryModel: boolean;
  hasFallbackModel: boolean;
  temperature: number;
  maxOutputTokens: number;
  primaryModelConfigId: string | null;
  fallbackModelConfigId: string | null;
  createdAt: string;
  updatedAt: string;
}
interface PromptVersionRow {
  id: string;
  agentId: string;
  sequence: number;
  status: "DRAFT" | "TESTING" | "PUBLISHED" | "ARCHIVED";
  content: string;
  testSummary: string | null;
  createdAt: string;
  publishedAt: string | null;
  createdByAdminUserId: string | null;
  publishedByAdminUserId: string | null;
}

const SUBJECT_LABEL: Record<Subject, string> = {
  CHINESE: "语文", MATH: "数学", ENGLISH: "英语", PHYSICS: "物理",
  CHEMISTRY: "化学", BIOLOGY: "生物", HISTORY: "历史",
  GEOGRAPHY: "地理", POLITICS: "道法",
};
const STAGE_LABEL: Record<Stage, string> = { PRIMARY: "小学", JUNIOR: "初中", SENIOR: "高中" };

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<"ALL" | Subject>("ALL");
  const [stageFilter, setStageFilter] = useState<"ALL" | Stage>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<PromptVersionRow[]>([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/v2/admin/agents");
        const json = await res.json();
        if (json?.ok) {
          setAgents(json.data.agents as AgentSummaryRow[]);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    return agents.filter((a) =>
      (subjectFilter === "ALL" || a.subject === subjectFilter) &&
      (stageFilter === "ALL" || a.schoolStage === stageFilter),
    );
  }, [agents, subjectFilter, stageFilter]);

  const selected = useMemo(() => agents.find((a) => a.id === selectedId) ?? null, [agents, selectedId]);

  async function onPick(agentId: string) {
    setSelectedId(agentId);
    setEditingId(null);
    setPromptLoading(true);
    try {
      const res = await fetch(`/api/v2/admin/agents/${agentId}/prompts`);
      const json = await res.json();
      if (json?.ok) setPrompts(json.data.versions as PromptVersionRow[]);
    } finally { setPromptLoading(false); }
  }

  async function onNewDraft() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/v2/admin/agents/${selected.id}/prompts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: `# ${SUBJECT_LABEL[selected.subject]} ${STAGE_LABEL[selected.schoolStage]} 辅导策略\n\n（在此填写你的系统提示词）\n` }),
      });
      const json = await res.json();
      if (json?.ok) {
        setPrompts((list) => [{ ...json.data.version, content: json.data.version?.content ?? "" }, ...list]);
      } else {
        alert("创建失败：" + (json?.error?.message || "unknown"));
      }
    } catch (e) { alert("创建失败" + e); }
  }

  function startEdit(p: PromptVersionRow) {
    setEditingId(p.id);
    setEditingContent(p.content);
  }

  async function saveEdit() {
    if (!selected || !editingId) return;
    try {
      const res = await fetch(`/api/v2/admin/agents/${selected.id}/prompts/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: editingContent }),
      });
      const json = await res.json();
      if (json?.ok) {
        setPrompts((list) => list.map((p) => p.id === editingId ? { ...p, content: editingContent, status: json.data?.version?.status ?? p.status } : p));
        setEditingId(null);
      } else alert("保存失败：" + (json?.error?.message || ""));
    } catch (e) { alert("保存失败：" + e); }
  }

  async function publishPrompt(v: PromptVersionRow) {
    if (!selected) return;
    if (!confirm(`确认把 v${v.sequence} 发布为正式版？家长端会立刻启用。`)) return;
    const res = await fetch(`/api/v2/admin/agents/${selected.id}/prompts/${v.id}/publish`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) return alert("发布失败：" + (json?.error?.message || ""));
    onPick(selected.id);
    // 刷新列表
    const listRes = await fetch("/api/v2/admin/agents");
    const listJson = await listRes.json();
    if (listJson?.ok) setAgents(listJson.data.agents as AgentSummaryRow[]);
  }

  async function rollbackPrompt(v: PromptVersionRow) {
    if (!selected) return;
    if (!confirm(`确认回滚到 v${v.sequence}？`)) return;
    const res = await fetch(`/api/v2/admin/agents/${selected.id}/prompts/${v.id}/rollback`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) return alert("回滚失败：" + (json?.error?.message || ""));
    onPick(selected.id);
  }

  async function testPrompt(v: PromptVersionRow) {
    if (!selected) return;
    const childId = prompt("输入一个 childId（只用于跑 prompt 抽取测试，不进入真实辅导流）：");
    if (!childId) return;
    const userMessage = prompt("输入测试用户消息：", "请用 3 步解一元一次方程 3x + 5 = 14。");
    if (!userMessage) return;
    try {
      const res = await fetch(`/api/v2/admin/agents/${selected.id}/prompts/${v.id}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childId, userMessage }),
      });
      const json = await res.json();
      if (json?.ok) {
        const data = json.data as { resultId: string; success: boolean; preview: string };
        alert(`测试成功（resultId=${data.resultId}）：\n${data.preview ?? ""}`);
      } else {
        alert("测试失败：" + (json?.error?.message || ""));
      }
    } catch (e) {
      alert("测试失败：" + e);
    }
  }

  return (
    <div>
      <Breadcrumb />
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-ink">智能体中心</h2>
        <div className="text-xs text-ink-muted">
          共 {agents.length} 个学科-学段槽位，已发布 {agents.filter((a) => a.publishedPromptSequence).length} 个
        </div>
      </div>

      {/* 过滤条 */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <FilterChip active={subjectFilter === "ALL"} onClick={() => setSubjectFilter("ALL")}>全部学科</FilterChip>
        {(Object.keys(SUBJECT_LABEL) as Subject[]).map((s) => (
          <FilterChip key={s} active={subjectFilter === s} onClick={() => setSubjectFilter(s)}>{SUBJECT_LABEL[s]}</FilterChip>
        ))}
        <span className="mx-2 text-ink-muted self-center">·</span>
        <FilterChip active={stageFilter === "ALL"} onClick={() => setStageFilter("ALL")}>全部学段</FilterChip>
        {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => (
          <FilterChip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>{STAGE_LABEL[s]}</FilterChip>
        ))}
      </div>

      {/* 主体：左列表 + 右详情 */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4">
        {/* Agent 列表 */}
        <div className="bg-white rounded-xl border border-ink/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink/5 flex items-center justify-between text-sm">
            <div className="font-semibold text-ink">Agent 列表</div>
            <div className="text-xs text-ink-muted">已筛选 {filtered.length}</div>
          </div>
          <ul className="divide-y divide-ink/5 max-h-[640px] overflow-auto">
            {loading ? (
              <li className="p-4 text-sm text-ink-muted">加载中…</li>
            ) : filtered.length === 0 ? (
              <li className="p-4 text-sm text-ink-muted">无匹配</li>
            ) : filtered.map((a) => (
              <li
                key={a.id}
                onClick={() => onPick(a.id)}
                className={`p-3 cursor-pointer transition ${selectedId === a.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-ink text-sm">
                      {SUBJECT_LABEL[a.subject]} · {STAGE_LABEL[a.schoolStage]}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      <Badge tone={a.status === "ENABLED" ? "ok" : "muted"}>{a.status}</Badge>
                      <span className="ml-2">发布 v{a.publishedPromptSequence ?? "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted flex gap-2">
                      <span className={a.hasPrimaryModel ? "text-emerald-600" : "text-rose-500"}>● 主模型</span>
                      <span className={a.hasFallbackModel ? "text-emerald-600" : "text-rose-500"}>● 备模型</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-ink-muted whitespace-nowrap">
                    T{a.temperature.toFixed(2)} / max{a.maxOutputTokens}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Prompt 版本 */}
        <div className="bg-white rounded-xl border border-ink/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-ink/5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">
                {selected ? `${SUBJECT_LABEL[selected.subject]} · ${STAGE_LABEL[selected.schoolStage]} Prompt 版本` : "请选择左侧 Agent"}
              </div>
              <div className="text-xs text-ink-muted mt-0.5">
                发布：{selected?.publishedPromptSequence ? `v${selected.publishedPromptSequence}` : "未发布"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={!selected}
                onClick={onNewDraft}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50"
              >+ 新建测试版</button>
            </div>
          </div>
          {!selected ? (
            <div className="p-8 text-sm text-ink-muted text-center">请选择 Agent</div>
          ) : promptLoading ? (
            <div className="p-6 text-sm text-ink-muted">加载 Prompt 中…</div>
          ) : prompts.length === 0 ? (
            <div className="p-6 text-sm text-ink-muted">暂无版本，点击右上角「新建测试版」开始</div>
          ) : (
            <ul className="divide-y divide-ink/5 max-h-[640px] overflow-auto">
              {prompts.map((v) => (
                <li key={v.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">v{v.sequence}</span>
                      <StatusBadge status={v.status} />
                      {v.publishedAt ? <span className="text-xs text-ink-muted">发布于 {v.publishedAt.slice(0, 10)}</span> : null}
                      <span className="text-xs text-ink-muted">创建 {v.createdAt.slice(0, 10)}</span>
                    </div>
                    <div className="flex gap-1">
                      {v.status === "DRAFT" || v.status === "TESTING" ? (
                        <button
                          onClick={() => startEdit(v)}
                          className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >编辑</button>
                      ) : null}
                      <button
                        onClick={() => testPrompt(v)}
                        className="px-2 py-1 text-xs rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800"
                      >测试</button>
                      {v.status !== "PUBLISHED" ? (
                        <button
                          onClick={() => publishPrompt(v)}
                          className="px-2 py-1 text-xs rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                        >发布</button>
                      ) : null}
                      {v.status !== "PUBLISHED" && selected.publishedPromptSequence != null ? (
                        <button
                          onClick={() => rollbackPrompt(v)}
                          className="px-2 py-1 text-xs rounded-md bg-sky-100 hover:bg-sky-200 text-sky-800"
                        >回滚到此</button>
                      ) : null}
                    </div>
                  </div>
                  {editingId === v.id ? (
                    <div className="mt-3">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={10}
                        className="w-full rounded-lg border border-slate-200 p-3 font-mono text-sm text-ink"
                      />
                      <div className="mt-2 flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm rounded-md bg-slate-100 text-slate-700">取消</button>
                        <button onClick={saveEdit} className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white">保存</button>
                      </div>
                    </div>
                  ) : (
                    <pre className="mt-2 text-xs bg-slate-50 text-slate-800 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-auto">
                      {v.content}
                    </pre>
                  )}
                  {v.testSummary ? (
                    <div className="mt-2 text-xs bg-amber-50 border border-amber-100 rounded-lg p-2 text-amber-900">
                      测试摘要：{v.testSummary}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-xs ${active ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"}`}
    >{children}</button>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "muted" | "bad"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-800",
    muted: "bg-slate-100 text-slate-600",
    bad: "bg-rose-100 text-rose-700",
  }[tone];
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${cls}`}>{children}</span>;
}

function StatusBadge({ status }: { status: PromptVersionRow["status"] }) {
  switch (status) {
    case "PUBLISHED": return <Badge tone="ok">PUBLISHED</Badge>;
    case "TESTING": return <Badge tone="warn">TESTING</Badge>;
    case "DRAFT": return <Badge tone="muted">DRAFT</Badge>;
    case "ARCHIVED": return <Badge tone="bad">ARCHIVED</Badge>;
    default: return null;
  }
}
