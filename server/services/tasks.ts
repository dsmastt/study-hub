import type { Task, TaskSource, TaskStatus, TaskType } from "../../shared/types.ts";
import { getDb, nowIso, rowToTask } from "../db.ts";
import { loadMasteryContext } from "./masteryService.ts";

export interface TaskInput {
  title: string;
  description?: string;
  type?: TaskType;
  subjectId?: number | null;
  chapterId?: number | null;
  subtopicId?: number | null;
  dueAt?: string | null;
  priority?: 1 | 2 | 3;
  status?: TaskStatus;
  estimatedMinutes?: number | null;
  source?: TaskSource;
}

const TASK_SELECT = `SELECT t.*, s.name AS subject_name, c.name AS chapter_name
  FROM tasks t
  LEFT JOIN subjects s ON s.id = t.subject_id
  LEFT JOIN chapters c ON c.id = t.chapter_id`;

export function getTask(id: number): Task | null {
  const row = getDb().prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToTask(row) : null;
}

export function listTasks(
  options: {
    status?: TaskStatus | "open";
    type?: TaskType;
    dueFrom?: string;
    dueTo?: string;
    limit?: number;
    withUrgency?: boolean;
  } = {},
): Task[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (options.status === "open") {
    conditions.push("t.status IN ('pending', 'in_progress')");
  } else if (options.status) {
    conditions.push("t.status = ?");
    params.push(options.status);
  }
  if (options.type) {
    conditions.push("t.type = ?");
    params.push(options.type);
  }
  if (options.dueFrom) {
    conditions.push("t.due_at >= ?");
    params.push(options.dueFrom);
  }
  if (options.dueTo) {
    conditions.push("t.due_at <= ?");
    params.push(options.dueTo);
  }
  const limit = Math.min(Math.max(options.limit ?? 300, 1), 500);
  params.push(limit);
  const rows = getDb()
    .prepare(
      `${TASK_SELECT}
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY (t.due_at IS NULL), t.due_at ASC, t.priority ASC, t.id DESC
       LIMIT ?`,
    )
    .all(...params) as Record<string, unknown>[];
  const tasks = rows.map(rowToTask);
  if (options.withUrgency !== false) {
    const context = loadMasteryContext();
    for (const task of tasks) task.urgencyScore = computeUrgency(task, context);
    tasks.sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0));
  }
  return tasks;
}

function computeUrgency(task: Task, context: ReturnType<typeof loadMasteryContext>): number {
  if (task.status === "completed" || task.status === "cancelled") return -1000;
  let score = 0;
  const priorityBonus = task.priority === 1 ? 30 : task.priority === 2 ? 15 : 5;
  score += priorityBonus;
  if (task.dueAt) {
    const hours = (new Date(task.dueAt).getTime() - Date.now()) / 3_600_000;
    if (hours < 0) score += 100 + Math.min(50, (-hours / 24) * 5);
    else if (hours <= 24) score += 70;
    else if (hours <= 72) score += 50 - (hours / 72) * 15;
    else if (hours <= 168) score += 25;
    else score += 8;
  } else {
    score += 4;
  }
  if (task.subtopicId) {
    const mastery = context.bySubtopic.get(task.subtopicId);
    if (mastery?.sufficient && mastery.mastery !== null && mastery.mastery < 50) score += 18;
    else if (!mastery?.sufficient) score += 7;
  } else if (task.chapterId) {
    const mastery = context.chapterMastery.get(task.chapterId);
    if (mastery?.sufficient && mastery.mastery !== null && mastery.mastery < 50) score += 12;
    else if (!mastery?.sufficient) score += 5;
  }
  return Math.round(score * 10) / 10;
}

export function createTask(input: TaskInput): Task {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO tasks (title, description, type, subject_id, chapter_id, subtopic_id, due_at,
        priority, status, estimated_minutes, completed_at, created_at, updated_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description ?? "",
      input.type ?? "study",
      input.subjectId ?? null,
      input.chapterId ?? null,
      input.subtopicId ?? null,
      input.dueAt ?? null,
      input.priority ?? 2,
      input.status ?? "pending",
      input.estimatedMinutes ?? null,
      input.status === "completed" ? now : null,
      now,
      now,
      input.source ?? "manual",
    );
  return getTask(Number(result.lastInsertRowid))!;
}

export function updateTask(id: number, input: Partial<TaskInput>): Task {
  const existing = getTask(id);
  if (!existing) throw new Error("Task not found");
  const now = nowIso();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  const set = (column: string, value: string | number | null) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };
  if (input.title !== undefined) set("title", input.title);
  if (input.description !== undefined) set("description", input.description);
  if (input.type !== undefined) set("type", input.type);
  if (input.subjectId !== undefined) set("subject_id", input.subjectId);
  if (input.chapterId !== undefined) set("chapter_id", input.chapterId);
  if (input.subtopicId !== undefined) set("subtopic_id", input.subtopicId);
  if (input.dueAt !== undefined) set("due_at", input.dueAt);
  if (input.priority !== undefined) set("priority", input.priority);
  if (input.estimatedMinutes !== undefined) set("estimated_minutes", input.estimatedMinutes);
  if (input.status !== undefined) {
    set("status", input.status);
    if (input.status === "completed") {
      set("completed_at", existing.completedAt ?? now);
    } else {
      set("completed_at", null);
    }
  }
  fields.push("updated_at = ?");
  params.push(now);
  params.push(id);
  getDb()
    .prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`)
    .run(...params);
  return getTask(id)!;
}

export function deleteTask(id: number): boolean {
  const result = getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
