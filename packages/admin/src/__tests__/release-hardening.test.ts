import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parentBookingSchema,
  parentReviewSchema,
} from "../lib/validation";
import {
  DiagnosisUnavailableError,
  generateDiagnosis,
} from "../lib/diagnosis";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("release hardening", () => {
  it("uses parent-safe schemas and returns 503 for unavailable diagnosis providers", () => {
    const bookingRoute = readFileSync(
      resolve(__dirname, "../app/api/public/bookings/route.ts"),
      "utf8",
    );
    const reviewRoute = readFileSync(
      resolve(__dirname, "../app/api/public/reviews/route.ts"),
      "utf8",
    );
    const diagnosisRoute = readFileSync(
      resolve(__dirname, "../app/api/diagnose/route.ts"),
      "utf8",
    );

    expect(bookingRoute).toContain("parentBookingSchema.safeParse(body)");
    expect(reviewRoute).toContain("parentReviewSchema.safeParse(body)");
    expect(diagnosisRoute).toContain("error instanceof DiagnosisUnavailableError");
    expect(diagnosisRoute).toContain("{ error: error.message }");
    expect(diagnosisRoute).toContain("status: 503");
  });

  it("accepts parent booking and review payloads without server-controlled fields", () => {
    const booking = parentBookingSchema.parse({
      parentId: "malicious-parent-id",
      teacherId: "teacher-1",
      subject: "Math",
      slot: "Monday 10:00",
    });
    const review = parentReviewSchema.parse({
      teacherId: "teacher-1",
      author: "malicious-author",
      text: "Clear and helpful lessons.",
      rating: 5,
    });

    expect(booking).not.toHaveProperty("parentId");
    expect(review).not.toHaveProperty("author");
  });

  it("rejects diagnosis generation when no AI API key is configured", async () => {
    vi.stubEnv("AI_API_KEY", "");

    await expect(
      generateDiagnosis({
        subject: "Math",
        grade: "Grade 8",
        images: ["data:image/png;base64,AA=="],
      }),
    ).rejects.toBeInstanceOf(DiagnosisUnavailableError);
  });

  it("maps AI provider failures to DiagnosisUnavailableError", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    await expect(
      generateDiagnosis({
        subject: "Math",
        grade: "Grade 8",
        images: ["data:image/png;base64,AA=="],
      }),
    ).rejects.toBeInstanceOf(DiagnosisUnavailableError);
  });

  it("maps malformed AI output to DiagnosisUnavailableError", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: "{}" } }],
        }),
      }),
    );

    await expect(
      generateDiagnosis({
        subject: "Math",
        grade: "Grade 8",
        images: ["data:image/png;base64,AA=="],
      }),
    ).rejects.toBeInstanceOf(DiagnosisUnavailableError);
  });
});
