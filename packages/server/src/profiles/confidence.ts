const DECAY_DAYS = 180;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export type ConfidenceEvidence = {
  source: string;
  observedAt: Date;
  payload: unknown;
};

export type ConfidenceBasis = {
  evidenceCount: number;
  sourceCount: number;
  knowledgePointCount: number;
  averageFreshness: number;
  decayDays: number;
  score: number;
};

function knowledgePoints(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const value = (payload as { knowledgePoints?: unknown }).knowledgePoints;
  if (!Array.isArray(value)) return [];

  return value.filter((point): point is string => typeof point === "string" && point.trim().length > 0);
}

export function buildConfidenceBasis(
  evidence: readonly ConfidenceEvidence[],
  now: Date,
): ConfidenceBasis {
  if (evidence.length === 0) {
    return {
      evidenceCount: 0,
      sourceCount: 0,
      knowledgePointCount: 0,
      averageFreshness: 0,
      decayDays: DECAY_DAYS,
      score: 0,
    };
  }

  const averageFreshness = evidence.reduce((sum, item) => {
    const ageInDays = Math.max(0, (now.getTime() - item.observedAt.getTime()) / MILLIS_PER_DAY);
    return sum + Math.exp(-ageInDays / DECAY_DAYS);
  }, 0) / evidence.length;
  const sourceCount = new Set(evidence.map((item) => item.source)).size;
  const knowledgePointCount = new Set(evidence.flatMap((item) => knowledgePoints(item.payload))).size;
  const countScore = Math.min(1, evidence.length / 5);
  const diversityScore = Math.min(1, sourceCount / 3);
  const coverageScore = Math.min(1, knowledgePointCount / 10);
  const score = Math.round(Math.max(0, Math.min(100, (
    countScore * 0.25
    + diversityScore * 0.2
    + coverageScore * 0.25
    + averageFreshness * 0.3
  ) * 100)));

  return {
    evidenceCount: evidence.length,
    sourceCount,
    knowledgePointCount,
    averageFreshness,
    decayDays: DECAY_DAYS,
    score,
  };
}

export function scoreConfidence(evidence: readonly ConfidenceEvidence[], now: Date): number {
  return buildConfidenceBasis(evidence, now).score;
}
