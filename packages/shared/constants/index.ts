import type { Grade, Dim, Question } from "../types";

export const subjects = ["语文", "数学", "英语", "物理", "化学"] as const;

export const grades: Grade[] = ["小学", "初中", "高中"];

export const budgetOptions = [
  { label: "¥50–100", value: 100 },
  { label: "¥101–200", value: 200 },
  { label: "¥200 以上", value: 999 },
];

export const questions: Question[] = [
  // ── EI 维度（7题）：外向(E) vs 内向(I) ──
  { title: "在聚会或集体活动中，孩子更倾向…", dim: "EI", options: [{ text: "主动和很多人聊天互动", letter: "E" }, { text: "和几个熟悉的人深聊，或在一旁观察", letter: "I" }] },
  { title: "上完一天课回家，孩子更需要…", dim: "EI", options: [{ text: "和家人说说今天发生的事", letter: "E" }, { text: "安静地自己待一会儿恢复精力", letter: "I" }] },
  { title: "做作业时遇到卡壳，孩子更想…", dim: "EI", options: [{ text: "马上问老师或同学，讨论着解决", letter: "E" }, { text: "自己先想一会儿，尽量独立搞定", letter: "I" }] },
  { title: "到了一个新环境（新班级/新活动），孩子会…", dim: "EI", options: [{ text: "很快开始探索、主动参与", letter: "E" }, { text: "先观察环境和人，慢慢适应", letter: "I" }] },
  { title: "课上老师提问时，孩子通常…", dim: "EI", options: [{ text: "积极举手，边说边整理思路", letter: "E" }, { text: "想好再回答，不太愿当众发言", letter: "I" }] },
  { title: "周末的时候，孩子更愿意…", dim: "EI", options: [{ text: "约朋友出去活动、参加集体项目", letter: "E" }, { text: "在家做自己喜欢的事，或约一两个好朋友", letter: "I" }] },
  { title: "学到新东西后，孩子更倾向…", dim: "EI", options: [{ text: "马上讲给别人听，在交流中加深理解", letter: "E" }, { text: "自己先消化，想清楚了再分享", letter: "I" }] },

  // ── SN 维度（7题）：感觉(S) vs 直觉(N) ──
  { title: "面对一个新概念，孩子更希望老师…", dim: "SN", options: [{ text: "讲清楚每一步怎么操作、有明确示例", letter: "S" }, { text: "先讲整体思路和框架，再落到细节", letter: "N" }] },
  { title: "孩子更容易记住…", dim: "SN", options: [{ text: "具体的步骤、数字和口诀", letter: "S" }, { text: "背后的道理和事物之间的联系", letter: "N" }] },
  { title: "遇到陌生题目，孩子倾向…", dim: "SN", options: [{ text: "照例题的方法一步步套用", letter: "S" }, { text: "先猜一个方向，再想办法验证", letter: "N" }] },
  { title: "读完一篇课文或故事，孩子更爱聊…", dim: "SN", options: [{ text: "文章具体写了什么、发生了什么", letter: "S" }, { text: "如果换个角度或结局会怎样", letter: "N" }] },
  { title: "孩子更擅长…", dim: "SN", options: [{ text: "按要求把任务做到位，注重准确性", letter: "S" }, { text: "想出和别人不一样的方法或创意", letter: "N" }] },
  { title: "学一个新知识时，孩子更关注…", dim: "SN", options: [{ text: "它是什么、具体怎么用", letter: "S" }, { text: "它和什么有关系、能推广到哪里", letter: "N" }] },
  { title: "做手工或画画时，孩子更倾向…", dim: "SN", options: [{ text: "照着实物或样品做，追求还原度", letter: "S" }, { text: "自己想象着做，追求独特性", letter: "N" }] },

  // ── TF 维度（7题）：思考(T) vs 情感(F) ──
  { title: "做错题被老师指出时，孩子更在意…", dim: "TF", options: [{ text: "到底错在哪、怎么改，情绪还好", letter: "T" }, { text: "老师的语气和别人怎么看他", letter: "F" }] },
  { title: "更能推动孩子持续努力的是…", dim: "TF", options: [{ text: "看到排名和数据上的进步", letter: "T" }, { text: "被认可、被鼓励，感受到被重视", letter: "F" }] },
  { title: "和同学意见不同时，孩子倾向…", dim: "TF", options: [{ text: "讲道理，谁对听谁的", letter: "T" }, { text: "先顾及关系和感受，不想闹僵", letter: "F" }] },
  { title: "选兴趣班或课外活动时，孩子更看重…", dim: "TF", options: [{ text: "能学到什么本事、有没有用", letter: "T" }, { text: "和谁一起上、老师好不好相处", letter: "F" }] },
  { title: "好朋友心情不好时，孩子会…", dim: "TF", options: [{ text: "帮他分析问题、想办法解决", letter: "T" }, { text: "先陪着他、安慰他，让他开心起来", letter: "F" }] },
  { title: "评价一件事做得好不好，孩子更看重…", dim: "TF", options: [{ text: "有没有达到目标、效率高不高", letter: "T" }, { text: "大家开不开心、关系有没有变好", letter: "F" }] },
  { title: "老师布置任务时，孩子更希望…", dim: "TF", options: [{ text: "要求清晰、标准明确，对事不对人", letter: "T" }, { text: "多鼓励、氛围好，关注每个人的感受", letter: "F" }] },

  // ── JP 维度（7题）：判断(J) vs 感知(P) ──
  { title: "当计划临时变了，孩子会…", dim: "JP", options: [{ text: "有点不安，希望提前知道新安排", letter: "J" }, { text: "觉得新鲜，随遇而安", letter: "P" }] },
  { title: "写作业的方式更像…", dim: "JP", options: [{ text: "列好清单，按顺序一项项做完", letter: "J" }, { text: "想到哪写到哪，最后集中冲刺", letter: "P" }] },
  { title: "孩子的书桌和书包通常…", dim: "JP", options: [{ text: "有固定摆法，比较整齐", letter: "J" }, { text: "有点乱但自己找得到", letter: "P" }] },
  { title: "面对一个长假，孩子更想…", dim: "JP", options: [{ text: "提前计划好每天干什么", letter: "J" }, { text: "到时候再说，灵活安排", letter: "P" }] },
  { title: "做选择时（比如选书、选活动），孩子更倾向…", dim: "JP", options: [{ text: "尽快定下来，确定就安心了", letter: "J" }, { text: "多看看、多试试，不急着定", letter: "P" }] },
  { title: "收到一个新任务时，孩子通常…", dim: "JP", options: [{ text: "先做计划和时间表再动手", letter: "J" }, { text: "先开始做，边做边调整", letter: "P" }] },
  { title: "对于规则和约定，孩子…", dim: "JP", options: [{ text: "希望大家遵守，不喜欢随意改", letter: "J" }, { text: "觉得可以商量，灵活一点好", letter: "P" }] },
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

export const typeProfiles: Record<string, string> = {
  INTJ: "战略家型学习者：独立思考，善于系统性规划与抽象推理，适合自主探究和深度学习",
  INTP: "逻辑学家型学习者：思维严密，喜欢探究事物原理，适合开放式探索和思辨式学习",
  INFJ: "洞察者型学习者：有远见，关注深层意义，适合启发式引导和有目标感的学习",
  INFP: "理想主义者型学习者：富有想象力，追求价值与意义，适合创意表达和个性化学习",
  ISTJ: "执行者型学习者：严谨踏实，注重事实与细节，适合结构化教学和循序渐进",
  ISTP: "实践者型学习者：动手能力强，注重实效，适合实验操作和问题导向学习",
  ISFJ: "守护者型学习者：认真负责，注重细节与惯例，适合稳定节奏和充分练习",
  ISFP: "艺术家型学习者：敏感细腻，注重个人体验，适合沉浸式和审美导向的学习",
  ENTJ: "指挥官型学习者：目标导向，善于规划与组织，适合挑战式和竞争式学习",
  ENTP: "辩论家型学习者：思维敏捷，喜欢挑战常规，适合讨论探究和头脑风暴",
  ENFJ: "教育家型学习者：善于沟通，关注他人成长，适合合作学习和互助教学",
  ENFP: "竞选者型学习者：充满创意与热情，善于激励，适合启发式和项目式学习",
  ESTJ: "管理者型学习者：务实有条理，注重效率与规则，适合系统化教学和明确标准",
  ESTP: "企业家型学习者：精力充沛，注重实践与即时反馈，适合体验式和情境式学习",
  ESFJ: "关怀者型学习者：乐于合作，注重反馈与和谐，适合互动式和小组合作学习",
  ESFP: "表演者型学习者：热爱当下，善于表现与感染他人，适合情境式和角色扮演学习",
};
