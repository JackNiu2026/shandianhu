import type { DiagnosisReport } from "@lightning-tiger/shared";
import { z } from "zod";

export type DiagnosisInput = {
  subject: string;
  grade: string;
  images: string[];
};

export type DiagnosisResult = Omit<DiagnosisReport, "id" | "createdAt">;

const aiDiagnosisSchema = z.object({
  overallScore: z.number(),
  level: z.string().min(1).optional(),
  weakPoints: z.array(
    z.object({
      topic: z.string(),
      mastery: z.number(),
    }),
  ),
  errorTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number(),
      ratio: z.number(),
    }),
  ),
  questionAnalysis: z.array(
    z.object({
      question: z.string(),
      errorType: z.string(),
      analysis: z.string(),
      correctApproach: z.string(),
    }),
  ),
  suggestions: z.array(z.string()),
});

function scoreToLevel(score: number): string {
  if (score >= 85) return "Strong foundation";
  if (score >= 70) return "Good foundation with some gaps";
  if (score >= 55) return "Foundation needs reinforcement";
  return "Foundation needs significant improvement";
}

export class DiagnosisUnavailableError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DiagnosisUnavailableError";
    this.cause = cause;
  }
}

async function callAIVisionAPI(
  input: DiagnosisInput,
  apiKey: string,
): Promise<DiagnosisResult> {
  const apiUrl =
    process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o";
  const prompt = `You are a professional ${input.subject} teacher. Analyze the ${input.images.length} supplied images and return a JSON diagnosis report for a ${input.grade} student with overallScore, level, weakPoints, errorTypes, questionAnalysis, and suggestions.`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...input.images.map((url) => ({
              type: "image_url",
              image_url: { url },
            })),
          ],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI API returned empty content");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI API returned invalid JSON");
  }

  const parsed = aiDiagnosisSchema.parse(JSON.parse(jsonMatch[0]));
  return {
    subject: input.subject,
    grade: input.grade,
    overallScore: parsed.overallScore,
    level: parsed.level ?? scoreToLevel(parsed.overallScore),
    weakPoints: parsed.weakPoints,
    errorTypes: parsed.errorTypes,
    questionAnalysis: parsed.questionAnalysis,
    suggestions: parsed.suggestions,
  };
}

export async function generateDiagnosis(
  input: DiagnosisInput,
): Promise<DiagnosisResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new DiagnosisUnavailableError("AI diagnosis is not configured");
  }

  try {
    return await callAIVisionAPI(input, apiKey);
  } catch (error) {
    throw new DiagnosisUnavailableError("AI diagnosis provider is unavailable", error);
  }
}
