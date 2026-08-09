import { questions } from "../constants";

export const LEARNING_STYLE_V1_QUESTION_DATA = Object.freeze(questions.map((question, index) => Object.freeze({
  id: `q${index + 1}`,
  prompt: question.title,
  dimension: question.dim,
  options: Object.freeze(question.options.map((option, optionIndex) => Object.freeze({
    id: optionIndex === 0 ? "A" : "B",
    text: option.text,
    letter: option.letter,
  }))),
})));
