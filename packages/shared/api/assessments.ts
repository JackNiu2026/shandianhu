import { LEARNING_STYLE_V1_QUESTION_DATA } from "./learning-style-v1-data";

export const LEARNING_STYLE_VERSION = "learning-style-v1" as const;
export type LearningStyleOption = "A" | "B";
export type LearningStyleAnswer = { questionId: string; option: LearningStyleOption };

export const LEARNING_STYLE_QUESTIONS = LEARNING_STYLE_V1_QUESTION_DATA;
export const LEARNING_STYLE_VERSION_CONFIGURATION = Object.freeze({
  version: LEARNING_STYLE_VERSION,
  legalOptions: ["A", "B"] as const,
  questions: LEARNING_STYLE_QUESTIONS,
  scorer: "deterministic-learning-style-v1",
});
export const LEARNING_STYLE_VERSION_CHECKSUM = "5fc562cf50f634b40842fc5a53e40e6ed133c324b292d7876f8c4bb07119c099";

export type LearningStyleSubmission = {
  childId: string;
  answers: LearningStyleAnswer[];
  idempotencyKey: string;
};
