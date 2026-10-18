import type {
  Attempt,
  Chapter,
  ChapterMastery,
  MasteryBreakdown,
  Subject,
  Subtopic,
} from "../../shared/types.ts";
import { getDb, rowToAttempt, rowToChapter, rowToSubject, rowToSubtopic } from "../db.ts";
import {
  computeChapterMastery,
  computeSubtopicMastery,
  type MasteryAttemptInput,
} from "../mastery.ts";

export interface SubtopicWithContext extends Subtopic {
  chapterId: number;
  chapterName: string;
  subjectId: number;
  subjectName: string;
}

export interface SubjectAggregate {
  subjectId: number;
  mastery: number | null;
  coverage: number;
  measuredSubtopics: number;
  totalSubtopics: number;
  evidence: number;
  confidence: number;
  sufficient: boolean;
  reason: string | null;
}

export interface MasteryContext {
  subjects: Subject[];
  chapters: Chapter[];
  subtopics: SubtopicWithContext[];
  bySubtopic: Map<number, MasteryBreakdown>;
  chapterMastery: Map<number, ChapterMastery>;
  subjectAggregates: Map<number, SubjectAggregate>;
  attemptsBySubtopic: Map<number, MasteryAttemptInput[]>;
}

interface AttemptWithDifficultyRow extends Record<string, unknown> {
  difficulty?: string;
}

const CACHE_TTL_MS = 30_000;
let cachedContext: { context: MasteryContext; expiresAt: number } | null = null;

export function invalidateMasteryCache(): void {
  cachedContext = null;
}

export function loadMasteryContext(now = Date.now()): MasteryContext {
  if (cachedContext && cachedContext.expiresAt > Date.now()) {
    return cachedContext.context;
  }
  const db = getDb();
  const subjects = (db.prepare("SELECT * FROM subjects ORDER BY order_index, name").all() as Record<string, unknown>[]).map(
    rowToSubject,
  );
  const chapters = (
    db
      .prepare(
        `SELECT c.*, s.name AS subject_name, s.code AS subject_code,
           (SELECT COUNT(*) FROM subtopics st WHERE st.chapter_id = c.id) AS subtopic_count
         FROM chapters c JOIN subjects s ON s.id = c.subject_id
         ORDER BY s.order_index, c.order_index, c.name`,
      )
      .all() as Record<string, unknown>[]
  ).map(rowToChapter);
  const subtopics = (
    db
      .prepare(
        `SELECT st.*, c.name AS chapter_name, c.subject_id, s.name AS subject_name
         FROM subtopics st
         JOIN chapters c ON c.id = st.chapter_id
         JOIN subjects s ON s.id = c.subject_id
         ORDER BY s.order_index, c.order_index, st.order_index`,
      )
      .all() as Record<string, unknown>[]
  ).map((row) => ({
    ...rowToSubtopic(row),
    chapterName: String(row.chapter_name),
    subjectId: Number(row.subject_id),
    subjectName: String(row.subject_name),
  }));

  const attemptRows = db
    .prepare(
      `SELECT a.*, COALESCE(a.difficulty, q.difficulty) AS difficulty
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.subtopic_id IS NOT NULL
       ORDER BY a.created_at ASC, a.id ASC`,
    )
    .all() as AttemptWithDifficultyRow[];

  const attemptsBySubtopic = new Map<number, MasteryAttemptInput[]>();
  for (const row of attemptRows) {
    const subtopicId = Number(row.subtopic_id);
    const attempt: MasteryAttemptInput = {
      id: Number(row.id),
      questionId: Number(row.question_id),
      correctness: String(row.correctness) as MasteryAttemptInput["correctness"],
      difficulty: (String(row.difficulty ?? "medium") as MasteryAttemptInput["difficulty"]) ?? "medium",
      hintsUsed: Number(row.hints_used ?? 0),
      solutionViewed: Number(row.solution_viewed ?? 0) === 1,
      createdAt: String(row.created_at),
      mistakeType: row.mistake_type === null ? null : String(row.mistake_type),
    };
    const list = attemptsBySubtopic.get(subtopicId) ?? [];
    list.push(attempt);
    attemptsBySubtopic.set(subtopicId, list);
  }

  const bySubtopic = new Map<number, MasteryBreakdown>();
  for (const subtopic of subtopics) {
    const breakdown = computeSubtopicMastery(
      subtopic.id,
      attemptsBySubtopic.get(subtopic.id) ?? [],
      now,
    );
    bySubtopic.set(subtopic.id, {
      ...breakdown,
      subtopicName: subtopic.name,
      chapterId: subtopic.chapterId,
      chapterName: subtopic.chapterName,
    });
  }

  const chapterMastery = new Map<number, ChapterMastery>();
  for (const chapter of chapters) {
    const chapterSubtopics = subtopics.filter((subtopic) => subtopic.chapterId === chapter.id);
    chapterMastery.set(
      chapter.id,
      computeChapterMastery(chapter.id, chapterSubtopics, bySubtopic),
    );
  }

  const subjectAggregates = new Map<number, SubjectAggregate>();
  for (const subject of subjects) {
    const subjectSubtopics = subtopics.filter((subtopic) => subtopic.subjectId === subject.id);
    const aggregate = computeChapterMastery(subject.id, subjectSubtopics, bySubtopic);
    const subjectChapters = chapters.filter((chapter) => chapter.subjectId === subject.id);
    const measured = subjectSubtopics.filter((subtopic) => bySubtopic.get(subtopic.id)?.sufficient).length;
    subjectAggregates.set(subject.id, {
      subjectId: subject.id,
      mastery: aggregate.mastery,
      coverage: aggregate.coverage,
      measuredSubtopics: measured,
      totalSubtopics: subjectSubtopics.length,
      evidence: aggregate.evidence,
      confidence: aggregate.confidence,
      sufficient: aggregate.sufficient,
      reason:
        aggregate.mastery === null
          ? aggregate.reason
          : aggregate.coverage < 1
            ? `Partial coverage across ${measured}/${subjectSubtopics.length} subtopics; ${subjectChapters.length} chapters tracked.`
            : null,
    });
  }

  const context: MasteryContext = {
    subjects,
    chapters,
    subtopics,
    bySubtopic,
    chapterMastery,
    subjectAggregates,
    attemptsBySubtopic,
  };
  cachedContext = { context, expiresAt: Date.now() + CACHE_TTL_MS };
  return context;
}

export function insertMasterySnapshot(subtopicId: number, breakdown: MasteryBreakdown): void {
  getDb()
    .prepare(
      `INSERT INTO progress_snapshots (subtopic_id, mastery, evidence, confidence, attempts_count, computed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      subtopicId,
      breakdown.mastery,
      breakdown.evidence,
      breakdown.confidence,
      breakdown.attempts,
      new Date().toISOString(),
    );
}

export function getRecentAttempts(
  options: {
    limit?: number;
    subtopicId?: number;
    chapterId?: number;
    questionId?: number;
    correctness?: string;
    sessionId?: number;
    since?: string;
  } = {},
): Attempt[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (options.subtopicId) {
    conditions.push("a.subtopic_id = ?");
    params.push(options.subtopicId);
  }
  if (options.chapterId) {
    conditions.push("q.chapter_id = ?");
    params.push(options.chapterId);
  }
  if (options.questionId) {
    conditions.push("a.question_id = ?");
    params.push(options.questionId);
  }
  if (options.correctness) {
    conditions.push("a.correctness = ?");
    params.push(options.correctness);
  }
  if (options.sessionId) {
    conditions.push("a.session_id = ?");
    params.push(options.sessionId);
  }
  if (options.since) {
    conditions.push("a.created_at >= ?");
    params.push(options.since);
  }
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);
  params.push(limit);
  const sql = `SELECT a.*, COALESCE(a.difficulty, q.difficulty) AS difficulty, q.prompt AS question_prompt,
      st.name AS subtopic_name, c.name AS chapter_name, s.name AS subject_name
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    LEFT JOIN subtopics st ON st.id = a.subtopic_id
    LEFT JOIN chapters c ON c.id = q.chapter_id
    LEFT JOIN subjects s ON s.id = q.subject_id
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ?`;
  return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToAttempt);
}
