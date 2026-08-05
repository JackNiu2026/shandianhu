"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { Card, CardHeader, Button, Input, Select, Checkbox } from "@/components/ui";
import { subjects, grades } from "@lightning-tiger/shared";

export default function NewTeacherPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    age: "",
    school: "",
    subject: "数学",
    grades: [] as string[],
    mode: "线上",
    tags: [] as string[],
    price: 100,
    years: "1年",
    note: "",
    slots: [] as string[],
    checks: ["身份证已核验", "学历已核验", "教师资格证", "无犯罪记录已核验"],
  });

  const [tagInput, setTagInput] = useState("");
  const [slotInput, setSlotInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleGrade(grade: string) {
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(grade)
        ? f.grades.filter((g) => g !== grade)
        : [...f.grades, grade],
    }));
  }

  function addTag() {
    if (tagInput && !form.tags.includes(tagInput)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tagInput] }));
      setTagInput("");
    }
  }

  function addSlot() {
    if (slotInput && !form.slots.includes(slotInput)) {
      setForm((f) => ({ ...f, slots: [...f.slots, slotInput] }));
      setSlotInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "创建失败");
      }
      router.push("/teachers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误，请稍后重试");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb />
      <h2 className="text-xl font-bold text-ink mb-4">新建老师</h2>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="年龄" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <Input label="院校" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
            <Select label="科目" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
              options={subjects.map((s) => ({ value: s, label: s }))} />
            <Input label="价格" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <Input label="教龄" value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">学段</label>
            <div className="flex gap-3">
              {grades.map((g) => (
                <Checkbox key={g} label={g} checked={form.grades.includes(g)} onChange={() => toggleGrade(g)} />
              ))}
            </div>
          </div>

          <Input label="教学模式" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} />

          <div>
            <label className="block text-sm font-medium text-ink mb-1">标签</label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="输入标签后回车" />
              <Button type="button" size="sm" onClick={addTag}>添加</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-growth-soft text-growth rounded-full">{tag}</span>
              ))}
            </div>
          </div>

          <Input label="简介" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />

          <div>
            <label className="block text-sm font-medium text-ink mb-1">可约时段</label>
            <div className="flex gap-2">
              <Input value={slotInput} onChange={(e) => setSlotInput(e.target.value)} placeholder="如：周六 14:00" />
              <Button type="button" size="sm" onClick={addSlot}>添加</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.slots.map((slot) => (
                <span key={slot} className="px-2 py-0.5 text-xs border-2 border-ink rounded">{slot}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "创建中..." : "创建"}
            </Button>
            <Button type="button" onClick={() => router.push("/teachers")}>取消</Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </Card>
    </div>
  );
}
