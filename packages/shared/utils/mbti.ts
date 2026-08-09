import type { Dim, MBTIResult } from "../types";
import { questions, typeNames, styleAdvice, typeProfiles } from "../constants";

/**
 * MBTI 计分：对每个维度，统计答案中对应字母的票数，过半即胜出
 */
function pick(dim: Dim, answers: string[], a: string, b: string): string {
  const votes = questions.map((q, i) => (q.dim === dim ? answers[i] : null)).filter(Boolean);
  const threshold = Math.floor(votes.length / 2) + 1;
  return votes.filter((v) => v === a).length >= threshold ? a : b;
}

/**
 * 根据 28 题答案计算 MBTI 学习风格结果
 */
export function calculateMBTI(answers: string[]): MBTIResult | null {
  if (answers.length < questions.length) return null;

  const letters = [
    pick("EI", answers, "I", "E"),
    pick("SN", answers, "N", "S"),
    pick("TF", answers, "F", "T"),
    pick("JP", answers, "J", "P"),
  ];

  const code = letters.join("");

  return {
    code,
    label: letters.map((l) => typeNames[l]).join(" · "),
    profile: typeProfiles[code] ?? `${code} 型学习者`,
    advice: (["EI", "SN", "TF", "JP"] as Dim[]).map((dim, i) => styleAdvice[dim][letters[i]]),
  };
}
