import type { Correctness, Difficulty, Question } from "../../shared/types.ts";

export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function suggestedResult(question: Question, selected: string): Correctness | null {
  if (!selected || !question.answer.trim()) return null;
  if (question.questionType === "mcq") {
    const keyLetter = question.answer.trim().match(/^\(?([a-d])\)?$/i)?.[1]?.toUpperCase();
    if (keyLetter) {
      return selected.toUpperCase() === keyLetter ? "correct" : "incorrect";
    }
    const normalizedKey = normalizeAnswer(question.answer);
    const options = question.options ?? [];
    const keyIndex = options.findIndex(
      (option) =>
        normalizeAnswer(option) === normalizedKey ||
        normalizeAnswer(option).replace(/^[a-d][).]\s*/, "") === normalizedKey,
    );
    if (keyIndex >= 0) {
      return selected.toUpperCase() === optionLetter(keyIndex) ? "correct" : "incorrect";
    }
    return null;
  }
  return normalizeAnswer(selected) === normalizeAnswer(question.answer) ? "correct" : null;
}

export function difficultyTone(difficulty: Difficulty): "success" | "warn" | "danger" {
  return difficulty === "easy" ? "success" : difficulty === "medium" ? "warn" : "danger";
}
