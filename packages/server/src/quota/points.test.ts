import { describe, expect, it } from "vitest";
import {
  DEFAULT_POINTS_RATES,
  calculatePoints,
  estimateReservationPoints,
  settleDifference,
} from "./points";

describe("calculatePoints", () => {
  it("converts usage to platform points per the formula", () => {
    expect(
      calculatePoints(
        { inputTokens: 1000, outputTokens: 500, images: 2 },
        { inputPer1k: 2, outputPer1k: 6, perImage: 10, perRequest: 1 },
      ),
    ).toBe(29);
  });

  it("uses default rates when not provided", () => {
    const points = calculatePoints({ inputTokens: 0, outputTokens: 0, images: 0 });
    expect(points).toBe(DEFAULT_POINTS_RATES.perRequest);
  });

  it("rounds up partial token chunks to 1k boundaries", () => {
    // 1 input token -> ceil(1/1000) = 1 chunk
    expect(calculatePoints({ inputTokens: 1, outputTokens: 0, images: 0 })).toBe(
      DEFAULT_POINTS_RATES.perRequest + DEFAULT_POINTS_RATES.inputPer1k,
    );
    // 1001 input tokens -> ceil(1001/1000) = 2 chunks
    expect(calculatePoints({ inputTokens: 1001, outputTokens: 0, images: 0 })).toBe(
      DEFAULT_POINTS_RATES.perRequest + 2 * DEFAULT_POINTS_RATES.inputPer1k,
    );
    // 1 output token -> ceil(1/1000) = 1 chunk
    expect(calculatePoints({ inputTokens: 0, outputTokens: 1, images: 0 })).toBe(
      DEFAULT_POINTS_RATES.perRequest + DEFAULT_POINTS_RATES.outputPer1k,
    );
  });

  it("charges per-image separately", () => {
    expect(calculatePoints({ inputTokens: 0, outputTokens: 0, images: 3 })).toBe(
      DEFAULT_POINTS_RATES.perRequest + 3 * DEFAULT_POINTS_RATES.perImage,
    );
  });

  it("throws on negative usage values", () => {
    expect(() => calculatePoints({ inputTokens: -1, outputTokens: 0, images: 0 })).toThrow();
    expect(() => calculatePoints({ inputTokens: 0, outputTokens: -1, images: 0 })).toThrow();
    expect(() => calculatePoints({ inputTokens: 0, outputTokens: 0, images: -1 })).toThrow();
  });

  it("returns only perRequest when all zero usage", () => {
    expect(calculatePoints({ inputTokens: 0, outputTokens: 0, images: 0 })).toBe(
      DEFAULT_POINTS_RATES.perRequest,
    );
  });
});

describe("estimateReservationPoints", () => {
  it("estimates by ceiling output at maxOutputTokens", () => {
    const estimate = estimateReservationPoints({
      inputTokens: 500,
      maxOutputTokens: 2048,
      images: 1,
    });
    // input=500 -> ceil(500/1000)=1 chunk
    // output=2048 -> ceil(2048/1000)=3 chunks
    // images=1
    const expected =
      DEFAULT_POINTS_RATES.perRequest +
      1 * DEFAULT_POINTS_RATES.inputPer1k +
      3 * DEFAULT_POINTS_RATES.outputPer1k +
      1 * DEFAULT_POINTS_RATES.perImage;
    expect(estimate).toBe(expected);
  });

  it("treats image=0 when omitted", () => {
    const estimate = estimateReservationPoints({
      inputTokens: 0,
      maxOutputTokens: 1000,
    });
    const noImage = calculatePoints({ inputTokens: 0, outputTokens: 1000, images: 0 });
    expect(estimate).toBe(noImage);
  });
});

describe("settleDifference", () => {
  it("returns negative when reserved covers actual (refund scenario)", () => {
    const diff = settleDifference({
      reservedPoints: 50,
      actualUsage: { inputTokens: 1000, outputTokens: 1000, images: 0 },
    });
    const actual = calculatePoints({ inputTokens: 1000, outputTokens: 1000, images: 0 });
    expect(diff).toBe(actual - 50);
    expect(diff).toBeLessThanOrEqual(0); // actual 9, reserved 50 -> negative
  });

  it("returns positive when reserved was insufficient (should not happen in good flow)", () => {
    const diff = settleDifference({
      reservedPoints: 1,
      actualUsage: { inputTokens: 5000, outputTokens: 5000, images: 5 },
    });
    const actual = calculatePoints({ inputTokens: 5000, outputTokens: 5000, images: 5 });
    expect(diff).toBe(actual - 1);
    expect(diff).toBeGreaterThan(0);
  });

  it("returns zero on exact match", () => {
    const actualUsage = { inputTokens: 1000, outputTokens: 500, images: 2 };
    const points = calculatePoints(actualUsage);
    expect(settleDifference({ reservedPoints: points, actualUsage })).toBe(0);
  });
});
