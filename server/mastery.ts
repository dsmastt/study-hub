import type {
  Correctness,
  Difficulty,
  MasteryBreakdown,
  ChapterMastery,
  Subtopic,
} from "../shared/types.ts";

export interface MasteryAttemptInput {
  id: number;
  questionId: number;
  correctness: Correctness;
  difficulty: Difficulty;
  hintsUsed: number;
  solutionViewed: boolean;
  createdAt: string;
  mistakeType: string | null;
}

export const MASTERY_RULES = {
  minAttempts: 5,
  minDistinctQuestions: 4,
  minEvidence: 3.5,
  minChallengingEvidence: 1.5,
  recencyHalfLifeDays: 90,
  repetitionDecay: 0.4,
  repetitionFloor: 0.12,
  hintPenalty: 0.4,
  solutionPenalty: 0.25,
  chapterCoverageGate: 0.5,
} as const;

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 0.75,
  medium: 1,
  hard: 1.3,
};

const CORRECTNESS_SCORE: Record<Correctness, number> = {
  correct: 1,
  partial: 0.5,
  incorrect: 0,
  skipped: 0,
};

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function attemptEvidenceWeight(
  attempt: MasteryAttemptInput,
  repetitionIndex: number,
  now = Date.now(),
): number {
  const ageDays = Math.max(0, (now - new Date(attempt.createdAt).getTime()) / 86_400_000);
  const recency = Math.max(0.05, Math.pow(0.5, ageDays / MASTERY_RULES.recencyHalfLifeDays));
  const difficulty = DIFFICULTY_WEIGHT[attempt.difficulty] ?? 1;
  const hintFactor = 1 / (1 + MASTERY_RULES.hintPenalty * Math.max(0, attempt.hintsUsed));
  const solutionFactor = attempt.solutionViewed ? MASTERY_RULES.solutionPenalty : 1;
  const repetition =
    repetitionIndex <= 1
      ? 1
      : Math.max(
          MASTERY_RULES.repetitionFloor,
          Math.pow(MASTERY_RULES.repetitionDecay, repetitionIndex - 1),
        );
  return difficulty * hintFactor * solutionFactor * repetition * recency;
}

export function computeSubtopicMastery(
  subtopicId: number,
  attempts: MasteryAttemptInput[],
  now = Date.now(),
): MasteryBreakdown {
  const ordered = [...attempts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const repetitionCount = new Map<number, number>();
  const mistakes = new Map<string, number>();
  let evidence = 0;
  let challengingEvidence = 0;
  let weightedScore = 0;
  let attemptedCount = 0;
  let skippedCount = 0;
  const attemptedRows: MasteryAttemptInput[] = [];

  for (const attempt of ordered) {
    if (attempt.mistakeType) {
      mistakes.set(attempt.mistakeType, (mistakes.get(attempt.mistakeType) ?? 0) + 1);
    }
    if (attempt.correctness === "skipped") {
      skippedCount += 1;
      continue;
    }
    attemptedCount += 1;
    attemptedRows.push(attempt);
    const index = (repetitionCount.get(attempt.questionId) ?? 0) + 1;
    repetitionCount.set(attempt.questionId, index);
    const weight = attemptEvidenceWeight(attempt, index, now);
    evidence += weight;
    if (attempt.difficulty === "medium" || attempt.difficulty === "hard") {
      challengingEvidence += weight;
    }
    weightedScore += CORRECTNESS_SCORE[attempt.correctness] * weight;
  }

  const distinctQuestions = repetitionCount.size;
  const weightedCorrectness = evidence > 0 ? weightedScore / evidence : null;
  const recent = attemptedRows.slice(-6);
  const recentAccuracy =
    recent.length > 0
      ? recent.reduce((sum, attempt) => sum + CORRECTNESS_SCORE[attempt.correctness], 0) / recent.length
      : null;
  const lastAttemptAt = ordered.length > 0 ? ordered[ordered.length - 1].createdAt : null;
  const confidence = evidence > 0 ? 1 - Math.exp(-evidence / 6) : 0;

  const reasons: string[] = [];
  if (attemptedCount < MASTERY_RULES.minAttempts) {
    reasons.push(`only ${attemptedCount}/${MASTERY_RULES.minAttempts} attempts`);
  }
  if (distinctQuestions < MASTERY_RULES.minDistinctQuestions) {
    reasons.push(
      `only ${distinctQuestions}/${MASTERY_RULES.minDistinctQuestions} distinct questions (repeats count less)`,
    );
  }
  if (evidence < MASTERY_RULES.minEvidence) {
    reasons.push(`effective evidence ${round(evidence, 2)}/${MASTERY_RULES.minEvidence}`);
  }
  if (challengingEvidence < MASTERY_RULES.minChallengingEvidence) {
    reasons.push(
      `challenging evidence ${round(challengingEvidence, 2)}/${MASTERY_RULES.minChallengingEvidence} (attempt medium/hard questions)`,
    );
  }
  const sufficient = reasons.length === 0;

  return {
    subtopicId,
    attempts: ordered.length,
    distinctQuestions,
    evidence: round(evidence, 3),
    confidence: round(confidence, 4),
    mastery: sufficient && weightedCorrectness !== null ? round(weightedCorrectness * 100, 1) : null,
    sufficient,
    reason:
      sufficient
        ? null
        : `${reasons.join("; ")}${skippedCount > 0 ? `; ${skippedCount} skipped attempt(s) excluded` : ""}`,
    weightedCorrectness: weightedCorrectness === null ? null : round(weightedCorrectness, 4),
    recentAccuracy: recentAccuracy === null ? null : round(recentAccuracy, 4),
    lastAttemptAt,
    mistakes: [...mistakes.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function computeChapterMastery(
  chapterId: number,
  subtopics: Pick<Subtopic, "id" | "weight">[],
  masteryById: Map<number, MasteryBreakdown>,
): ChapterMastery {
  const totalWeight = subtopics.reduce((sum, subtopic) => sum + Math.max(0.01, subtopic.weight), 0);
  let measuredWeight = 0;
  let weightedMastery = 0;
  let evidence = 0;
  let attempts = 0;
  let confidenceWeighted = 0;
  let measuredCount = 0;

  for (const subtopic of subtopics) {
    const mastery = masteryById.get(subtopic.id);
    if (!mastery) continue;
    evidence += mastery.evidence;
    attempts += mastery.attempts;
    if (mastery.sufficient && mastery.mastery !== null) {
      const weight = Math.max(0.01, subtopic.weight);
      measuredWeight += weight;
      weightedMastery += mastery.mastery * weight;
      confidenceWeighted += mastery.confidence * weight;
      measuredCount += 1;
    }
  }

  const coverage = totalWeight > 0 ? measuredWeight / totalWeight : 0;
  const confidence = measuredWeight > 0 ? confidenceWeighted / measuredWeight : 0;
  const sufficient = coverage >= MASTERY_RULES.chapterCoverageGate;
  const mastery = sufficient && measuredWeight > 0 ? round(weightedMastery / measuredWeight, 1) : null;
  const percent = Math.round(coverage * 100);

  return {
    chapterId,
    mastery,
    subtopicsMeasured: measuredCount,
    subtopicsTotal: subtopics.length,
    coverage: round(coverage, 4),
    evidence: round(evidence, 3),
    confidence: round(confidence, 4),
    sufficient,
    reason: sufficient
      ? percent < 100
        ? `Partial coverage: ${percent}% of subtopic weight has sufficient evidence.`
        : null
      : measuredCount === 0
        ? "No subtopic has enough evidence for a mastery estimate yet."
        : `Only ${percent}% of subtopic weight has sufficient evidence; chapter estimate withheld.`,
  };
}
