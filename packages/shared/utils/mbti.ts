import type { Dim, MBTIResult } from "../types";
import { questions, typeNames, styleAdvice } from "../constants";

/**
 * MBTI 计分：对每个维度，统计答案中对应字母的票数，达到 2 票即选出
 */
function pick(dim: Dim, answers: string[], a: string, b: string): string {
  const votes = questions.map((q, i) => (q.dim === dim ? answers[i] : null)).filter(Boolean);
  return votes.filter((v) => v === a).length >= 2 ? a : b;
}

/**
 * 根据 12 题答案计算 MBTI 学习风格结果
 */
export function calculateMBTI(answers: string[]): MBTIResult | null {
  if (answers.length < questions.length) return null;

  const letters = [
    pick("EI", answers, "I", "E"),
    pick("SN", answers, "N", "S"),
    pick("TF", answers, "F", "T"),
    pick("JP", answers, "J", "P"),
  ];

  return {
    code: letters.join(""),
    label: letters.map((l) => typeNames[l]).join(" · "),
    advice: (["EI", "SN", "TF", "JP"] as Dim[]).map((dim, i) => styleAdvice[dim][letters[i]]),
  };
}
