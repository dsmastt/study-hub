import { Router } from "express";
import { z } from "zod";
import type { MasteryBreakdown } from "../../shared/types.ts";
import { getDb, nowIso, rowToAttempt } from "../db.ts";
import { computeSubtopicMastery, type MasteryAttemptInput } from "../mastery.ts";
import { getActiveSession } from "../services/sessions.ts";
import { insertMasterySnapshot, invalidateMasteryCache } from "../services/masteryService.ts";
import { HttpError } from "../http.ts";

export const attemptsRouter = Router();

const createAttemptSchema = z.object({
  questionId: z.number().int().positive(),
  sessionId: z.number().int().positive().nullable().optional(),
  answer: z.string().max(20_000).optional(),
  correctness: z.enum(["correct", "partial", "incorrect", "skipped"]),
  confidence: z.enum(["low", "medium", "high"]).nullable().optional(),
  mistakeType: z
    .enum(["concept", "calculation", "silly", "misread", "time", "guess", "other"])
    .nullable()
    .optional(),
  hintsUsed: z.number().int().min(0).max(20).optional(),
  solutionViewed: z.boolean().optional(),
  timeSpentSeconds: z.number().int().min(0).max(86_400).optional(),
});

function computeForSubtopic(subtopicId: number): MasteryBreakdown {
  const rows = getDb()
    .prepare(
      `SELECT a.*, COALESCE(a.difficulty, q.difficulty) AS difficulty FROM attempts a
       JOIN questions q ON q.id = a.question_id
       WHERE a.subtopic_id = ? ORDER BY a.created_at ASC, a.id ASC`,
    )
    .all(subtopicId) as Record<string, unknown>[];
  const attempts: MasteryAttemptInput[] = rows.map((row) => ({
    id: Number(row.id),
    questionId: Number(row.question_id),
    correctness: String(row.correctness) as MasteryAttemptInput["correctness"],
    difficulty: String(row.difficulty) as MasteryAttemptInput["difficulty"],
    hintsUsed: Number(row.hints_used),
    solutionViewed: Number(row.solution_viewed) === 1,
    createdAt: String(row.created_at),
    mistakeType: row.mistake_type === null ? null : String(row.mistake_type),
  }));
  return computeSubtopicMastery(subtopicId, attempts);
}

attemptsRouter.post("/", (req, res) => {
  const input = createAttemptSchema.parse(req.body);
  const question = getDb()
    .prepare("SELECT id, subtopic_id, chapter_id, difficulty FROM questions WHERE id = ?")
    .get(input.questionId) as
    | { id: number; subtopic_id: number | null; chapter_id: number | null; difficulty: string }
    | undefined;
  if (!question) throw new HttpError("Question not found.", 404);
  if (!question.subtopic_id) {
    throw new HttpError(
      "This question has no subtopic classification. Edit the question and assign a subtopic before attempting it, so the evidence can be attributed.",
      400,
    );
  }
  const sessionId = input.sessionId ?? getActiveSession()?.id ?? null;
  if (sessionId !== null) {
    const session = getDb().prepare("SELECT id, status FROM sessions WHERE id = ?").get(sessionId) as
      | { id: number; status: string }
      | undefined;
    if (!session) throw new HttpError("Session not found.", 404);
    if (session.status !== "active") throw new HttpError("Cannot attach an attempt to an ended session.", 400);
  }
  const result = getDb()
    .prepare(
      `INSERT INTO attempts (question_id, session_id, subtopic_id, answer, correctness, difficulty,
        confidence, mistake_type, hints_used, solution_viewed, time_spent_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.questionId,
      sessionId,
      question.subtopic_id,
      input.answer ?? "",
      input.correctness,
      question.difficulty,
      input.confidence ?? null,
      input.mistakeType ?? null,
      input.hintsUsed ?? 0,
      input.solutionViewed ? 1 : 0,
      input.timeSpentSeconds ?? 0,
      nowIso(),
    );
  const attemptId = Number(result.lastInsertRowid);
  invalidateMasteryCache();
  const breakdown = computeForSubtopic(question.subtopic_id);
  insertMasterySnapshot(question.subtopic_id, breakdown);
  const row = getDb()
    .prepare(
      `SELECT a.*, COALESCE(a.difficulty, q.difficulty) AS difficulty, q.prompt AS question_prompt,
         st.name AS subtopic_name, c.name AS chapter_name, s.name AS subject_name
       FROM attempts a JOIN questions q ON q.id = a.question_id
       LEFT JOIN subtopics st ON st.id = a.subtopic_id
       LEFT JOIN chapters c ON c.id = q.chapter_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       WHERE a.id = ?`,
    )
    .get(attemptId) as Record<string, unknown>;
  res.status(201).json({ attempt: rowToAttempt(row), mastery: breakdown });
});

const listAttemptsSchema = z.object({
  subtopicId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  questionId: z.coerce.number().int().positive().optional(),
  sessionId: z.coerce.number().int().positive().optional(),
  correctness: z.enum(["correct", "partial", "incorrect", "skipped"]).optional(),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

attemptsRouter.get("/", (req, res) => {
  const query = listAttemptsSchema.parse(req.query);
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (query.subtopicId) {
    conditions.push("a.subtopic_id = ?");
    params.push(query.subtopicId);
  }
  if (query.chapterId) {
    conditions.push("q.chapter_id = ?");
    params.push(query.chapterId);
  }
  if (query.questionId) {
    conditions.push("a.question_id = ?");
    params.push(query.questionId);
  }
  if (query.sessionId) {
    conditions.push("a.session_id = ?");
    params.push(query.sessionId);
  }
  if (query.correctness) {
    conditions.push("a.correctness = ?");
    params.push(query.correctness);
  }
  if (query.since) {
    conditions.push("a.created_at >= ?");
    params.push(query.since);
  }
  const rows = getDb()
    .prepare(
      `SELECT a.*, COALESCE(a.difficulty, q.difficulty) AS difficulty, q.prompt AS question_prompt,
         st.name AS subtopic_name, c.name AS chapter_name, s.name AS subject_name
       FROM attempts a JOIN questions q ON q.id = a.question_id
       LEFT JOIN subtopics st ON st.id = a.subtopic_id
       LEFT JOIN chapters c ON c.id = q.chapter_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    )
    .all(...params, query.limit) as Record<string, unknown>[];
  res.json(rows.map(rowToAttempt));
});
