import type {
  Formula,
  FormulaReviewResult,
  FormulaTreeData,
  FormulaTreeChapter,
  FormulaTreeSubject,
  FormulaTreeSubtopic,
} from "../../shared/types.ts";
import { getDb, nowIso, parseJson } from "../db.ts";

const FORMULA_SELECT = `SELECT f.*, s.name AS subject_name, c.name AS chapter_name, st.name AS subtopic_name,
    COALESCE(r.review_count, 0) AS review_count,
    COALESCE(r.got_it_count, 0) AS got_it_count,
    COALESCE(r.missed_count, 0) AS missed_count,
    r.last_reviewed_at AS last_reviewed_at
  FROM formulas f
  LEFT JOIN subjects s ON s.id = f.subject_id
  LEFT JOIN chapters c ON c.id = f.chapter_id
  LEFT JOIN subtopics st ON st.id = f.subtopic_id
  LEFT JOIN (
    SELECT formula_id,
      COUNT(*) AS review_count,
      SUM(CASE WHEN result = 'got_it' THEN 1 ELSE 0 END) AS got_it_count,
      SUM(CASE WHEN result = 'missed' THEN 1 ELSE 0 END) AS missed_count,
      MAX(reviewed_at) AS last_reviewed_at
    FROM formula_reviews
    GROUP BY formula_id
  ) r ON r.formula_id = f.id`;

function rowToFormula(row: Record<string, unknown>): Formula {
  return {
    id: Number(row.id),
    subjectId: Number(row.subject_id),
    chapterId: row.chapter_id === null ? null : Number(row.chapter_id),
    subtopicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
    subjectName: row.subject_name === null ? null : String(row.subject_name),
    chapterName: row.chapter_name === null ? null : String(row.chapter_name),
    subtopicName: row.subtopic_name === null ? null : String(row.subtopic_name),
    title: String(row.title),
    expression: String(row.expression),
    notes: String(row.notes ?? ""),
    tags: parseJson<string[]>(row.tags_json, []),
    source: String(row.source) === "seed" ? "seed" : "user",
    reviewCount: Number(row.review_count ?? 0),
    gotItCount: Number(row.got_it_count ?? 0),
    missedCount: Number(row.missed_count ?? 0),
    lastReviewedAt: row.last_reviewed_at === null || row.last_reviewed_at === undefined ? null : String(row.last_reviewed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export interface FormulaFilters {
  subjectId?: number;
  chapterId?: number;
  subtopicId?: number;
  search?: string;
  limit?: number;
}

export function listFormulas(filters: FormulaFilters = {}): Formula[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.subjectId) {
    conditions.push("f.subject_id = ?");
    params.push(filters.subjectId);
  }
  if (filters.chapterId) {
    conditions.push("f.chapter_id = ?");
    params.push(filters.chapterId);
  }
  if (filters.subtopicId) {
    conditions.push("f.subtopic_id = ?");
    params.push(filters.subtopicId);
  }
  if (filters.search) {
    conditions.push("(f.title LIKE ? OR f.expression LIKE ? OR f.notes LIKE ? OR f.tags_json LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  params.push(Math.min(Math.max(filters.limit ?? 300, 1), 500));
  return (
    getDb()
      .prepare(
        `${FORMULA_SELECT}
         ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY f.subject_id, f.chapter_id, f.subtopic_id, f.title
         LIMIT ?`,
      )
      .all(...params) as Record<string, unknown>[]
  ).map(rowToFormula);
}

export function getFormula(id: number): Formula | null {
  const row = getDb().prepare(`${FORMULA_SELECT} WHERE f.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToFormula(row) : null;
}

export function listFormulaFlashcards(filters: {
  subjectId?: number;
  chapterId?: number;
  limit?: number;
}): Formula[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.subjectId) {
    conditions.push("f.subject_id = ?");
    params.push(filters.subjectId);
  }
  if (filters.chapterId) {
    conditions.push("f.chapter_id = ?");
    params.push(filters.chapterId);
  }
  params.push(Math.min(Math.max(filters.limit ?? 200, 1), 500));
  return (
    getDb()
      .prepare(
        `${FORMULA_SELECT}
         ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY
           COALESCE(r.missed_count, 0) DESC,
           CASE WHEN COALESCE(r.review_count, 0) = 0 THEN 0 ELSE 1 END ASC,
           COALESCE(r.last_reviewed_at, '') ASC,
           RANDOM()
         LIMIT ?`,
      )
      .all(...params) as Record<string, unknown>[]
  ).map(rowToFormula);
}

export function formulaTree(): FormulaTreeData {
  const db = getDb();
  const subjects = db
    .prepare("SELECT id, code, name FROM subjects ORDER BY order_index")
    .all() as { id: number; code: string; name: string }[];
  const chapters = db
    .prepare("SELECT id, subject_id, code, name FROM chapters ORDER BY order_index")
    .all() as { id: number; subject_id: number; code: string; name: string }[];
  const subtopics = db
    .prepare("SELECT id, chapter_id, name FROM subtopics ORDER BY order_index")
    .all() as { id: number; chapter_id: number; name: string }[];
  const counts = db
    .prepare(
      `SELECT subject_id, chapter_id, subtopic_id, COUNT(*) AS count
       FROM formulas GROUP BY subject_id, chapter_id, subtopic_id`,
    )
    .all() as { subject_id: number; chapter_id: number | null; subtopic_id: number | null; count: number }[];

  const subjectCounts = new Map<number, number>();
  const chapterCounts = new Map<number, number>();
  const subtopicCounts = new Map<number, number>();
  let totalFormulas = 0;
  for (const count of counts) {
    totalFormulas += Number(count.count);
    subjectCounts.set(count.subject_id, (subjectCounts.get(count.subject_id) ?? 0) + Number(count.count));
    if (count.chapter_id !== null) {
      chapterCounts.set(count.chapter_id, (chapterCounts.get(count.chapter_id) ?? 0) + Number(count.count));
    }
    if (count.subtopic_id !== null) {
      subtopicCounts.set(count.subtopic_id, (subtopicCounts.get(count.subtopic_id) ?? 0) + Number(count.count));
    }
  }
  const chapterCountBySubject = new Map<number, number>();
  for (const chapter of chapters) {
    chapterCountBySubject.set(
      chapter.subject_id,
      (chapterCountBySubject.get(chapter.subject_id) ?? 0) + 1,
    );
  }
  const subtopicCountByChapter = new Map<number, number>();
  for (const subtopic of subtopics) {
    subtopicCountByChapter.set(
      subtopic.chapter_id,
      (subtopicCountByChapter.get(subtopic.chapter_id) ?? 0) + 1,
    );
  }

  const treeSubjects: FormulaTreeSubject[] = subjects.map((subject) => ({
    ...subject,
    formulaCount: subjectCounts.get(subject.id) ?? 0,
    chapterCount: chapterCountBySubject.get(subject.id) ?? 0,
  }));
  const treeChapters: FormulaTreeChapter[] = chapters.map((chapter) => ({
    id: chapter.id,
    subjectId: chapter.subject_id,
    code: chapter.code,
    name: chapter.name,
    formulaCount: chapterCounts.get(chapter.id) ?? 0,
    subtopicCount: subtopicCountByChapter.get(chapter.id) ?? 0,
  }));
  const treeSubtopics: FormulaTreeSubtopic[] = subtopics.map((subtopic) => ({
    id: subtopic.id,
    chapterId: subtopic.chapter_id,
    name: subtopic.name,
    formulaCount: subtopicCounts.get(subtopic.id) ?? 0,
  }));

  return { subjects: treeSubjects, chapters: treeChapters, subtopics: treeSubtopics, totalFormulas };
}

export function createFormula(input: {
  subjectId: number;
  chapterId: number | null;
  subtopicId: number | null;
  title: string;
  expression: string;
  notes?: string;
  tags?: string[];
}): Formula {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO formulas (subject_id, chapter_id, subtopic_id, title, expression, notes, tags_json, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user', ?, ?)`,
    )
    .run(
      input.subjectId,
      input.chapterId,
      input.subtopicId,
      input.title.trim(),
      input.expression.trim(),
      input.notes?.trim() ?? "",
      JSON.stringify(input.tags ?? []),
      now,
      now,
    );
  return getFormula(Number(result.lastInsertRowid))!;
}

export function updateFormula(
  id: number,
  input: { title?: string; expression?: string; notes?: string; tags?: string[] },
): Formula {
  const existing = getFormula(id);
  if (!existing) throw new Error("Formula not found.");
  const fields: string[] = [];
  const params: (string | number)[] = [];
  if (input.title !== undefined) {
    fields.push("title = ?");
    params.push(input.title.trim());
  }
  if (input.expression !== undefined) {
    fields.push("expression = ?");
    params.push(input.expression.trim());
  }
  if (input.notes !== undefined) {
    fields.push("notes = ?");
    params.push(input.notes);
  }
  if (input.tags !== undefined) {
    fields.push("tags_json = ?");
    params.push(JSON.stringify(input.tags));
  }
  fields.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);
  getDb().prepare(`UPDATE formulas SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  return getFormula(id)!;
}

export function deleteFormula(id: number): boolean {
  const result = getDb().prepare("DELETE FROM formulas WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}

export function reviewFormula(id: number, result: FormulaReviewResult): Formula {
  const formula = getFormula(id);
  if (!formula) throw new Error("Formula not found.");
  getDb()
    .prepare("INSERT INTO formula_reviews (formula_id, result, reviewed_at) VALUES (?, ?, ?)")
    .run(id, result, nowIso());
  return getFormula(id)!;
}
