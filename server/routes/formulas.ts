import { Router } from "express";
import { z } from "zod";
import type { FormulaReviewResult } from "../../shared/types.ts";
import { getDb } from "../db.ts";
import {
  createFormula,
  deleteFormula,
  formulaTree,
  getFormula,
  listFormulaFlashcards,
  listFormulas,
  reviewFormula,
  updateFormula,
} from "../services/formulas.ts";
import { HttpError, parseId } from "../http.ts";

export const formulasRouter = Router();

formulasRouter.get("/tree", (_req, res) => {
  res.json(formulaTree());
});

const flashcardsSchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

formulasRouter.get("/flashcards", (req, res) => {
  const query = flashcardsSchema.parse(req.query);
  res.json(listFormulaFlashcards(query));
});

const listSchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  subtopicId: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(300),
});

formulasRouter.get("/", (req, res) => {
  const query = listSchema.parse(req.query);
  res.json(listFormulas(query));
});

formulasRouter.get("/:id", (req, res) => {
  const id = parseId(req.params.id, "formula id");
  const formula = getFormula(id);
  if (!formula) throw new HttpError("Formula not found.", 404);
  res.json(formula);
});

const tagsSchema = z.array(z.string().trim().min(1).max(60)).max(20).optional();

const createSchema = z
  .object({
    subjectId: z.number().int().positive().nullable().optional(),
    chapterId: z.number().int().positive().nullable().optional(),
    subtopicId: z.number().int().positive().nullable().optional(),
    title: z.string().trim().min(1).max(200),
    expression: z.string().trim().min(1).max(10_000),
    notes: z.string().max(10_000).optional(),
    tags: tagsSchema,
  })
  .strict();

function resolveScope(input: {
  subjectId?: number | null;
  chapterId?: number | null;
  subtopicId?: number | null;
}): { subjectId: number; chapterId: number | null; subtopicId: number | null } {
  if (input.subtopicId) {
    const row = getDb()
      .prepare(
        `SELECT st.id, st.chapter_id, c.subject_id
         FROM subtopics st JOIN chapters c ON c.id = st.chapter_id WHERE st.id = ?`,
      )
      .get(input.subtopicId) as { id: number; chapter_id: number; subject_id: number } | undefined;
    if (!row) throw new HttpError("Subtopic not found.", 404);
    if (input.chapterId && input.chapterId !== row.chapter_id) {
      throw new HttpError("The selected subtopic does not belong to the selected chapter.", 400);
    }
    if (input.subjectId && input.subjectId !== row.subject_id) {
      throw new HttpError("The selected subtopic does not belong to the selected subject.", 400);
    }
    return { subjectId: row.subject_id, chapterId: row.chapter_id, subtopicId: row.id };
  }
  if (input.chapterId) {
    const row = getDb()
      .prepare("SELECT id, subject_id FROM chapters WHERE id = ?")
      .get(input.chapterId) as { id: number; subject_id: number } | undefined;
    if (!row) throw new HttpError("Chapter not found.", 404);
    if (input.subjectId && input.subjectId !== row.subject_id) {
      throw new HttpError("The selected chapter does not belong to the selected subject.", 400);
    }
    return { subjectId: row.subject_id, chapterId: row.id, subtopicId: null };
  }
  if (!input.subjectId) throw new HttpError("Choose a subject, chapter or subtopic.", 400);
  const subject = getDb().prepare("SELECT id FROM subjects WHERE id = ?").get(input.subjectId);
  if (!subject) throw new HttpError("Subject not found.", 404);
  return { subjectId: input.subjectId, chapterId: null, subtopicId: null };
}

formulasRouter.post("/", (req, res) => {
  const input = createSchema.parse(req.body);
  const scope = resolveScope(input);
  const formula = createFormula({
    ...scope,
    title: input.title,
    expression: input.expression,
    notes: input.notes,
    tags: input.tags,
  });
  res.status(201).json(formula);
});

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    expression: z.string().trim().min(1).max(10_000).optional(),
    notes: z.string().max(10_000).optional(),
    tags: tagsSchema,
  })
  .strict();

formulasRouter.patch("/:id", (req, res) => {
  const id = parseId(req.params.id, "formula id");
  const input = updateSchema.parse(req.body);
  if (Object.keys(input).length === 0) throw new HttpError("No changes provided.", 400);
  if (!getFormula(id)) throw new HttpError("Formula not found.", 404);
  res.json(updateFormula(id, input));
});

formulasRouter.delete("/:id", (req, res) => {
  const id = parseId(req.params.id, "formula id");
  if (!deleteFormula(id)) throw new HttpError("Formula not found.", 404);
  res.json({ ok: true });
});

const reviewSchema = z.object({ result: z.enum(["got_it", "missed"]) }).strict();

formulasRouter.post("/:id/review", (req, res) => {
  const id = parseId(req.params.id, "formula id");
  const input = reviewSchema.parse(req.body);
  if (!getFormula(id)) throw new HttpError("Formula not found.", 404);
  res.json(reviewFormula(id, input.result as FormulaReviewResult));
});
