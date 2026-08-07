import { useEffect, useMemo, useState, type ReactNode } from "react";
import linAvatar from "@/imports/9d40deabc09b6c02a7bdca9aa40e0d4b.jpeg";
import zhouAvatar from "@/imports/302f2b7dfe2f74ee701b4e4be5f1b069.jpg";
import tigerLogoMark from "@/imports/_____5.png";
import tigerLogoType from "@/imports/_____11.png";

type Tab = "match" | "test" | "chat" | "me";
type Role = "parent" | "teacher" | null;
type Grade = "小学" | "初中" | "高中";
type Prefs = { grade: Grade; subject: string; budget: number };

type Teacher = {
  name: string;
  age: string;
  school: string;
  subject: string;
  grades: Grade[];
  mode: string;
  tags: string[];
  color: string;
  avatar?: string;
  note: string;
  rating: string;
  students: string;
  years: string;
  price: number;
  slots: string[];
  video: string;
  checks: string[];
  reviews: { by: string; text: string }[];
};

const teachers: Teacher[] = [
  {
    name: "林知夏", age: "27 岁", school: "复旦大学 · 数学与应用数学", subject: "数学", grades: ["初中"], mode: "线上 / 上门",
    tags: ["985", "211", "中考数学", "竞赛启蒙"], color: "#f2cabc", avatar: linAvatar, note: "先理解孩子，再找到适合他的节奏。",
    rating: "4.9", students: "32", years: "6 年", price: 220, slots: ["周六 14:00", "周六 19:00", "周日 10:00"],
    video: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "复旦学历已核验", "高中数学教师资格证", "无犯罪记录已核验"],
    reviews: [
      { by: "初二家长 · 王女士", text: "孩子以前一看应用题就跳过，现在会主动把思路讲给我听。" },
      { by: "初三家长 · 李先生", text: "每次课后都有一条很具体的反馈，不是那种复制粘贴的模板。" },
    ],
  },
  {
    name: "周予安", age: "29 岁", school: "上海外国语大学 · 英语教育", subject: "英语", grades: ["初中", "高中"], mode: "线上",
    tags: ["外教教研", "雅思 8.0", "英语提分", "口语表达"], color: "#bcd4c7", avatar: zhouAvatar, note: "让英语从一门功课，变成打开世界的工具。",
    rating: "4.8", students: "41", years: "7 年", price: 260, slots: ["周五 19:30", "周日 15:00"],
    video: "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "上外学历已核验", "高中英语教师资格证", "无犯罪记录已核验"],
    reviews: [
      { by: "高一家长 · 陈女士", text: "上了两个月，孩子敢在课堂上开口了，这个比分数更让我意外。" },
      { by: "初三家长 · 张女士", text: "作文批改很细，会标出哪句是中式表达。" },
    ],
  },
  {
    name: "陈默", age: "55 岁", school: "同济大学 · 物理学", subject: "物理", grades: ["高中"], mode: "上门",
    tags: ["退休教师", "高级教师", "高中物理", "备考规划"], color: "#c9c7e8", note: "把复杂的题目，拆成每一步都能懂的答案。",
    rating: "4.9", students: "28", years: "31 年", price: 320, slots: ["周六 09:00", "周六 16:00"],
    video: "https://images.unsplash.com/photo-1588072432836-7fb78a2f1c8b?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "同济学历已核验", "高级教师职称已核验", "无犯罪记录已核验"],
    reviews: [
      { by: "高三家长 · 刘先生", text: "陈老师会先问孩子哪一步卡住，而不是直接讲答案。" },
      { by: "高二家长 · 赵女士", text: "老教师的经验很明显，考点抓得准。" },
    ],
  },
  {
    name: "苏晚", age: "31 岁", school: "华东师范大学 · 数学教育", subject: "数学", grades: ["小学", "初中"], mode: "线上 / 上门",
    tags: ["985", "公立在职", "小升初", "计算提速"], color: "#e6cfa6", note: "小学阶段最该建立的，是「我能算对」的底气。",
    rating: "4.9", students: "56", years: "9 年", price: 180, slots: ["周三 18:30", "周六 10:00", "周日 14:00"],
    video: "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "华师大学历已核验", "小学数学教师资格证", "无犯罪记录已核验"],
    reviews: [
      { by: "五年级家长 · 周女士", text: "口算速度上来了，考试终于不因为时间不够丢分。" },
      { by: "初一家长 · 吴先生", text: "衔接课安排得很稳，孩子没有那种断层的慌张。" },
    ],
  },
  {
    name: "郑亦白", age: "26 岁", school: "北京大学 · 中国语言文学", subject: "语文", grades: ["初中", "高中"], mode: "线上",
    tags: ["985", "211", "阅读理解", "作文结构"], color: "#d9c4d6", note: "写作不是天赋，是可以被教会的结构。",
    rating: "4.7", students: "24", years: "4 年", price: 200, slots: ["周四 19:00", "周日 09:30"],
    video: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "北大学历已核验", "初中语文教师资格证", "无犯罪记录已核验"],
    reviews: [
      { by: "初二家长 · 孙女士", text: "作文从四十分出头提到五十分，思路清楚了很多。" },
      { by: "高一家长 · 何先生", text: "会带着孩子拆题干，这个方法能用到别的科目。" },
    ],
  },
  {
    name: "何书行", age: "34 岁", school: "南京大学 · 化学", subject: "化学", grades: ["初中", "高中"], mode: "线上 / 上门",
    tags: ["985", "实验讲解", "中考化学", "错题复盘"], color: "#b9d0dd", note: "化学要先看见反应，再去背反应。",
    rating: "4.8", students: "37", years: "11 年", price: 240, slots: ["周六 13:00", "周日 18:00"],
    video: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "南大学历已核验", "高中化学教师资格证", "无犯罪记录已核验"],
    reviews: [
      { by: "初三家长 · 马女士", text: "会用实验视频讲原理，孩子说这样才记得住。" },
      { by: "高二家长 · 邓先生", text: "错题本是老师帮着一起整理的，很省心。" },
    ],
  },
  {
    name: "许知微", age: "28 岁", school: "浙江大学 · 应用物理", subject: "物理", grades: ["初中"], mode: "线上",
    tags: ["985", "211", "初中物理", "可视化讲解"], color: "#cfd8b8", note: "先让孩子看见力，再让他计算力。",
    rating: "4.8", students: "30", years: "5 年", price: 210, slots: ["周二 19:00", "周六 11:00", "周日 16:30"],
    video: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "浙大学历已核验", "初中物理教师资格证", "无犯罪记录已核验"],
    reviews: [
      { by: "初二家长 · 秦女士", text: "动画演示很直观，孩子第一次说物理有意思。" },
      { by: "初三家长 · 冯先生", text: "讲题耐心，问三遍也不会不高兴。" },
    ],
  },
  {
    name: "叶承川", age: "45 岁", school: "华中师范大学 · 英语", subject: "英语", grades: ["小学", "初中"], mode: "上门",
    tags: ["公立在职", "高级教师", "小学英语", "基础打底"], color: "#eec9b3", note: "基础没打牢的孩子，最需要的是不被催。",
    rating: "4.9", students: "62", years: "20 年", price: 190, slots: ["周六 15:30", "周日 11:00"],
    video: "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=900&h=560&fit=crop&auto=format",
    checks: ["身份证已核验", "华中师大学历已核验", "高级教师职称已核验", "无犯罪记录已核验"],
    reviews: [
      { by: "四年级家长 · 卢女士", text: "从不催孩子，单词是靠句子记住的，不是罚抄。" },
      { by: "初一家长 · 郭先生", text: "上门很守时，二十年经验不是白说的。" },
    ],
  },
];

const subjects = ["语文", "数学", "英语", "物理", "化学"];
const grades: Grade[] = ["小学", "初中", "高中"];
const budgetOptions = [
  { label: "¥50–100", value: 100 },
  { label: "¥101–200", value: 200 },
  { label: "¥200 以上", value: 999 },
];

type Dim = "EI" | "SN" | "TF" | "JP";
const questions: { title: string; dim: Dim; options: { text: string; letter: string }[] }[] = [
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

const typeNames: Record<string, string> = {
  I: "内省", E: "外向", S: "务实", N: "联想", T: "思辨", F: "共情", J: "计划", P: "灵活",
};

const styleAdvice: Record<Dim, Record<string, string>> = {
  EI: { I: "需要留白和等待，被追问时会关闭", E: "在互动和讲给别人听时学得最快" },
  SN: { S: "适合先给清晰步骤，再讲原理", N: "适合先讲整体逻辑，再落到步骤" },
  TF: { T: "对数据和排名敏感，讲道理有效", F: "需要先被肯定，再谈改进" },
  JP: { J: "固定时间、固定节奏最让他安心", P: "需要弹性安排和阶段性目标" },
};

function Icon({ children }: { children: ReactNode }) {
  return <span className="icon">{children}</span>;
}

function ActionIcon({ name }: { name: "pass" | "like" | "undo" | "arrow" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === "pass" && <><path {...p} d="m6 6 12 12M18 6 6 18" /></>}
    {name === "like" && <path {...p} d="M20.8 4.8a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z" />}
    {name === "undo" && <><path {...p} d="M9 7 5 11l4 4" /><path {...p} d="M5 11h8a6 6 0 1 1-5.2 9" /></>}
    {name === "arrow" && <path {...p} d="m9 18 6-6-6-6" />}
  </svg>;
}

function WorkIcon({ name }: { name: "users" | "heart" | "chart" | "folder" | "calendar" | "edit" | "star" | "shield" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className="work-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
    {name === "users" && <><path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle {...p} cx="9" cy="7" r="4" /><path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>}
    {name === "heart" && <path {...p} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />}
    {name === "chart" && <><line {...p} x1="18" y1="20" x2="18" y2="10" /><line {...p} x1="12" y1="20" x2="12" y2="4" /><line {...p} x1="6" y1="20" x2="6" y2="14" /></>}
    {name === "folder" && <path {...p} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />}
    {name === "calendar" && <><rect {...p} x="3" y="4" width="18" height="18" rx="2" /><line {...p} x1="16" y1="2" x2="16" y2="6" /><line {...p} x1="8" y1="2" x2="8" y2="6" /><line {...p} x1="3" y1="10" x2="21" y2="10" /></>}
    {name === "edit" && <><path {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path {...p} d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>}
    {name === "star" && <polygon {...p} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />}
    {name === "shield" && <path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
  </svg>;
}

function GearIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>;
}

function NavIcon({ name }: { name: "discover" | "assessment" | "chat" | "profile" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg className="nav-symbol" viewBox="0 0 24 24" aria-hidden="true">
    {name === "discover" && <><path {...common} d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path {...common} d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z" /></>}
    {name === "assessment" && <><path {...common} d="M5 19V9m7 10V5m7 14v-6" /><path {...common} d="M3.5 19.5h17" /></>}
    {name === "chat" && <><path {...common} d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.1-.6L4 20l1.5-4.1A7.1 7.1 0 0 1 4 11.5a7.5 7.5 0 0 1 16 0Z" /><path {...common} d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></>}
    {name === "profile" && <><circle {...common} cx="12" cy="8" r="3.4" /><path {...common} d="M5.5 20c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2" /></>}
  </svg>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("match");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [needsOpen, setNeedsOpen] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<"left" | "right" | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [hasShownSwipeHint, setHasShownSwipeHint] = useState(false);
  const [liked, setLiked] = useState<Teacher[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<{ teacher: Teacher; direction: "left" | "right" }[]>([]);
  const [openConnected, setOpenConnected] = useState(false);
  const [openLiked, setOpenLiked] = useState(false);
  const [trustFor, setTrustFor] = useState<Teacher | null>(null);
  const [bookFor, setBookFor] = useState<Teacher | null>(null);
  const [booked, setBooked] = useState<{ teacher: string; slot: string } | null>(null);
  const [playing, setPlaying] = useState<Teacher | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [utilityModal, setUtilityModal] = useState<string | null>(null);
  const [parentName, setParentName] = useState("陈晓彤");
  const [parentAvatar, setParentAvatar] = useState("陈");
  const [teacherName, setTeacherName] = useState("林知夏");
  const [teacherAvatar, setTeacherAvatar] = useState("林");
  const [inChat, setInChat] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { mine: false, text: "周六下午可以先安排一次免费试听，了解一下孩子目前的学习情况。", time: "10:16" },
    { mine: true, text: "好的老师！他最近数学应用题有点没信心。", time: "10:18" },
  ]);

  const matched = useMemo(() => {
    if (!prefs) return teachers;
    const strict = teachers.filter(
      (t) => t.subject === prefs.subject && t.grades.includes(prefs.grade) && t.price <= prefs.budget,
    );
    return strict.length ? strict : teachers.filter((t) => t.subject === prefs.subject);
  }, [prefs]);

  const relaxed = Boolean(prefs) && matched.some((t) => t.price > (prefs?.budget ?? 0) || !t.grades.includes(prefs!.grade));
  const teacher = matched[cursor];
  const answered = answers.length;

  const result = useMemo(() => {
    if (answered < questions.length) return null;
    const pick = (dim: Dim, a: string, b: string) => {
      const votes = questions.map((q, i) => (q.dim === dim ? answers[i] : null)).filter(Boolean);
      return votes.filter((v) => v === a).length >= 2 ? a : b;
    };
    const letters = [pick("EI", "I", "E"), pick("SN", "N", "S"), pick("TF", "F", "T"), pick("JP", "J", "P")];
    return {
      code: letters.join(""),
      label: letters.map((l) => typeNames[l]).join(" · "),
      advice: (["EI", "SN", "TF", "JP"] as Dim[]).map((dim, i) => styleAdvice[dim][letters[i]]),
    };
  }, [answers, answered]);

  useEffect(() => { setCursor(0); }, [prefs]);

  useEffect(() => {
    if (tab !== "match" || needsOpen || hasShownSwipeHint || !teacher) return;
    const start = window.setTimeout(() => setShowSwipeHint(true), 280);
    const end = window.setTimeout(() => {
      setShowSwipeHint(false);
      setHasShownSwipeHint(true);
    }, 2100);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [hasShownSwipeHint, needsOpen, tab, teacher]);

  const moveCard = (direction: "left" | "right") => {
    if (!teacher) return;
    if (direction === "right") {
      setLiked((saved) => (saved.some((item) => item.name === teacher.name) ? saved : [...saved, teacher]));
    }
    setSwipeHistory((history) => [...history, { teacher, direction }]);
    setSwipeDirection(direction);
    window.setTimeout(() => {
      setCursor((i) => i + 1);
      setSwipeDirection(null);
      setSwipeFeedback(direction);
      window.setTimeout(() => setSwipeFeedback(null), 720);
    }, 260);
  };

  const undoSwipe = () => {
    const last = swipeHistory[swipeHistory.length - 1];
    if (!last || cursor === 0) return;
    if (last.direction === "right") setLiked((saved) => saved.filter((item) => item.name !== last.teacher.name));
    setSwipeHistory((history) => history.slice(0, -1));
    setCursor((index) => Math.max(0, index - 1));
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages((old) => [...old, { mine: true, text: message.trim(), time: "刚刚" }]);
    setMessage("");
  };

  const enterMe = () => {
    setTab("me");
    if (!role) setRoleOpen(true);
  };

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="topbar">
          <div className="wordmark" aria-label="闪电虎"><span className="brand-mark"><img src={tigerLogoMark} alt="" /></span><span className="brand-type"><img src={tigerLogoType} alt="闪电虎" /></span></div>
        </header>

        <div className="screen-content">
          {tab === "match" && (
            <section className="match-screen">
              <div className="intro-row platform-stat">
                <h1>已有 <strong>856</strong> 位优秀老师入驻平台</h1>
                <button className="filter-btn platform-filter" onClick={() => setNeedsOpen(true)}>筛选</button>
              </div>
              {relaxed && <p className="relax-note">符合预算的老师已看完，以下为放宽预算后的推荐</p>}

              {teacher ? (
                <>
                  <article className={`teacher-card hero-card ${swipeDirection ? `swipe-${swipeDirection}` : ""} ${showSwipeHint ? "swipe-hint" : ""}`}>
                    {showSwipeHint && <div className="swipe-overlay" aria-hidden="true"><span className="swipe-arrow left">‹</span><span className="swipe-guide">左右滑动<br />发现更多老师</span><span className="swipe-arrow right">›</span></div>}
                    <div className="teacher-identity" style={{ backgroundColor: teacher.color }}>
                      <div className="identity-top"><b>{teacher.subject} · {teacher.grades.join("/")}</b></div>
                      <div className="identity-main">
                        <div className="teacher-avatar">{teacher.avatar ? <img src={teacher.avatar} alt={`${teacher.name}老师`} /> : teacher.name[0]}</div>
                        <div>
                          <div className="name-line"><h2>{teacher.name}</h2><span>{teacher.age}</span><div className="verified">✓</div></div>
                          <p className="school">{teacher.school}</p>
                        </div>
                      </div>
                      <div className="tags credential-tags">
                        {teacher.tags.map((tag, index) => <span className={index < 2 ? "credential" : ""} key={tag}>{tag}</span>)}
                      </div>
                    </div>
                    <div className="card-body compact-body">
                      <div className="teacher-meta"><span>★ {teacher.rating} 评分</span><i /><span>已陪伴 {teacher.students} 位学生</span></div>
                      <p className="teacher-note">“{teacher.note}”</p>
                      <div className="decision-grid">
                        <span><b>{teacher.years}</b>教龄</span>
                        <span><b>¥{teacher.price}</b>起 / 60 分钟</span>
                        <span><b>{teacher.slots[0]}</b>最近可约</span>
                      </div>
                      <button className="trust-line" onClick={() => setTrustFor(teacher)}>
                        <span>✓ 4 项资质已核验</span><span>✓ {teacher.reviews.length} 条家长原话</span><span>查看保障详情 ›</span>
                      </button>
                      <div className="portrait video-cover lesson-video">
                        <img src={teacher.video} alt={`${teacher.name}老师讲课视频封面`} />
                        <div className="video-shade" />
                        <button className="play-video" onClick={() => setPlaying(teacher)} aria-label="播放讲课视频"><span>▶</span></button>
                        <div className="video-label"><b>试听片段 · 02:18</b><span>一分钟看懂 TA 的课堂</span></div>
                      </div>
                      <div className="contact-row">
                        <div className="contact-status"><span className="contact-icon" aria-hidden="true">☎</span><span><small>联系方式</small><b>完成试听后即可聊天</b></span></div>
                        <button onClick={() => setBookFor(teacher)}>预约免费试听 <span>›</span></button>
                      </div>
                    </div>
                  </article>
                  <div className="swipe-actions">
                    <button className={`pass ${swipeFeedback === "left" ? "decision-feedback" : ""}`} onClick={() => moveCard("left")} aria-label="不合适"><ActionIcon name="pass" /></button>
                    <button className="undo" onClick={undoSwipe} disabled={!swipeHistory.length} aria-label="撤回上一次滑卡"><ActionIcon name="undo" /></button>
                    <button className={`like ${swipeFeedback === "right" ? "decision-feedback" : ""}`} onClick={() => moveCard("right")} aria-label="收藏老师"><ActionIcon name="like" /></button>
                  </div>
                </>
              ) : (
                <div className="deck-end">
                  <span>✦</span>
                  <b>这一轮推荐看完了</b>
                  <p>已收藏 {liked.length} 位老师，可以在「我的」里对比。也可以放宽条件看看更多。</p>
                  <div className="deck-end-actions">
                    <button onClick={() => setCursor(0)}>重新浏览</button>
                    <button className="primary" onClick={() => setNeedsOpen(true)}>调整筛选条件</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "test" && (
            <section className="test-screen">
              {!assessmentStarted ? (
                <div className="assessment-welcome">
                  <div className="assessment-welcome-top"><span className="welcome-kicker">MBTI学习风格测评</span></div>
                  <h1>用一次认真回答，<em>认识孩子的学习偏好</em></h1>
                  <p>帮助我们了解孩子在理解信息、获得反馈和安排节奏时更舒服的方式，从而推荐教学风格更合拍的老师。</p>
                  <div className="welcome-benefits"><span><b>约 3 分钟</b><small>无需跳转</small></span><span><b>仅作匹配参考</b><small>不评价能力</small></span><span><b>结果可重测</b><small>随成长更新</small></span></div>
                  <div className="welcome-notice"><i>✓</i><span>测评结果会在当前 App 内生成；正式授权题库与计分规则接入后，将按授权版本输出报告。</span></div>
                  <button className="start-assessment" onClick={() => setAssessmentStarted(true)}>开始为孩子测评 <span>→</span></button>
                  <small className="welcome-foot">请根据孩子最近 1–2 个月的真实状态作答</small>
                </div>
              ) : !result ? (
                <>
                  <div className="mbti-constellation" aria-label="学习风格测评说明">
                    <div className="mbti-purpose-chip"><span>⌁</span> 给家长的测评说明</div>
                    <div className="mbti-core"><small>第</small><b>{answered + 1}<i>/12</i></b><span>题</span></div>
                    <div className="test-copy">
                      <p className="tiny-label">LEARNING STYLE CHECK</p>
                      <h1>了解孩子如何学习，<em>匹配更合拍的老师</em></h1>
                      <p>结果只用于推荐教学风格，不是能力评价或心理诊断。</p>
                    </div>
                    <div className="purpose-quick-points"><span>理解方式</span><span>反馈偏好</span><span>学习节奏</span><b>12 题 · 约 3 分钟</b></div>
                  </div>
                  <div className="question-card magnetic-question">
                    <div className="question-head">
                      <p className="question-no">QUESTION {String(answered + 1).padStart(2, "0")} / 12</p>
                      <div className="stepper">{questions.map((_, i) => <span className={i <= answered ? "active" : ""} key={i} />)}</div>
                    </div>
                    <h2>{questions[answered].title}</h2>
                    <p className="choose-hint"><strong>请代入孩子最近的真实状态</strong>，选择最接近的一项</p>
                    <div className="option-list">
                      {questions[answered].options.map((option, i) => (
                        <button key={option.text} onClick={() => setAnswers((old) => [...old, option.letter])}>
                          <b>{i === 0 ? "A" : "B"}</b><span>{option.text}</span><i>↗</i>
                        </button>
                      ))}
                    </div>
                    {answered > 0 && <button className="back-question" onClick={() => setAnswers((old) => old.slice(0, -1))}><span aria-hidden="true">←</span>返回上一题</button>}
                  </div>
                </>
              ) : (
                <>
                  <div className="result-card">
                    <div className="result-orbit">{result.code}</div>
                    <div>
                      <p className="eyebrow">孩子的学习风格</p>
                      <h1>{result.code}</h1>
                      <p>{result.label}</p>
                    </div>
                    <button onClick={() => setAnswers([])}>重新测试 ↻</button>
                  </div>
                  <p className="disclaimer">这是学习风格参考，不是心理诊断，也不代表孩子的能力上限。</p>
                  <div className="match-explainer">
                    <span>✦</span>
                    <div>
                      <b>为什么这样匹配？</b>
                      <ul>{result.advice.map((line) => <li key={line}>{line}</li>)}</ul>
                    </div>
                  </div>
                  <div className="matched-title">
                    <div><p className="eyebrow">PERSONALIZED</p><h2>为他匹配的老师</h2></div>
                    <span>共 {matched.length} 位</span>
                  </div>
                  <div className="match-list">
                    {matched.slice(0, 3).map((t) => (
                      <article key={t.name} className="mini-teacher">
                        <div className="mini-avatar" style={{ backgroundColor: t.color }}>{t.avatar ? <img src={t.avatar} alt={`${t.name}老师`} /> : t.name[0]}</div>
                        <div>
                          <h3>{t.name}<i>✓</i></h3>
                          <p>{t.subject} · {t.tags[0]} · ¥{t.price} 起</p>
                          <span>★ {t.rating} · {t.slots[0]} 可约</span>
                        </div>
                        <button onClick={() => setBookFor(t)}>约试听</button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "chat" && (
            <section className="chat-screen">
              {!inChat ? (
                <>
                  <div className="chat-list-title"><h1>消息</h1><span>1 条未读</span></div>
                  <button className="chat-contact" onClick={() => setInChat(true)}>
                    <div className="chat-avatar"><img src={linAvatar} alt="林知夏老师" /></div>
                    <div><h3>林知夏老师 <i>✓</i></h3><p>{messages[messages.length - 1].text}</p></div>
                    <time>10:18</time>
                  </button>
                  <div className="chat-empty"><span>◌</span><p>约过试听的老师会出现在这里，聊过再决定要不要长期跟。</p></div>
                </>
              ) : (
                <div className="conversation">
                  <div className="conversation-head">
                    <button onClick={() => setInChat(false)}>‹</button>
                    <div className="chat-avatar small"><img src={linAvatar} alt="林知夏老师" /></div>
                    <b>林知夏老师</b><span>•••</span>
                  </div>
                  <div className="date-label">今天</div>
                  <div className="message-stack">
                    {messages.map((m, i) => (
                      <div className={`bubble-row ${m.mine ? "mine" : ""}`} key={i}>
                        {!m.mine && <div className="chat-avatar tiny"><img src={linAvatar} alt="林知夏老师" /></div>}
                        <div><p className="bubble">{m.text}</p><time>{m.time}</time></div>
                      </div>
                    ))}
                  </div>
                  <div className="message-input">
                    <button>＋</button>
                    <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="聊聊孩子的学习情况" />
                    <button onClick={sendMessage} className="send">发送</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "me" && (
            <section className="me-screen">
              {role === "teacher" ? <TeacherDashboard onSettings={() => setSettingsOpen(true)} onOpenPoster={() => setPosterOpen(true)} onOpenUtility={setUtilityModal} name={teacherName} avatar={teacherAvatar} /> : (
                <>
                  <div className="profile-banner profile-hero">
                    <button className="profile-setting" aria-label="设置" onClick={() => setSettingsOpen(true)}><GearIcon /></button>
                    <div className="my-avatar">{parentAvatar}</div>
                    <div className="profile-info">
                      <p>下午好，{parentName}</p>
                      <h1>正在陪孩子 <span>家长</span></h1>
                      <small>已陪伴孩子学习第 128 天 · 查看档案 ›</small>
                    </div>
                    <div className="profile-stats">
                      <span><b>08</b><small>完成课程</small></span>
                      <span><b>{String(liked.length).padStart(2, "0")}</b><small>收藏老师</small></span>
                      <span><b>12</b><small>学习天数</small></span>
                    </div>
                  </div>
                  <ParentDashboard
                    liked={liked}
                    booked={booked}
                    openConnected={openConnected}
                    setOpenConnected={setOpenConnected}
                    openLiked={openLiked}
                    setOpenLiked={setOpenLiked}
                    onBook={setBookFor}
                    onSubscribe={() => setSubscribeOpen(true)}
                    onOpenUtility={setUtilityModal}
                  />
                </>
              )}
            </section>
          )}
        </div>

        <nav className="bottom-nav">
          <button className={tab === "match" ? "selected" : ""} onClick={() => setTab("match")}><NavIcon name="discover" /><span>发现</span></button>
          <button className={tab === "test" ? "selected" : ""} onClick={() => setTab("test")}><NavIcon name="assessment" /><span>测评</span></button>
          <button className={tab === "chat" ? "selected" : ""} onClick={() => setTab("chat")}><NavIcon name="chat" /><span>消息</span></button>
          <button className={tab === "me" ? "selected" : ""} onClick={enterMe}><NavIcon name="profile" /><span>我的</span></button>
        </nav>

        {needsOpen && <NeedsSheet prefs={prefs} onDone={(next) => { setPrefs(next); setNeedsOpen(false); }} onClose={prefs ? () => setNeedsOpen(false) : undefined} />}

        {trustFor && (
          <div className="modal-backdrop" onClick={() => setTrustFor(null)}>
            <div className="sheet trust-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="handle" />
              <p className="eyebrow">SAFETY & TRUST</p>
              <h2>{trustFor.name}老师的保障</h2>
              <div className="check-list">{trustFor.checks.map((c) => <span key={c}>✓ {c}</span>)}</div>
              <h3>家长怎么说</h3>
              {trustFor.reviews.map((r) => (
                <blockquote key={r.by}><p>“{r.text}”</p><cite>{r.by}</cite></blockquote>
              ))}
              <h3>平台规则</h3>
              <ul className="rule-list">
                <li>线上课全程可录制，家长可回看 30 天</li>
                <li>首次试听免费，不满意不产生费用</li>
                <li>付费后 7 天内可免费更换老师，剩余课时全额退</li>
                <li>投诉 24 小时内平台介入，处理结果书面反馈</li>
              </ul>
              <button className="sheet-btn" onClick={() => setTrustFor(null)}>我知道了</button>
            </div>
          </div>
        )}

        {bookFor && (
          <div className="modal-backdrop centered-modal" onClick={() => setBookFor(null)}>
            <div className="sheet book-sheet" onClick={(e) => e.stopPropagation()}>
              <button className="close" aria-label="关闭预约弹窗" onClick={() => setBookFor(null)}>×</button>
              <p className="eyebrow">FREE TRIAL · 60 MIN</p>
              <h2>先和 {bookFor.name}老师聊一节</h2>
              <p className="sheet-note">免费试听，不需要订阅。先了解孩子的情况，再决定是否长期跟学。</p>
              <section className="trial-teacher">
                <div className="trial-avatar" style={{ backgroundColor: bookFor.color }}>{bookFor.avatar ? <img src={bookFor.avatar} alt={`${bookFor.name}老师`} /> : bookFor.name[0]}</div>
                <div><b>{bookFor.name}老师 <i>✓</i></b><span>{bookFor.subject} · {bookFor.years}教龄 · ★ {bookFor.rating}</span></div>
                <em>免费</em>
              </section>
              <p className="trial-slot-label">选择方便的时间</p>
              <div className="slot-grid">
                {bookFor.slots.map((slot) => (
                  <button key={slot} onClick={() => { setBooked({ teacher: bookFor.name, slot }); setBookFor(null); setOpenConnected(true); }}><span>{slot}</span><small>60 分钟试听</small></button>
                ))}
              </div>
              <small className="sheet-foot">预约成功后，老师的联系方式会在「消息」中开放</small>
            </div>
          </div>
        )}

        {playing && (
          <div className="modal-backdrop center" onClick={() => setPlaying(null)}>
            <div className="player" onClick={(e) => e.stopPropagation()}>
              <img src={playing.video} alt="" />
              <div className="player-shade" />
              <div className="player-info"><b>{playing.name}老师 · 试听片段</b><span>{playing.subject} · {playing.tags[2] ?? playing.tags[0]}</span></div>
              <div className="player-bar"><i /></div>
              <button className="player-close" onClick={() => setPlaying(null)}>×</button>
            </div>
          </div>
        )}

        {subscribeOpen && (
          <div className="modal-backdrop" onClick={() => setSubscribeOpen(false)}>
            <div className="sheet subscribe-modal" onClick={(e) => e.stopPropagation()}>
              <button className="close" onClick={() => setSubscribeOpen(false)}>×</button>
              <div className="lock-art">✦</div>
              <p className="eyebrow">闪电虎会员 · 可选</p>
              <h2>想同时对比多位老师？</h2>
              <p>试听和联系单个老师始终免费。会员适合想一次多约几位、横向比较的家长。</p>
              <div className="membership-benefits">
                <span>✓ 不限次数联系与预约</span>
                <span>✓ 每月 3 次免费试听（非会员 1 次）</span>
                <span>✓ 30 天内不合适可无限次换老师</span>
                <span>✓ 专属顾问帮你筛老师</span>
              </div>
              <button className="subscribe-btn" onClick={() => setSubscribeOpen(false)}>开通会员 · ¥19.9 / 月</button>
              <small>随时可取消 · 未使用可申请全额退</small>
            </div>
          </div>
        )}

        {posterOpen && (
          <div className="modal-backdrop centered-modal" onClick={() => setPosterOpen(false)}>
            <div className="sheet teacher-poster-modal" onClick={(e) => e.stopPropagation()}>
              <button className="close" aria-label="关闭名片" onClick={() => setPosterOpen(false)}>×</button>
              <p className="eyebrow">LIGHTNING TIGER · TEACHER CARD</p>
              <div className="teacher-poster">
                <div className="poster-brand"><span>闪</span>电虎 <small>严选一对一家教</small></div>
                <div className="poster-main">
                  <div className="poster-avatar"><img src={linAvatar} alt="林知夏老师" /></div>
                  <div><p>复旦大学 · 数学与应用数学</p><h2>{teacherName} <i>✓</i></h2><span>中考数学 · 竞赛启蒙</span></div>
                </div>
                <p className="poster-quote">“把抽象的数学，讲成孩子愿意自己动手解决的问题。”</p>
                <div className="poster-metrics"><span><b>4.9</b><small>综合评分</small></span><span><b>32</b><small>累计学生</small></span><span><b>186</b><small>授课课时</small></span></div>
                <div className="poster-footer"><div className="poster-code">▦</div><p>扫码查看老师详情<br />预约免费试听</p></div>
              </div>
              <button className="sheet-btn" onClick={() => setPosterOpen(false)}>保存名片海报</button>
            </div>
          </div>
        )}

        {settingsOpen && role && (
          <div className="modal-backdrop centered-modal" onClick={() => setSettingsOpen(false)}>
            <div className="sheet settings-modal settings-menu" onClick={(e) => e.stopPropagation()}>
              <div className="settings-head">
                <div><p className="eyebrow">ACCOUNT SETTINGS</p><h2>设置</h2></div>
                <button className="close" aria-label="关闭设置" onClick={() => setSettingsOpen(false)}>×</button>
              </div>
              <button className="settings-menu-item" onClick={() => { setSettingsOpen(false); setRoleOpen(true); }}>
                <span className="settings-menu-icon">⇄</span>
                <span><b>切换身份</b><small>在家长与老师工作台之间切换</small></span>
                <i>›</i>
              </button>
            </div>
          </div>
        )}

        {roleOpen && (
          <div className="modal-backdrop centered-modal">
            <div className="sheet role-modal">
              <div className="handle" />
              <p className="eyebrow">WELCOME TO LIGHTNING TIGER</p>
              <h2>你的身份是？</h2>
              <button onClick={() => { setRole("parent"); setRoleOpen(false); }}>
                <span className="role-icon peach">⌂</span>
                <span><b>我是家长</b><small>为孩子寻找合拍的老师</small></span><i>›</i>
              </button>
              <button onClick={() => { setRole("teacher"); setRoleOpen(false); }}>
                <span className="role-icon green">✎</span>
                <span><b>我是老师</b><small>开启专业陪伴之旅</small></span><i>›</i>
              </button>
              {role && <button className="text-btn" onClick={() => setRoleOpen(false)}>暂不切换</button>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function NeedsSheet({ prefs, onDone, onClose }: { prefs: Prefs | null; onDone: (prefs: Prefs) => void; onClose?: () => void }) {
  const [grade, setGrade] = useState<Grade>(prefs?.grade ?? "初中");
  const [subject, setSubject] = useState(prefs?.subject ?? "数学");
  const [budget, setBudget] = useState(prefs?.budget && prefs.budget <= 100 ? 100 : prefs?.budget && prefs.budget <= 200 ? 200 : 999);
  const availableSubjects = grade === "小学" ? subjects.slice(0, 3) : subjects;
  const chooseGrade = (nextGrade: Grade) => {
    setGrade(nextGrade);
    if (nextGrade === "小学" && !subjects.slice(0, 3).includes(subject)) setSubject("数学");
  };

  return (
    <div className="modal-backdrop centered-modal">
      <div className="sheet needs-sheet">
        <div className="handle" />
        <p className="eyebrow">TELL US ABOUT YOUR CHILD</p>
        <h2>先告诉我们三件事</h2>
        <p className="sheet-note">这样推荐的每一位老师，都真的教这个学段和科目。</p>
        <div className="needs-group">
          <label>孩子的学段</label>
          <div className="chip-row">{grades.map((g) => <button key={g} className={g === grade ? "on" : ""} onClick={() => chooseGrade(g)}>{g}</button>)}</div>
        </div>
        <div className="needs-group">
          <label>想补的科目</label>
          <div className="chip-row">{availableSubjects.map((s) => <button key={s} className={s === subject ? "on" : ""} onClick={() => setSubject(s)}>{s}</button>)}</div>
        </div>
        <div className="needs-group">
          <label>单次课预算（60 分钟）</label>
          <div className="chip-row">{budgetOptions.map((option) => <button key={option.value} className={option.value === budget ? "on" : ""} onClick={() => setBudget(option.value)}>{option.label}</button>)}</div>
        </div>
        <button className="sheet-btn" onClick={() => onDone({ grade, subject, budget })}>开始为孩子找老师</button>
        {onClose && <button className="text-btn" onClick={onClose}>取消</button>}
      </div>
    </div>
  );
}

function ParentDashboard({
  liked, booked, openConnected, setOpenConnected, openLiked, setOpenLiked, onBook, onSubscribe, onOpenUtility,
}: {
  liked: Teacher[];
  booked: { teacher: string; slot: string } | null;
  openConnected: boolean;
  setOpenConnected: (open: boolean) => void;
  openLiked: boolean;
  setOpenLiked: (open: boolean) => void;
  onBook: (teacher: Teacher) => void;
  onSubscribe: () => void;
  onOpenUtility: (title: string) => void;
}) {
  return (
    <div className="dashboard card-dashboard">
      <div className="dashboard-title">
        <div><p className="eyebrow">PARENT SPACE</p><h2>为孩子管理学习</h2></div>
      </div>

      <div className="workbench-grid">
      <section className={`function-card ${openConnected ? "expanded" : ""}`}>
        <button className="function-trigger" onClick={() => onOpenUtility("老师管理")}>
          <span className="card-icon coral"><WorkIcon name="users" /></span>
          <span>
            <small>老师管理</small><b>已对接老师</b>
            <em>{booked ? `${booked.teacher}老师 · 试听 ${booked.slot}` : "林知夏老师 · 下次课周六 14:00"}</em>
          </span>
          <i>{openConnected ? "⌃" : "›"}</i>
        </button>
        {openConnected && (
          <div className="teacher-expand">
            <article>
              <div className="mini-avatar orange"><img src={linAvatar} alt="林知夏老师" /></div>
              <div><h3>{booked ? booked.teacher : "林知夏"}老师 <i>✓</i></h3><p>{booked ? `免费试听已预约 · ${booked.slot}` : "数学 · 已陪伴孩子 24 天"}</p></div>
            </article>
            <div className="teacher-expand-actions">
              <button>★ 评价老师</button>
              <button>¥ 打赏老师</button>
              <button>查看课程</button>
            </div>
          </div>
        )}
      </section>

      <section className={`function-card ${openLiked ? "expanded" : ""}`}>
        <button className="function-trigger" onClick={() => onOpenUtility("我的收藏")}>
          <span className="card-icon blush"><WorkIcon name="heart" /></span>
          <span>
            <small>我的收藏</small><b>感兴趣的老师</b>
            <em>{liked.length ? `已收藏 ${liked.length} 位，可展开对比` : "右滑心动的老师会出现在这里"}</em>
          </span>
          <i>{openLiked ? "⌃" : "›"}</i>
        </button>
        {openLiked && (
          <div className="teacher-expand">
            {liked.length ? liked.map((t) => (
              <article key={t.name} className="compare-row">
                <div className="mini-avatar" style={{ backgroundColor: t.color }}>{t.avatar ? <img src={t.avatar} alt={`${t.name}老师`} /> : t.name[0]}</div>
                <div>
                  <h3>{t.name}老师 <i>✓</i></h3>
                  <p>{t.subject} · {t.years}教龄 · ¥{t.price} 起 · {t.slots[0]} 可约</p>
                </div>
                <button onClick={() => onBook(t)}>约试听</button>
              </article>
            )) : <p className="expand-empty">还没有收藏。在「发现」里右滑，或点 ♥ 收藏喜欢的老师。</p>}
            {liked.length > 1 && <button className="compare-more" onClick={onSubscribe}>同时约多位老师对比 ›</button>}
          </div>
        )}
      </section>

      <button className="function-card function-trigger" onClick={() => onOpenUtility("成长记录")}>
        <span className="card-icon mint"><WorkIcon name="chart" /></span>
        <span><small>成长记录</small><b>学习动态</b><em>本周学习报告已生成</em></span><i>›</i>
      </button>
      <button className="function-card function-trigger" onClick={() => onOpenUtility("孩子档案")}>
        <span className="card-icon lilac"><WorkIcon name="folder" /></span>
        <span><small>孩子档案</small><b>孩子的成长档案</b><em>学习风格已更新 · 7 月 26 日</em></span><i>›</i>
      </button>
      </div>
    </div>
  );
}

function TeacherDashboard({ onSettings, onOpenPoster, onOpenUtility, name, avatar }: { onSettings: () => void; onOpenPoster: () => void; onOpenUtility: (title: string) => void; name: string; avatar: string }) {
  return (
    <>
      <section className="teacher-profile-card">
        <div className="teacher-profile-top"><button aria-label="设置" onClick={onSettings}><GearIcon /></button></div>
        <div className="teacher-profile-main">
          <div className="teacher-big-avatar">{avatar}</div>
          <div><h1>{name} <i>✓</i></h1><small>复旦大学 · 数学与应用数学</small></div>
        </div>
        <div className="teacher-profile-tags"><span>985 / 211</span><span>中考数学</span><span>竞赛启蒙</span></div>
        <div className="teacher-profile-stats">
          <span><b>32</b><small>累计学生</small></span>
          <span><b>4.9</b><small>综合评分</small></span>
          <span><b>186</b><small>授课课时</small></span>
        </div>
      </section>
      <section className="revenue-card" aria-label="收益概览">
        <div className="revenue-head"><div><p>收益概览</p><b>本月授课收益</b></div></div>
        <div className="revenue-grid">
          <span><small>总佣金</small><b>¥12,680</b></span>
          <span><small>待入账</small><b>¥2,460</b></span>
          <span><small>可提现</small><b>¥8,920</b></span>
        </div>
      </section>
      <div className="dashboard teacher-dashboard">
        <div className="dashboard-title"><div><p className="eyebrow">TEACHER DESK</p><h2>我的教学工作台</h2></div></div>
        <div className="workbench-grid">
        <button className="function-card function-trigger" onClick={() => onOpenUtility("学生管理")}>
          <span className="card-icon coral"><WorkIcon name="users" /></span>
          <span><small>学生管理</small><b>已对接家长</b><em>12 位家长 · 16 名学生正在学习</em></span><i>›</i>
        </button>
        <button className="function-card function-trigger" onClick={() => onOpenUtility("课程安排")}>
          <span className="card-icon mint"><WorkIcon name="calendar" /></span>
          <span><small>课程安排</small><b>本周课程</b><em>今日 2 节课，下一节 14:00 开始</em></span><i>›</i>
        </button>
        <button className="function-card function-trigger" onClick={() => onOpenUtility("我的资料")}>
          <span className="card-icon lilac"><WorkIcon name="edit" /></span>
          <span><small>我的资料</small><b>授课信息与展示页</b><em>完善资料，提升家长匹配度</em></span><i>›</i>
        </button>
        <button className="function-card function-trigger" onClick={() => onOpenUtility("专业成长")}>
          <span className="card-icon blush"><WorkIcon name="star" /></span>
          <span><small>专业成长</small><b>教学评价</b><em>98% 家长愿意推荐给朋友</em></span><i>›</i>
        </button>
        <button className="function-card function-trigger personal-card" onClick={onOpenPoster}>
          <span className="card-icon lilac"><WorkIcon name="shield" /></span>
          <span><small>个人名片</small><b>生成介绍海报</b><em>分享给有需要的家长</em></span><i>›</i>
        </button>
        </div>
      </div>
    </>
  );
}
