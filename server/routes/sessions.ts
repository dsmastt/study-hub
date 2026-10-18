import { Router } from "express";
import { z } from "zod";
import { getDb, rowToAttempt, rowToTask } from "../db.ts";
import {
  endSession,
  getActiveSession,
  getSession,
  listSessions,
  pauseTimer,
  resumeTimer,
  sessionAttempts,
  setSessionNotes,
  setSessionPlan,
  startSession,
  startTimer,
} from "../services/sessions.ts";
import { HttpError, parseId } from "../http.ts";

export const sessionsRouter = Router();

sessionsRouter.get("/active", (_req, res) => {
  res.json(getActiveSession());
});

sessionsRouter.post("/start", (_req, res) => {
  const { session, created } = startSession();
  res.status(created ? 201 : 200).json({ session, created });
});

sessionsRouter.get("/", (req, res) => {
  const limit = Number(req.query.limit ?? 30);
  res.json(listSessions(Number.isFinite(limit) ? limit : 30));
});

sessionsRouter.get("/:id", (req, res) => {
  const id = parseId(req.params.id, "session id");
  const session = getSession(id);
  if (!session) throw new HttpError("Session not found.", 404);
  const attempts = sessionAttempts(id).map(rowToAttempt);
  let plannedTasks: ReturnType<typeof rowToTask>[] = [];
  if (session.plannedTaskIds.length > 0) {
    const placeholders = session.plannedTaskIds.map(() => "?").join(",");
    plannedTasks = (
      getDb()
        .prepare(
          `SELECT t.*, s.name AS subject_name, c.name AS chapter_name
           FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
           LEFT JOIN chapters c ON c.id = t.chapter_id
           WHERE t.id IN (${placeholders})`,
        )
        .all(...session.plannedTaskIds) as Record<string, unknown>[]
    ).map(rowToTask);
  }
  res.json({ session, attempts, plannedTasks });
});

const timerSchema = z.object({ mode: z.enum(["focus", "break"]).optional() });

sessionsRouter.post("/:id/timer/start", (req, res) => {
  const id = parseId(req.params.id, "session id");
  const input = timerSchema.parse(req.body ?? {});
  res.json(startTimer(id, input.mode ?? "focus"));
});

sessionsRouter.post("/:id/timer/pause", (req, res) => {
  const id = parseId(req.params.id, "session id");
  res.json(pauseTimer(id));
});

sessionsRouter.post("/:id/timer/resume", (req, res) => {
  const id = parseId(req.params.id, "session id");
  res.json(resumeTimer(id));
});

sessionsRouter.post("/:id/end", (req, res) => {
  const id = parseId(req.params.id, "session id");
  res.json(endSession(id));
});

const updateSessionSchema = z
  .object({
    notes: z.string().max(10_000).optional(),
    plannedTaskIds: z.array(z.number().int().positive()).max(100).optional(),
  })
  .strict();

sessionsRouter.patch("/:id", (req, res) => {
  const id = parseId(req.params.id, "session id");
  const input = updateSessionSchema.parse(req.body);
  const existing = getSession(id);
  if (!existing) throw new HttpError("Session not found.", 404);
  let session = existing;
  if (input.notes !== undefined) session = setSessionNotes(id, input.notes);
  if (input.plannedTaskIds !== undefined) session = setSessionPlan(id, input.plannedTaskIds);
  res.json(session);
});
