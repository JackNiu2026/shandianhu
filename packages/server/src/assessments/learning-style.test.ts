import { describe, expect, it } from "vitest";
import type { LearningStyleAnswer } from "@lightning-tiger/shared";
import { LEARNING_STYLE_QUESTIONS, scoreLearningStyle } from "./learning-style";

function answers(option: "A" | "B" = "A") {
  return LEARNING_STYLE_QUESTIONS.map((question) => ({ questionId: question.id, option }));
}

describe("learning-style scoring", () => {
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
