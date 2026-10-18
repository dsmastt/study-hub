import { describe, expect, it } from "vitest";
import type { MasteryAttemptInput } from "../server/mastery.ts";
import {
  computeChapterMastery,
  computeSubtopicMastery,
  MASTERY_RULES,
} from "../server/mastery.ts";
import type { Difficulty, Correctness } from "../shared/types.ts";

const NOW = new Date("2026-10-18T12:00:00.000Z").getTime();

function attempt(
  id: number,
  questionId: number,
  overrides: Partial<Omit<MasteryAttemptInput, "id" | "questionId">> = {},
): MasteryAttemptInput {
  return {
    id,
    questionId,
    correctness: "correct",
    difficulty: "medium",
    hintsUsed: 0,
    solutionViewed: false,
    createdAt: new Date(NOW - 86_400_000).toISOString(),
    mistakeType: null,
    ...overrides,
  };
}

function set(
  count: number,
  difficulty: Difficulty = "medium",
  correctness: Correctness = "correct",
): MasteryAttemptInput[] {
  return Array.from({ length: count }, (_, i) =>
    attempt(i + 1, i + 1, { difficulty, correctness }),
  );
}

describe("mastery engine", () => {
  it("withholds mastery when evidence is insufficient", () => {
    const result = computeSubtopicMastery(1, set(3));
    expect(result.mastery).toBeNull();
    expect(result.sufficient).toBe(false);
    expect(result.reason).toContain("attempts");
  });

  it("does not mark a topic mastered on only easy questions", () => {
    const result = computeSubtopicMastery(1, set(6, "easy"));
    expect(result.mastery).toBeNull();
    expect(result.sufficient).toBe(false);
    expect(result.reason).toContain("challenging evidence");
  });

  it("requires some medium or hard evidence even with enough easy attempts", () => {
    const result = computeSubtopicMastery(1, set(4, "easy"));
    expect(result.mastery).toBeNull();
    expect(result.sufficient).toBe(false);
  });

  it("estimates mastery from enough independent medium questions", () => {
    const result = computeSubtopicMastery(1, set(6, "medium", "correct"));
    expect(result.sufficient).toBe(true);
    expect(result.mastery).toBe(100);
    expect(result.distinctQuestions).toBe(6);
  });

  it("counts partial answers at half weight", () => {
    const result = computeSubtopicMastery(
      1,
      set(6, "medium", "partial"),
    );
    expect(result.mastery).toBe(50);
  });

  it("lowers mastery for incorrect answers but keeps them as evidence", () => {
    const attempts = [...set(5), attempt(6, 6, { correctness: "incorrect" })];
    const result = computeSubtopicMastery(1, attempts);
    expect(result.mastery).toBe(83.3);
    expect(result.evidence).toBeGreaterThanOrEqual(MASTERY_RULES.minEvidence);
  });

  it("penalises hints and viewed solutions", () => {
    const clean = computeSubtopicMastery(1, set(6));
    const hints = computeSubtopicMastery(
      1,
      Array.from({ length: 6 }, (_, i) => attempt(i + 1, i + 1, { hintsUsed: 3 })),
    );
    const solutions = computeSubtopicMastery(
      1,
      Array.from({ length: 6 }, (_, i) => attempt(i + 1, i + 1, { solutionViewed: true })),
    );
    expect(hints.evidence).toBeLessThan(clean.evidence);
    expect(solutions.evidence).toBeLessThan(hints.evidence);
    expect(solutions.sufficient).toBe(false);
  });

  it("does not count repeated attempts on one question as broad evidence", () => {
    const repeated = Array.from({ length: 8 }, (_, i) => attempt(i + 1, 42));
    const result = computeSubtopicMastery(1, repeated);
    expect(result.attempts).toBe(8);
    expect(result.distinctQuestions).toBe(1);
    expect(result.sufficient).toBe(false);
    expect(result.reason).toContain("distinct questions");
  });

  it("excludes skipped attempts from evidence", () => {
    const attempts = [...set(6), attempt(7, 7, { correctness: "skipped" })];
    const result = computeSubtopicMastery(1, attempts);
    expect(result.attempts).toBe(7);
    expect(result.sufficient).toBe(true);
    expect(result.mastery).toBe(100);
  });

  it("decays evidence for stale attempts", () => {
    const fresh = computeSubtopicMastery(1, set(6));
    const stale = computeSubtopicMastery(
      1,
      set(6).map((a) => ({
        ...a,
        createdAt: new Date(NOW - 365 * 86_400_000).toISOString(),
      })),
    );
    expect(stale.evidence).toBeLessThan(fresh.evidence);
    expect(stale.sufficient).toBe(false);
  });

  it("withholds chapter mastery below the coverage gate", () => {
    const masteryById = new Map([
      [1, computeSubtopicMastery(1, set(6))],
    ]);
    const chapter = computeChapterMastery(
      1,
      [
        { id: 1, weight: 1 },
        { id: 2, weight: 1 },
        { id: 3, weight: 1 },
      ],
      masteryById,
    );
    expect(chapter.mastery).toBeNull();
    expect(chapter.sufficient).toBe(false);
    expect(chapter.coverage).toBeCloseTo(1 / 3, 3);
  });

  it("shows a partial chapter estimate at 50% coverage", () => {
    const masteryById = new Map([
      [1, computeSubtopicMastery(1, set(6))],
      [2, computeSubtopicMastery(2, set(6))],
    ]);
    const chapter = computeChapterMastery(
      1,
      [
        { id: 1, weight: 1 },
        { id: 2, weight: 1 },
        { id: 3, weight: 1 },
      ],
      masteryById,
    );
    expect(chapter.mastery).toBe(100);
    expect(chapter.sufficient).toBe(true);
    expect(chapter.reason).toContain("Partial coverage");
  });
});
