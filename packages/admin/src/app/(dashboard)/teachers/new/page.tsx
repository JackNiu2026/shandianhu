"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import Checkbox from "@/components/ui/checkbox";
import { createTeacher } from "@/lib/data";
import { subjects, grades } from "@lightning-tiger/shared";
import type { Grade } from "@lightning-tiger/shared";

interface TeacherFormData {
  name: string;
  age: string;
  school: string;
  subject: string;
  grades: Grade[];
  mode: string;
  price: number;
  years: string;
  tags: string;
  note: string;
  color: string;
  checks: string[];
}

const checkOptions = [
  "身份证已核验",
  "学历已核验",
  "教师资格证已核验",
  "无犯罪记录已核验",
];

export default function NewTeacherPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeacherFormData>({
    defaultValues: {
      name: "",
      age: "",
      school: "",
      subject: subjects[0],
      grades: [],
      mode: "线上",
      price: 100,
      years: "",
      tags: "",
      note: "",
      color: "#f2cabc",
      checks: [],
    },
  });

  const selectedGrades = watch("grades");
  const selectedChecks = watch("checks");
  const selectedColor = watch("color");

  const toggleGrade = (grade: Grade) => {
    const current = watch("grades");
    const next = current.includes(grade)
      ? current.filter((g) => g !== grade)
      : [...current, grade];
    setValue("grades", next);
  };

  const toggleCheck = (check: string) => {
    const current = watch("checks");
    const next = current.includes(check)
      ? current.filter((c) => c !== check)
      : [...current, check];
    setValue("checks", next);
  };

  const onSubmit = async (data: TeacherFormData) => {
    setSubmitting(true);
    try {
      await createTeacher({
        name: data.name,
        age: data.age,
        school: data.school,
        subject: data.subject,
        grades: data.grades,
        mode: data.mode,
        price: Number(data.price),
        years: data.years,
        tags: data.tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        note: data.note,
        color: data.color,
        checks: data.checks,
      });
      router.push("/teachers");
    } catch (e) {
      console.error("创建老师失败:", e);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">新建老师</h1>
        <p className="text-sm text-ink-muted mt-1">填写老师信息以创建新账号</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本信息 */}
        <Card title="基本信息">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="姓名"
              placeholder="请输入老师姓名"
              error={errors.name?.message}
              {...register("name", { required: "请输入姓名" })}
            />
            <Input
              label="年龄"
              placeholder="如：28 岁"
              {...register("age")}
            />
            <Input
              label="院校"
              placeholder="如：复旦大学 · 数学与应用数学"
              className="col-span-2"
              {...register("school")}
            />
            <Select
              label="科目"
              options={subjects.map((s) => ({ value: s, label: s }))}
              {...register("subject")}
            />
            <Input
              label="教学模式"
              placeholder="如：线上 / 上门"
              {...register("mode")}
            />
            <Input
              label="课时价格（元）"
              type="number"
              {...register("price", { valueAsNumber: true })}
            />
            <Input
              label="教龄"
              placeholder="如：6 年"
              {...register("years")}
            />
          </div>
        </Card>

        {/* 学段多选 */}
        <Card title="教学学段">
          <div className="flex items-center gap-6">
            {grades.map((grade) => (
              <Checkbox
                key={grade}
                label={grade}
                checked={selectedGrades.includes(grade)}
                onChange={() => toggleGrade(grade)}
              />
            ))}
          </div>
        </Card>

        {/* 标签与理念 */}
        <Card title="标签与教学理念">
          <div className="space-y-4">
            <Input
              label="标签"
              placeholder="多个标签用逗号分隔，如：985, 中考数学, 竞赛启蒙"
              {...register("tags")}
            />
            <div>
              <label className="block mb-1.5 text-sm font-semibold text-ink">
                教学理念
              </label>
              <textarea
                rows={3}
                placeholder="请输入教学理念..."
                className="w-full rounded-lg border-2 border-ink bg-surface-paper px-4 py-2 shadow-nb-sm outline-none transition-all focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none resize-none"
                {...register("note")}
              />
            </div>
          </div>
        </Card>

        {/* 卡片颜色与核验项 */}
        <Card title="展示与核验">
          <div className="space-y-4">
            <div>
              <label className="block mb-1.5 text-sm font-semibold text-ink">
                卡片颜色
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="w-12 h-10 rounded-lg border-2 border-ink cursor-pointer bg-surface-paper shrink-0"
                  value={selectedColor}
                  onChange={(e) => setValue("color", e.target.value)}
                />
                <Input
                  className="flex-1"
                  placeholder="#f2cabc"
                  {...register("color")}
                />
                <div
                  className="w-10 h-10 rounded-lg border-2 border-ink shadow-nb-sm shrink-0"
                  style={{ backgroundColor: selectedColor }}
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold text-ink">
                核验项
              </label>
              <div className="grid grid-cols-2 gap-3">
                {checkOptions.map((check) => (
                  <Checkbox
                    key={check}
                    label={check}
                    checked={selectedChecks.includes(check)}
                    onChange={() => toggleCheck(check)}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* 底部操作按钮 */}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="lg" disabled={submitting}>
            {submitting ? "提交中..." : "提交创建"}
          </Button>
          <Button asChild href="/teachers" variant="default" size="lg">
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}
