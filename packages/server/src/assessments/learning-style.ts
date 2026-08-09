import {
  LEARNING_STYLE_QUESTIONS as sharedQuestions,
  LEARNING_STYLE_VERSION,
  type LearningStyleAnswer,
} from "@lightning-tiger/shared";
import { AppError } from "../errors/app-error";

export const LEARNING_STYLE_QUESTIONS = sharedQuestions;

export type LearningStyleResult = {
  version: typeof LEARNING_STYLE_VERSION;
  dimensions: {
    interaction: number;
    information: number;
    decision: number;
    rhythm: number;
  };
  code: `${"E" | "I"}${"S" | "N"}${"T" | "F"}${"J" | "P"}`;
};

export function scoreLearningStyle(answers: readonly LearningStyleAnswer[]): LearningStyleResult {
  if (answers.length !== LEARNING_STYLE_QUESTIONS.length) invalidAnswers();

  const known = new Map(LEARNING_STYLE_QUESTIONS.map((question) => [question.id, question]));
  const selected = new Set<string>();
  const letters: string[] = [];
  for (const answer of answers) {
    const question = known.get(answer.questionId);
    const option = question?.options.find((candidate) => candidate.id === answer.option);
    if (!question || !option || selected.has(answer.questionId)) invalidAnswers();
    selected.add(answer.questionId);
    letters.push(option.letter);
  }
  if (selected.size !== LEARNING_STYLE_QUESTIONS.length) invalidAnswers();

  const dimensions = {
    interaction: score(letters, "E", "I"),
    information: score(letters, "S", "N"),
    decision: score(letters, "T", "F"),
    rhythm: score(letters, "J", "P"),
  };
  return {
    version: LEARNING_STYLE_VERSION,
    dimensions,
    code: `${winner(dimensions.interaction, "E", "I")}${winner(dimensions.information, "S", "N")}${winner(dimensions.decision, "T", "F")}${winner(dimensions.rhythm, "J", "P")}`,
  };
}

function score(letters: readonly string[], first: string, second: string): number {
  return letters.filter((letter) => letter === first).length - letters.filter((letter) => letter === second).length;
}

function winner<A extends string, B extends string>(score: number, first: A, second: B): A | B {
  return score > 0 ? first : second;
}

function invalidAnswers(): never {
  throw new AppError("VALIDATION_ERROR", 400, "Submission must contain exactly 28 known unique answers with legal options");
}
