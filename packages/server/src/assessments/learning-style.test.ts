import { describe, expect, it } from "vitest";
import type { LearningStyleAnswer } from "@lightning-tiger/shared";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEARNING_STYLE_VERSION_CHECKSUM, LEARNING_STYLE_VERSION_CONFIGURATION } from "@lightning-tiger/shared";
import { LEARNING_STYLE_QUESTIONS, scoreLearningStyle } from "./learning-style";

function answers(option: "A" | "B" = "A") {
  return LEARNING_STYLE_QUESTIONS.map((question) => ({ questionId: question.id, option }));
}

describe("learning-style scoring", () => {
  it("pins the complete v1 question rules independently of legacy UI questions", () => {
    const contractSource = readFileSync(resolve(__dirname, "../../../shared/api/assessments.ts"), "utf8");
    const versionSource = readFileSync(resolve(__dirname, "../../../shared/api/learning-style-v1-data.ts"), "utf8");

    expect(contractSource).not.toContain('from "../constants"');
    expect(versionSource).not.toMatch(/from ["'][^"']*constants/);
    expect(LEARNING_STYLE_VERSION_CONFIGURATION.questions).toHaveLength(28);
    expect(LEARNING_STYLE_VERSION_CONFIGURATION.legalOptions).toEqual(["A", "B"]);
    expect(LEARNING_STYLE_VERSION_CHECKSUM).toMatch(/^[a-f0-9]{64}$/);
  });

  it("scores all four dimensions without model influence", () => {
    const result = scoreLearningStyle(answers());

    expect(result).toEqual({
      version: "learning-style-v1",
      dimensions: {
        interaction: 7,
        information: 7,
        decision: 7,
        rhythm: 7,
      },
      code: "ESTJ",
    });
  });

  it.each([
    ["is missing an answer", answers().slice(1)],
    ["contains a duplicate question", [...answers().slice(0, 27), answers()[0]!]],
    ["contains an unknown question", [...answers().slice(0, 27), { questionId: "q29", option: "A" }]],
    ["contains an illegal option", [...answers().slice(0, 27), { questionId: "q28", option: "C" }]],
  ])("rejects submissions that %s", (_description, submission) => {
    expect(() => scoreLearningStyle(submission as unknown as LearningStyleAnswer[])).toThrow(/28 known unique answers/i);
  });

  it("returns the same result for the same answers regardless of answer order", () => {
    const ordered = answers().map((answer, index) => ({ ...answer, option: index % 2 === 0 ? "A" as const : "B" as const }));
    const reversed = [...ordered].reverse();

    expect(scoreLearningStyle(reversed)).toEqual(scoreLearningStyle(ordered));
  });
});
