import { describe, expect, it } from "vitest";
import { buildConfidenceBasis, scoreConfidence } from "./confidence";

const now = new Date("2026-08-09T00:00:00.000Z");

describe("scoreConfidence", () => {
  it("reduces confidence as valid evidence ages", () => {
    const recent = scoreConfidence([
      {
        source: "ASSESSMENT",
        observedAt: new Date("2026-08-01T00:00:00.000Z"),
        payload: { knowledgePoints: ["fractions"] },
      },
    ], now);
    const old = scoreConfidence([
      {
        source: "ASSESSMENT",
        observedAt: new Date("2025-08-01T00:00:00.000Z"),
        payload: { knowledgePoints: ["fractions"] },
      },
    ], now);

    expect(recent).toBeGreaterThan(old);
    expect(recent).toBeGreaterThanOrEqual(0);
    expect(recent).toBeLessThanOrEqual(100);
  });

  it("uses evidence facts instead of a model-provided confidence", () => {
    const evidence = {
      source: "ASSESSMENT",
      observedAt: new Date("2026-08-01T00:00:00.000Z"),
      payload: {
        knowledgePoints: ["fractions", "decimals"],
        confidence: 100,
      },
    };

    expect(scoreConfidence([evidence], now)).toBeLessThan(100);
    expect(buildConfidenceBasis([evidence], now)).toMatchObject({
      evidenceCount: 1,
      sourceCount: 1,
      knowledgePointCount: 2,
      decayDays: 180,
    });
  });
});
