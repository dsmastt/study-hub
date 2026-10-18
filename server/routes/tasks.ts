import { Router } from "express";
import { z } from "zod";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "../services/tasks.ts";
import { HttpError, parseId } from "../http.ts";

export const tasksRouter = Router();

const listQuerySchema = z.object({
  status: z.enum(["open", "pending", "in_progress", "completed", "cancelled"]).optional(),
  type: z.enum(["study", "homework", "assignment", "project", "test", "exam", "revision"]).optional(),
  dueFrom: z.string().datetime({ offset: true }).optional(),
  dueTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

tasksRouter.get("/", (req, res) => {
  const query = listQuerySchema.parse(req.query);
  res.json(listTasks(query));
});

const taskFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(["study", "homework", "assignment", "project", "test", "exam", "revision"]).optional(),
  subjectId: z.number().int().positive().nullable().optional(),
  chapterId: z.number().int().positive().nullable().optional(),
  subtopicId: z.number().int().positive().nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(1).max(3).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  estimatedMinutes: z.number().int().min(5).max(600).nullable().optional(),
});

const createTaskSchema = taskFieldsSchema.extend({
  title: z.string().trim().min(1).max(200),
});

tasksRouter.post("/", (req, res) => {
  const input = createTaskSchema.parse(req.body);
  const task = createTask({
    title: input.title,
    description: input.description,
    type: input.type,
    subjectId: input.subjectId,
    chapterId: input.chapterId,
    subtopicId: input.subtopicId,
    dueAt: input.dueAt ?? null,
    priority: input.priority as 1 | 2 | 3 | undefined,
    status: input.status,
    estimatedMinutes: input.estimatedMinutes,
    source: "manual",
  });
  res.status(201).json(task);
});

tasksRouter.patch("/:id", (req, res) => {
  const id = parseId(req.params.id, "task id");
  const input = taskFieldsSchema.parse(req.body);
  if (Object.keys(input).length === 0) throw new HttpError("No changes provided.", 400);
  const existing = getTask(id);
  if (!existing) throw new HttpError("Task not found.", 404);
  const task = updateTask(id, {
    ...input,
    priority: input.priority as 1 | 2 | 3 | undefined,
  });
  res.json(task);
});

tasksRouter.delete("/:id", (req, res) => {
  const id = parseId(req.params.id, "task id");
  if (!deleteTask(id)) throw new HttpError("Task not found.", 404);
  res.json({ ok: true });
});
