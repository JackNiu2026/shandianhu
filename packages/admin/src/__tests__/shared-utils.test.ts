/**
 * shared/utils 单元测试
 * 覆盖 MBTI 计分、老师匹配、放宽匹配判断
 */
import { describe, it, expect } from "vitest";
import {
  calculateMBTI,
  matchTeachers,
  isRelaxedMatch,
  questions,
  teachers,
} from "@lightning-tiger/shared";
import type { Teacher, Prefs } from "@lightning-tiger/shared";

/* ============ calculateMBTI ============ */
describe("calculateMBTI", () => {
  it("答案不足 12 题时返回 null", () => {
    expect(calculateMBTI(["I", "E", "S"])).toBeNull();
  });

  it("全选每题第一个选项，得到 ISTJ", () => {
    const answers = questions.map((q) => q.options[0].letter);
    const result = calculateMBTI(answers);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ISTJ");
    expect(result!.label).toContain("内省");
    expect(result!.advice).toHaveLength(4);
  });

  it("全选每题第二个选项，得到 ENFP", () => {
    const answers = questions.map((q) => q.options[1].letter);
    const result = calculateMBTI(answers);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("ENFP");
    expect(result!.label).toContain("外向");
  });

  it("code 始终为 4 个字母", () => {
    const answers = questions.map((q) => q.options[0].letter);
    const result = calculateMBTI(answers);
    expect(result!.code).toMatch(/^[A-Z]{4}$/);
  });
});

/* ============ matchTeachers ============ */
describe("matchTeachers", () => {
  const mockTeachers: Teacher[] = [
    {
      id: "t1",
      name: "张老师",
      age: "28",
      school: "北大",
      subject: "数学",
      grades: ["初中", "高中"],
      mode: "线上",
      tags: ["耐心"],
      color: "#f2cabc",
      note: "",
      rating: "4.9",
      students: "120",
      years: "6年",
      price: 150,
      slots: [],
      video: "",
      checks: [],
      reviews: [],
    },
    {
      id: "t2",
      name: "李老师",
      age: "24",
      school: "清华",
      subject: "数学",
      grades: ["小学"],
      mode: "线下",
      tags: [],
      color: "#f2cabc",
      note: "",
      rating: "4.7",
      students: "50",
      years: "2年",
      price: 80,
      slots: [],
      video: "",
      checks: [],
      reviews: [],
    },
    {
      id: "t3",
      name: "王老师",
      age: "35",
      school: "北师大",
      subject: "语文",
      grades: ["初中"],
      mode: "线上",
      tags: [],
      color: "#f2cabc",
      note: "",
      rating: "4.8",
      students: "80",
      years: "10年",
      price: 120,
      slots: [],
      video: "",
      checks: [],
      reviews: [],
    },
  ];

  it("prefs 为 null 时返回全部老师", () => {
    expect(matchTeachers(null, mockTeachers)).toHaveLength(3);
  });

  it("严格匹配：科目 + 学段 + 预算", () => {
    const prefs: Prefs = { grade: "初中", subject: "数学", budget: 200 };
    const result = matchTeachers(prefs, mockTeachers);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("张老师");
  });

  it("无严格匹配时放宽到仅科目匹配", () => {
    const prefs: Prefs = { grade: "高中", subject: "数学", budget: 50 };
    const result = matchTeachers(prefs, mockTeachers);
    // 严格匹配无果（预算 50 太低），放宽到所有数学老师
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.subject === "数学")).toBe(true);
  });

  it("不传 teacherList 时使用内置静态数据", () => {
    const result = matchTeachers(null);
    expect(result.length).toBe(teachers.length);
  });
});

/* ============ isRelaxedMatch ============ */
describe("isRelaxedMatch", () => {
  const mockTeachers: Teacher[] = [
    {
      id: "t1", name: "A", age: "", school: "", subject: "数学",
      grades: ["初中"], mode: "", tags: [], color: "", note: "",
      rating: "", students: "", years: "", price: 300, slots: [],
      video: "", checks: [], reviews: [],
    },
  ];

  it("prefs 为 null 时返回 false", () => {
    expect(isRelaxedMatch(null, mockTeachers)).toBe(false);
  });

  it("结果中有超预算老师时返回 true（放宽匹配）", () => {
    const prefs: Prefs = { grade: "初中", subject: "数学", budget: 100 };
    expect(isRelaxedMatch(prefs, mockTeachers)).toBe(true);
  });

  it("结果全部符合预算和学段时返回 false（严格匹配）", () => {
    const prefs: Prefs = { grade: "初中", subject: "数学", budget: 500 };
    expect(isRelaxedMatch(prefs, mockTeachers)).toBe(false);
  });
});
