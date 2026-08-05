import type { Grade, Dim, Question } from "../types";

export const subjects = ["语文", "数学", "英语", "物理", "化学"] as const;

export const grades: Grade[] = ["小学", "初中", "高中"];

export const budgetOptions = [
  { label: "¥50–100", value: 100 },
  { label: "¥101–200", value: 200 },
  { label: "¥200 以上", value: 999 },
];

export const questions: Question[] = [
  { title: "周末的下午，孩子更愿意…", dim: "EI", options: [{ text: "和熟悉的朋友待在一起", letter: "I" }, { text: "认识新朋友、参加活动", letter: "E" }] },
  { title: "上完一天课回家，孩子通常…", dim: "EI", options: [{ text: "想先自己安静一会儿", letter: "I" }, { text: "会兴奋地讲一路上的事", letter: "E" }] },
  { title: "在班里，孩子更像…", dim: "EI", options: [{ text: "观察者，熟了才放开", letter: "I" }, { text: "发起者，很快融入", letter: "E" }] },
  { title: "面对一道陌生的难题，孩子通常会…", dim: "SN", options: [{ text: "先照着例题一步步套", letter: "S" }, { text: "先猜一个方向再验证", letter: "N" }] },
  { title: "孩子更容易记住的是…", dim: "SN", options: [{ text: "具体的步骤和口诀", letter: "S" }, { text: "背后的道理和联系", letter: "N" }] },
  { title: "读完一篇课文，孩子更爱聊…", dim: "SN", options: [{ text: "文章讲了哪些事", letter: "S" }, { text: "如果换个结局会怎样", letter: "N" }] },
  { title: "做错题被指出来，孩子会…", dim: "TF", options: [{ text: "想知道错在哪，情绪还好", letter: "T" }, { text: "先在意别人怎么看他", letter: "F" }] },
  { title: "更能推动孩子往前走的是…", dim: "TF", options: [{ text: "看到排名和进步数据", letter: "T" }, { text: "被认可、被鼓励", letter: "F" }] },
  { title: "和同学有分歧时，孩子倾向…", dim: "TF", options: [{ text: "讲道理，谁对听谁的", letter: "T" }, { text: "先顾及关系，不想吵", letter: "F" }] },
  { title: "当计划临时改变，孩子会…", dim: "JP", options: [{ text: "希望提前知道安排", letter: "J" }, { text: "觉得新鲜，随机应变", letter: "P" }] },
  { title: "写作业的习惯更接近…", dim: "JP", options: [{ text: "先列清单，按顺序做完", letter: "J" }, { text: "想到哪写到哪，最后冲刺", letter: "P" }] },
  { title: "孩子的书包和书桌通常…", dim: "JP", options: [{ text: "有自己的固定摆法", letter: "J" }, { text: "有点乱但他找得到", letter: "P" }] },
];

export const typeNames: Record<string, string> = {
  I: "内省", E: "外向", S: "务实", N: "联想", T: "思辨", F: "共情", J: "计划", P: "灵活",
};

export const styleAdvice: Record<Dim, Record<string, string>> = {
  EI: { I: "需要留白和等待，被追问时会关闭", E: "在互动和讲给别人听时学得最快" },
  SN: { S: "适合先给清晰步骤，再讲原理", N: "适合先讲整体逻辑，再落到步骤" },
  TF: { T: "对数据和排名敏感，讲道理有效", F: "需要先被肯定，再谈改进" },
  JP: { J: "固定时间、固定节奏最让他安心", P: "需要弹性安排和阶段性目标" },
};
