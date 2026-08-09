import { questions } from "../constants";

export const LEARNING_STYLE_VERSION = "learning-style-v1" as const;
export type LearningStyleOption = "A" | "B";
export type LearningStyleAnswer = { questionId: string; option: LearningStyleOption };

export const LEARNING_STYLE_QUESTIONS = Object.freeze(questions.map((question, index) => ({
  id: `q${index + 1}`,
  prompt: question.title,
  dimension: question.dim,
  options: Object.freeze(question.options.map((option, optionIndex) => ({
    id: optionIndex === 0 ? "A" : "B" as LearningStyleOption,
    text: option.text,
    letter: option.letter,
  }))),
})));

export type LearningStyleSubmission = {
  childId: string;
  answers: LearningStyleAnswer[];
  idempotencyKey: string;
};
