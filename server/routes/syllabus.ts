import { Router } from "express";
import { format, subDays } from "date-fns";
import { z } from "zod";
import type {
  ChapterDetail,
  ChapterWithMastery,
  Difficulty,
  DifficultyStats,
  SyllabusData,
} from "../../shared/types.ts";
import { getDb, nowIso, rowToSubtopic } from "../db.ts";
import {
  getRecentAttempts,
  invalidateMasteryCache,
  loadMasteryContext,
} from "../services/masteryService.ts";
import { HttpError, parseId } from "../http.ts";

export const syllabusRouter = Router();
export const subtopicsRouter = Router();

syllabusRouter.get("/", (_req, res) => {
  const context = loadMasteryContext();
  const chapters: ChapterWithMastery[] = context.chapters.map((chapter) => ({
    ...chapter,
    mastery: context.chapterMastery.get(chapter.id)!,
    subtopics: context.subtopics
      .filter((subtopic) => subtopic.chapterId === chapter.id)
      .map((subtopic) => ({ id: subtopic.id, name: subtopic.name })),
  }));
  const measured = [...context.bySubtopic.values()].filter((item) => item.sufficient).length;
  const attemptCount = (
    getDb().prepare("SELECT COUNT(*) AS count FROM attempts").get() as { count: number }
  ).count;

  const data: SyllabusData = {
    subjects: context.subjects.map((subject) => {
      const aggregate = context.subjectAggregates.get(subject.id)!;
      return {
        ...subject,
        chapterCount: context.chapters.filter((chapter) => chapter.subjectId === subject.id).length,
        subtopicCount: aggregate.totalSubtopics,
        measuredSubtopics: aggregate.measuredSubtopics,
        mastery: aggregate.mastery,
        coverage: aggregate.coverage,
        evidence: aggregate.evidence,
      };
    }),
    chapters,
    coverage: {
      totalSubtopics: context.subtopics.length,
      measuredSubtopics: measured,
      evidenceAttempts: attemptCount,
    },
  };
  res.json(data);
});

syllabusRouter.get("/:id", (req, res) => {
  const chapterId = parseId(req.params.id, "chapter id");
  const context = loadMasteryContext();
  const chapter = context.chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new HttpError("Chapter not found.", 404);
  const subject = context.subjects.find((item) => item.id === chapter.subjectId);
  if (!subject) throw new HttpError("Subject not found.", 404);
  const subtopics = context.subtopics
    .filter((subtopic) => subtopic.chapterId === chapterId)
    .map((subtopic) => ({
      id: subtopic.id,
      chapterId: subtopic.chapterId,
      name: subtopic.name,
      description: subtopic.description,
      weight: subtopic.weight,
      orderIndex: subtopic.orderIndex,
      mastery: context.bySubtopic.get(subtopic.id)!,
    }));

  const difficultyStats: Record<Difficulty, DifficultyStats> = {
    easy: { attempts: 0, correct: 0, partial: 0, incorrect: 0, accuracy: null },
    medium: { attempts: 0, correct: 0, partial: 0, incorrect: 0, accuracy: null },
    hard: { attempts: 0, correct: 0, partial: 0, incorrect: 0, accuracy: null },
  };
  const mistakeCounts = new Map<string, number>();
  const subtopicIds = new Set(subtopics.map((subtopic) => subtopic.id));
  const rows = getDb()
    .prepare(
      `SELECT a.correctness, a.mistake_type, COALESCE(a.difficulty, q.difficulty) AS difficulty
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.subtopic_id IN (${[...subtopicIds].map(() => "?").join(",") || "NULL"})`,
    )
    .all(...subtopicIds) as { correctness: string; mistake_type: string | null; difficulty: Difficulty }[];
  for (const row of rows) {
    if (row.correctness === "skipped") continue;
    const stats = difficultyStats[row.difficulty] ?? difficultyStats.medium;
    stats.attempts += 1;
    if (row.correctness === "correct") stats.correct += 1;
    else if (row.correctness === "partial") stats.partial += 1;
    else if (row.correctness === "incorrect") stats.incorrect += 1;
    if (row.mistake_type) mistakeCounts.set(row.mistake_type, (mistakeCounts.get(row.mistake_type) ?? 0) + 1);
  }
  for (const stats of Object.values(difficultyStats)) {
    const attempted = stats.attempts;
    stats.accuracy =
      attempted > 0
        ? Math.round(((stats.correct + stats.partial * 0.5) / attempted) * 1000) / 10
        : null;
  }

  const historyCutoff = subDays(new Date(), 90).toISOString();
  const snapshots = getDb()
    .prepare(
      `SELECT ps.subtopic_id, ps.mastery, ps.evidence, ps.computed_at, st.weight
       FROM progress_snapshots ps JOIN subtopics st ON st.id = ps.subtopic_id
       WHERE st.chapter_id = ? AND ps.computed_at >= ?
       ORDER BY ps.computed_at ASC, ps.id ASC`,
    )
    .all(chapterId, historyCutoff) as {
    subtopic_id: number;
    mastery: number | null;
    evidence: number;
    computed_at: string;
    weight: number;
  }[];
  const byDay = new Map<string, Map<number, (typeof snapshots)[number]>>();
  for (const snapshot of snapshots) {
    const day = format(new Date(snapshot.computed_at), "yyyy-MM-dd");
    const dayMap = byDay.get(day) ?? new Map();
    dayMap.set(snapshot.subtopic_id, snapshot);
    byDay.set(day, dayMap);
  }
  const weightsById = new Map(subtopics.map((subtopic) => [subtopic.id, subtopic.weight]));
  const totalWeight = subtopics.reduce((sum, subtopic) => sum + Math.max(0.01, subtopic.weight), 0);
  const history = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMap]) => {
      let measuredWeight = 0;
      let weightedMastery = 0;
      let evidence = 0;
      for (const snapshot of dayMap.values()) {
        evidence += snapshot.evidence;
        if (snapshot.mastery !== null) {
          const weight = Math.max(0.01, weightsById.get(snapshot.subtopic_id) ?? snapshot.weight);
          measuredWeight += weight;
          weightedMastery += snapshot.mastery * weight;
        }
      }
      const coverage = totalWeight > 0 ? measuredWeight / totalWeight : 0;
      return {
        date,
        mastery:
          coverage >= 0.5 && measuredWeight > 0
            ? Math.round((weightedMastery / measuredWeight) * 10) / 10
            : null,
        coverage: Math.round(coverage * 1000) / 1000,
        evidence: Math.round(evidence * 1000) / 1000,
      };
    });

  const data: ChapterDetail = {
    chapter,
    subject,
    mastery: context.chapterMastery.get(chapterId)!,
    subtopics,
    difficultyStats,
    recentAttempts: getRecentAttempts({ chapterId, limit: 20 }),
    mistakeSummary: [...mistakeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    history,
  };
  res.json(data);
});

const chapterUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    examScope: z.enum(["mains_advanced", "mains", "advanced"]).optional(),
    orderIndex: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

syllabusRouter.patch("/:id", (req, res) => {
  const chapterId = parseId(req.params.id, "chapter id");
  const input = chapterUpdateSchema.parse(req.body);
  const fields: string[] = [];
  const params: (string | number)[] = [];
  if (input.name !== undefined) {
    fields.push("name = ?");
    params.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    params.push(input.description);
  }
  if (input.examScope !== undefined) {
    fields.push("exam_scope = ?");
    params.push(input.examScope);
  }
  if (input.orderIndex !== undefined) {
    fields.push("order_index = ?");
    params.push(input.orderIndex);
  }
  if (fields.length === 0) throw new HttpError("No changes provided.", 400);
  params.push(chapterId);
  const result = getDb().prepare(`UPDATE chapters SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  if (Number(result.changes) === 0) throw new HttpError("Chapter not found.", 404);
  invalidateMasteryCache();
  const row = getDb().prepare("SELECT * FROM chapters WHERE id = ?").get(chapterId) as Record<string, unknown>;
  res.json({ ...row, id: Number(row.id) });
});

const subtopicUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(250).optional(),
    description: z.string().max(2000).optional(),
    weight: z.number().min(0.01).max(20).optional(),
    orderIndex: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

subtopicsRouter.patch("/:id", (req, res) => {
  const subtopicId = parseId(req.params.id, "subtopic id");
  const input = subtopicUpdateSchema.parse(req.body);
  const fields: string[] = [];
  const params: (string | number)[] = [];
  if (input.name !== undefined) {
    fields.push("name = ?");
    params.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    params.push(input.description);
  }
  if (input.weight !== undefined) {
    fields.push("weight = ?");
    params.push(input.weight);
  }
  if (input.orderIndex !== undefined) {
    fields.push("order_index = ?");
    params.push(input.orderIndex);
  }
  if (fields.length === 0) throw new HttpError("No changes provided.", 400);
  params.push(subtopicId);
  const result = getDb().prepare(`UPDATE subtopics SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  if (Number(result.changes) === 0) throw new HttpError("Subtopic not found.", 404);
  invalidateMasteryCache();
  const row = getDb().prepare("SELECT * FROM subtopics WHERE id = ?").get(subtopicId) as Record<string, unknown>;
  res.json({ ...rowToSubtopic(row), updatedAt: nowIso() });
});

const subtopicCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(250),
    description: z.string().max(2000).optional(),
    weight: z.number().min(0.01).max(20).optional(),
  })
  .strict();

syllabusRouter.post("/:id/subtopics", (req, res) => {
  const chapterId = parseId(req.params.id, "chapter id");
  const input = subtopicCreateSchema.parse(req.body);
  const chapter = getDb().prepare("SELECT id FROM chapters WHERE id = ?").get(chapterId);
  if (!chapter) throw new HttpError("Chapter not found.", 404);
  const maxOrder = getDb()
    .prepare("SELECT COALESCE(MAX(order_index), -1) AS value FROM subtopics WHERE chapter_id = ?")
    .get(chapterId) as { value: number };
  const result = getDb()
    .prepare(
      "INSERT INTO subtopics (chapter_id, name, description, weight, order_index) VALUES (?, ?, ?, ?, ?)",
    )
    .run(chapterId, input.name, input.description ?? "", input.weight ?? 1, Number(maxOrder.value) + 1);
  invalidateMasteryCache();
  const row = getDb()
    .prepare("SELECT * FROM subtopics WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  res.status(201).json(rowToSubtopic(row));
});

subtopicsRouter.delete("/:id", (req, res) => {
  const subtopicId = parseId(req.params.id, "subtopic id");
  const attempts = getDb()
    .prepare("SELECT COUNT(*) AS count FROM attempts WHERE subtopic_id = ?")
    .get(subtopicId) as { count: number };
  if (Number(attempts.count) > 0) {
    throw new HttpError(
      "This subtopic has recorded attempts and cannot be deleted without losing evidence. Rename it instead.",
      409,
    );
  }
  const result = getDb().prepare("DELETE FROM subtopics WHERE id = ?").run(subtopicId);
  if (Number(result.changes) === 0) throw new HttpError("Subtopic not found.", 404);
  invalidateMasteryCache();
  res.json({ ok: true });
});
