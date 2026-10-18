import { Router } from "express";
import { z } from "zod";
import { getDb, nowIso, rowToQuestion } from "../db.ts";
import { getRecentAttempts } from "../services/masteryService.ts";
import { HttpError, parseId } from "../http.ts";

export const questionsRouter = Router();

const listQuerySchema = z.object({
  questionId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  subtopicId: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  status: z.enum(["draft", "needs_review", "approved", "archived"]).optional(),
  sourceType: z.enum(["manual", "uploaded", "generated"]).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

questionsRouter.get("/", (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (query.status) {
    conditions.push("q.status = ?");
    params.push(query.status);
  } else {
    conditions.push("q.status != 'archived'");
  }
  if (query.questionId) {
    conditions.push("q.id = ?");
    params.push(query.questionId);
  }
  if (query.subjectId) {
    conditions.push("q.subject_id = ?");
    params.push(query.subjectId);
  }
  if (query.chapterId) {
    conditions.push("q.chapter_id = ?");
    params.push(query.chapterId);
  }
  if (query.subtopicId) {
    conditions.push("q.subtopic_id = ?");
    params.push(query.subtopicId);
  }
  if (query.difficulty) {
    conditions.push("q.difficulty = ?");
    params.push(query.difficulty);
  }
  if (query.sourceType) {
    conditions.push("q.source_type = ?");
    params.push(query.sourceType);
  }
  if (query.search) {
    conditions.push("q.prompt LIKE ?");
    params.push(`%${query.search}%`);
  }
  const rows = getDb()
    .prepare(
      `SELECT q.id, q.subject_id, q.chapter_id, q.subtopic_id, q.source_type, q.source_ref,
         q.prompt, NULL AS options_json, q.answer, '' AS solution, q.question_type, q.difficulty,
         q.marks, q.status, q.flags_json, q.created_at, q.updated_at,
         s.name AS subject_name, c.name AS chapter_name, st.name AS subtopic_name,
         (SELECT COUNT(*) FROM attempts a WHERE a.question_id = q.id) AS attempt_count,
         (SELECT a.created_at FROM attempts a WHERE a.question_id = q.id ORDER BY a.created_at DESC LIMIT 1) AS last_attempt_at,
         (SELECT a.correctness FROM attempts a WHERE a.question_id = q.id ORDER BY a.created_at DESC LIMIT 1) AS last_correctness
       FROM questions q
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN chapters c ON c.id = q.chapter_id
       LEFT JOIN subtopics st ON st.id = q.subtopic_id
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY
         CASE q.status WHEN 'needs_review' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
         q.updated_at DESC, q.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.limit, query.offset) as Record<string, unknown>[];
  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) AS count FROM questions q ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}`)
      .get(...params) as { count: number }
  ).count;
  res.json({ questions: rows.map(rowToQuestion), total });
});

questionsRouter.get("/:id", (req, res) => {
  const id = parseId(req.params.id, "question id");
  const row = getDb()
    .prepare(
      `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, st.name AS subtopic_name
       FROM questions q
       LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN chapters c ON c.id = q.chapter_id
       LEFT JOIN subtopics st ON st.id = q.subtopic_id
       WHERE q.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new HttpError("Question not found.", 404);
  const question = rowToQuestion(row);
  const attempts = getRecentAttempts({ questionId: id, limit: 30 });
  res.json({ question, attempts });
});

const createQuestionSchema = z.object({
  subjectId: z.number().int().positive(),
  chapterId: z.number().int().positive().nullable().optional(),
  subtopicId: z.number().int().positive().nullable().optional(),
  prompt: z.string().trim().min(3).max(20_000),
  options: z.array(z.string().max(4000)).max(8).nullable().optional(),
  answer: z.string().max(20_000).optional(),
  solution: z.string().max(30_000).optional(),
  questionType: z.enum(["mcq", "numeric", "short", "long"]).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  marks: z.number().min(0).max(1000).nullable().optional(),
  status: z.enum(["draft", "needs_review", "approved"]).optional(),
  flags: z.array(z.string().max(300)).max(20).optional(),
  sourceType: z.enum(["manual", "uploaded", "generated"]).optional(),
  sourceRef: z.string().max(1000).nullable().optional(),
});

questionsRouter.post("/", (req, res) => {
  const input = createQuestionSchema.parse(req.body);
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO questions (subject_id, chapter_id, subtopic_id, source_type, source_ref, prompt,
        options_json, answer, solution, question_type, difficulty, marks, status, flags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.subjectId,
      input.chapterId ?? null,
      input.subtopicId ?? null,
      input.sourceType ?? "manual",
      input.sourceRef ?? null,
      input.prompt,
      input.options ? JSON.stringify(input.options) : null,
      input.answer ?? "",
      input.solution ?? "",
      input.questionType ?? "mcq",
      input.difficulty ?? "medium",
      input.marks ?? null,
      input.status ?? "approved",
      JSON.stringify(input.flags ?? []),
      now,
      now,
    );
  const row = getDb()
    .prepare(
      `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, st.name AS subtopic_name
       FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN chapters c ON c.id = q.chapter_id LEFT JOIN subtopics st ON st.id = q.subtopic_id
       WHERE q.id = ?`,
    )
    .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  res.status(201).json(rowToQuestion(row));
});

const updateQuestionSchema = z
  .object({
    subjectId: z.number().int().positive().optional(),
    chapterId: z.number().int().positive().nullable().optional(),
    subtopicId: z.number().int().positive().nullable().optional(),
    prompt: z.string().trim().min(3).max(20_000).optional(),
    options: z.array(z.string().max(4000)).max(8).nullable().optional(),
    answer: z.string().max(20_000).optional(),
    solution: z.string().max(30_000).optional(),
    questionType: z.enum(["mcq", "numeric", "short", "long"]).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    marks: z.number().min(0).max(1000).nullable().optional(),
    status: z.enum(["draft", "needs_review", "approved", "archived"]).optional(),
    flags: z.array(z.string().max(300)).max(20).optional(),
    sourceRef: z.string().max(1000).nullable().optional(),
  })
  .strict();

questionsRouter.patch("/:id", (req, res) => {
  const id = parseId(req.params.id, "question id");
  const input = updateQuestionSchema.parse(req.body);
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  const set = (column: string, value: string | number | null) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };
  if (input.subjectId !== undefined) set("subject_id", input.subjectId);
  if (input.chapterId !== undefined) set("chapter_id", input.chapterId);
  if (input.subtopicId !== undefined) set("subtopic_id", input.subtopicId);
  if (input.prompt !== undefined) set("prompt", input.prompt);
  if (input.options !== undefined) set("options_json", input.options ? JSON.stringify(input.options) : null);
  if (input.answer !== undefined) set("answer", input.answer);
  if (input.solution !== undefined) set("solution", input.solution);
  if (input.questionType !== undefined) set("question_type", input.questionType);
  if (input.difficulty !== undefined) set("difficulty", input.difficulty);
  if (input.marks !== undefined) set("marks", input.marks);
  if (input.status !== undefined) set("status", input.status);
  if (input.flags !== undefined) set("flags_json", JSON.stringify(input.flags));
  if (input.sourceRef !== undefined) set("source_ref", input.sourceRef);
  if (fields.length === 0) throw new HttpError("No changes provided.", 400);
  set("updated_at", nowIso());
  params.push(id);
  const result = getDb().prepare(`UPDATE questions SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  if (Number(result.changes) === 0) throw new HttpError("Question not found.", 404);
  const row = getDb()
    .prepare(
      `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, st.name AS subtopic_name
       FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id
       LEFT JOIN chapters c ON c.id = q.chapter_id LEFT JOIN subtopics st ON st.id = q.subtopic_id
       WHERE q.id = ?`,
    )
    .get(id) as Record<string, unknown>;
  res.json(rowToQuestion(row));
});


