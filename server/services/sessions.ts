import type { SessionSummary, StudySession, Task, TimerMode } from "../../shared/types.ts";
import {
  elapsedSeconds,
  getDb,
  nowIso,
  parseJson,
  rowToSession,
  rowToTask,
} from "../db.ts";

type SessionRow = Record<string, unknown>;

function getSessionRow(id: number): SessionRow | undefined {
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

export function getSession(id: number): StudySession | null {
  const row = getSessionRow(id);
  return row ? rowToSession(row) : null;
}

export function getActiveSessionRow(): SessionRow | undefined {
  return getDb()
    .prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    .get() as SessionRow | undefined;
}

export function getActiveSession(): StudySession | null {
  const row = getActiveSessionRow();
  return row ? rowToSession(row) : null;
}

export function startSession(): { session: StudySession; created: boolean } {
  const existing = getActiveSessionRow();
  if (existing) return { session: rowToSession(existing), created: false };
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO sessions (started_at, status, focus_seconds, break_seconds, timer_state, timer_mode,
        planned_task_ids_json, notes, created_at)
       VALUES (?, 'active', 0, 0, 'idle', 'focus', '[]', '', ?)`,
    )
    .run(now, now);
  const session = getSession(Number(result.lastInsertRowid));
  if (!session) throw new Error("Failed to create session");
  return { session, created: true };
}

function flushRunningTimer(row: SessionRow): { focusSeconds: number; breakSeconds: number } {
  let focusSeconds = Number(row.focus_seconds);
  let breakSeconds = Number(row.break_seconds);
  if (row.timer_state === "running" && row.timer_started_at) {
    const elapsed = elapsedSeconds("running", String(row.timer_started_at));
    if (row.timer_mode === "break") breakSeconds += elapsed;
    else focusSeconds += elapsed;
  }
  return { focusSeconds, breakSeconds };
}

export function startTimer(id: number, mode: TimerMode): StudySession {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  if (row.status === "ended") throw new Error("Cannot start a timer on an ended session");
  const { focusSeconds, breakSeconds } = flushRunningTimer(row);
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE sessions SET focus_seconds = ?, break_seconds = ?, timer_state = 'running',
         timer_mode = ?, timer_started_at = ? WHERE id = ?`,
    )
    .run(focusSeconds, breakSeconds, mode, now, id);
  return getSession(id)!;
}

export function pauseTimer(id: number): StudySession {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  if (row.status === "ended") throw new Error("Session has ended");
  if (row.timer_state !== "running") throw new Error("Timer is not running");
  const { focusSeconds, breakSeconds } = flushRunningTimer(row);
  getDb()
    .prepare(
      `UPDATE sessions SET focus_seconds = ?, break_seconds = ?, timer_state = 'paused',
         timer_started_at = NULL WHERE id = ?`,
    )
    .run(focusSeconds, breakSeconds, id);
  return getSession(id)!;
}

export function resumeTimer(id: number): StudySession {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  if (row.status === "ended") throw new Error("Session has ended");
  if (row.timer_state === "running") return rowToSession(row);
  const mode = row.timer_state === "paused" ? String(row.timer_mode) : "focus";
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE sessions SET timer_state = 'running', timer_mode = ?, timer_started_at = ? WHERE id = ?`,
    )
    .run(mode, now, id);
  return getSession(id)!;
}

export function setSessionNotes(id: number, notes: string): StudySession {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  getDb()
    .prepare("UPDATE sessions SET notes = ?, summary_json = NULL WHERE id = ?")
    .run(notes, id);
  return getSession(id)!;
}

export function setSessionPlan(id: number, taskIds: number[]): StudySession {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  getDb()
    .prepare("UPDATE sessions SET planned_task_ids_json = ? WHERE id = ?")
    .run(JSON.stringify([...new Set(taskIds)]), id);
  return getSession(id)!;
}

export function generateSessionSummary(id: number): SessionSummary {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  const session = rowToSession(row);
  const attempts = getDb()
    .prepare(
      `SELECT a.correctness, st.name AS subtopic_name
       FROM attempts a LEFT JOIN subtopics st ON st.id = a.subtopic_id
       WHERE a.session_id = ? ORDER BY a.created_at`,
    )
    .all(id) as { correctness: string; subtopic_name: string | null }[];
  const plannedTaskIds = parseJson<number[]>(row.planned_task_ids_json, []);
  let plannedTasks: Task[] = [];
  if (plannedTaskIds.length > 0) {
    const placeholders = plannedTaskIds.map(() => "?").join(",");
    plannedTasks = (
      getDb()
        .prepare(
          `SELECT t.*, s.name AS subject_name, c.name AS chapter_name
           FROM tasks t
           LEFT JOIN subjects s ON s.id = t.subject_id
           LEFT JOIN chapters c ON c.id = t.chapter_id
           WHERE t.id IN (${placeholders})`,
        )
        .all(...plannedTaskIds) as Record<string, unknown>[]
    ).map(rowToTask);
  }

  const correct = attempts.filter((attempt) => attempt.correctness === "correct").length;
  const partial = attempts.filter((attempt) => attempt.correctness === "partial").length;
  const incorrect = attempts.filter((attempt) => attempt.correctness === "incorrect").length;
  const attempted = attempts.filter((attempt) => attempt.correctness !== "skipped").length;
  const topicsStudied = [
    ...new Set(attempts.map((attempt) => attempt.subtopic_name).filter((name): name is string => Boolean(name))),
  ];
  const focusMinutes = Math.floor(session.liveFocusSeconds / 60);
  const breakMinutes = Math.floor(session.liveBreakSeconds / 60);
  const completedTasks = plannedTasks.filter((task) => task.status === "completed").length;

  return {
    generatedAt: nowIso(),
    focusMinutes,
    breakMinutes,
    attempts: attempts.length,
    correct,
    partial,
    incorrect,
    accuracy: attempted > 0 ? Math.round(((correct + partial * 0.5) / attempted) * 1000) / 10 : null,
    hintsUsed: 0,
    solutionsViewed: 0,
    tasksCompleted: completedTasks,
    tasksPlanned: plannedTasks.length,
    topicsStudied,
    selfReported: session.notes,
    evidenceNote:
      "Recorded evidence: timer time, submitted question attempts, and task completion. An open lecture, browser window, or running timer does not prove attention. Self-reported notes are labeled separately.",
  };
}

export function endSession(id: number): StudySession {
  const row = getSessionRow(id);
  if (!row) throw new Error("Session not found");
  if (row.status === "ended") return rowToSession(row);
  const { focusSeconds, breakSeconds } = flushRunningTimer(row);
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE sessions SET focus_seconds = ?, break_seconds = ?, timer_state = 'idle',
         timer_started_at = NULL, ended_at = ?, status = 'ended' WHERE id = ?`,
    )
    .run(focusSeconds, breakSeconds, now, id);
  const summary = generateSessionSummary(id);
  const hints = getDb()
    .prepare("SELECT COALESCE(SUM(hints_used), 0) AS hints, COALESCE(SUM(solution_viewed), 0) AS solutions FROM attempts WHERE session_id = ?")
    .get(id) as { hints: number; solutions: number };
  summary.hintsUsed = Number(hints.hints);
  summary.solutionsViewed = Number(hints.solutions);
  getDb()
    .prepare("UPDATE sessions SET summary_json = ? WHERE id = ?")
    .run(JSON.stringify(summary), id);
  return getSession(id)!;
}

export function listSessions(limit = 30): StudySession[] {
  return (
    getDb()
      .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?")
      .all(Math.min(Math.max(limit, 1), 200)) as SessionRow[]
  ).map(rowToSession);
}

export function sessionAttempts(id: number): Record<string, unknown>[] {
  return getDb()
    .prepare(
      `SELECT a.*, COALESCE(a.difficulty, q.difficulty) AS difficulty, q.prompt AS question_prompt,
         st.name AS subtopic_name, c.name AS chapter_name, s.name AS subject_name
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN subtopics st ON st.id = a.subtopic_id
       LEFT JOIN chapters c ON c.id = q.chapter_id
       LEFT JOIN subjects s ON s.id = q.subject_id
       WHERE a.session_id = ?
       ORDER BY a.created_at ASC`,
    )
    .all(id) as Record<string, unknown>[];
}
