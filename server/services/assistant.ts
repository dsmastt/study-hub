import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  isWeakMastery,
  type ChatMessage,
  type ChatToolEvent,
  type PendingAction,
  type QuestionGenerationRequest,
} from "../../shared/types.ts";
import { getDb, nowIso, parseJson } from "../db.ts";
import {
  AIToolDefinition,
  AIMessage,
  AIError,
  chatCompletion,
  isAIConfigured,
} from "./ai.ts";
import { loadMasteryContext } from "./masteryService.ts";
import { getRecentAttempts } from "./masteryService.ts";
import { generateQuestions } from "./questionAI.ts";
import { createTask, listTasks, updateTask } from "./tasks.ts";
import { getActiveSession, startSession, startTimer, pauseTimer, resumeTimer } from "./sessions.ts";
import { format } from "date-fns";

const CONFIRMATION_TOOLS = new Set(["create_task", "update_task_status", "generate_questions"]);

export const STUDY_HUB_TOOLS: AIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_study_overview",
      description:
        "Read a compact overview of the user's real study data: current session, open tasks, weak evidence-backed topics, syllabus coverage, and recent attempts.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weak_topics",
      description:
        "List evidence-backed weak subtopics. Only includes topics that have enough recorded attempts for a mastery estimate.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximum topics to return." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_syllabus",
      description: "Read the subject, chapter and subtopic structure with mastery coverage.",
      parameters: {
        type: "object",
        properties: {
          subjectId: { type: "integer", description: "Optional subject id to narrow the result." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chapter_detail",
      description: "Read one chapter with subtopic-level mastery, evidence counts and reasons.",
      parameters: {
        type: "object",
        properties: {
          chapterId: { type: "integer", description: "Chapter id from the syllabus." },
        },
        required: ["chapterId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description: "Read the user's tasks, optionally filtered by status.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "pending", "in_progress", "completed", "cancelled"],
          },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_attempts",
      description: "Read recent recorded question attempts, including correctness and topic.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 30 },
          correctness: {
            type: "string",
            enum: ["correct", "partial", "incorrect", "skipped"],
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_session",
      description: "Read the current study session and timer state.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Create a study task or deadline. Requires user confirmation in the UI. Use ISO 8601 date-time for dueAt.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 2000 },
          type: {
            type: "string",
            enum: ["study", "homework", "assignment", "project", "test", "exam", "revision"],
          },
          dueAt: { type: "string", description: "ISO 8601 date-time, or omit if no deadline." },
          priority: { type: "integer", minimum: 1, maximum: 3, description: "1=high, 2=medium, 3=low" },
          subjectId: { type: "integer" },
          chapterId: { type: "integer" },
          subtopicId: { type: "integer" },
          estimatedMinutes: { type: "integer", minimum: 5, maximum: 600 },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task_status",
      description:
        "Change a task status (for example mark it completed). Requires user confirmation in the UI.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "integer" },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
        },
        required: ["taskId", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_focus_timer",
      description:
        "Start the focus or break timer in the active session, creating a session if none exists. Reversible, so it runs immediately.",
      parameters: {
        type: "object",
        properties: { mode: { type: "string", enum: ["focus", "break"] } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pause_timer",
      description: "Pause the running focus/break timer. Reversible.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "resume_timer",
      description: "Resume the paused timer. Reversible.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_questions",
      description:
        "Generate syllabus-aligned practice questions and store them. Requires user confirmation in the UI.",
      parameters: {
        type: "object",
        properties: {
          subjectId: { type: "integer" },
          chapterId: { type: "integer" },
          subtopicId: { type: "integer" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard", "mixed"] },
          questionType: { type: "string", enum: ["mcq", "numeric", "short", "long", "mixed"] },
          count: { type: "integer", minimum: 1, maximum: 20 },
          focusWeakAreas: { type: "boolean" },
          instructions: { type: "string", maxLength: 1000 },
        },
        additionalProperties: false,
      },
    },
  },
];

const emptyArgs = z.object({}).passthrough();

const getWeakSchema = z.object({ limit: z.coerce.number().int().min(1).max(20).default(8) });
const getSyllabusSchema = z.object({ subjectId: z.coerce.number().int().positive().optional() });
const chapterSchema = z.object({ chapterId: z.coerce.number().int().positive() });
const getTasksSchema = z.object({
  status: z.enum(["open", "pending", "in_progress", "completed", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const getAttemptsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  correctness: z.enum(["correct", "partial", "incorrect", "skipped"]).optional(),
});
const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["study", "homework", "assignment", "project", "test", "exam", "revision"]).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  priority: z.coerce.number().int().min(1).max(3).optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  subtopicId: z.coerce.number().int().positive().optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(600).optional(),
});
const updateTaskStatusSchema = z.object({
  taskId: z.coerce.number().int().positive(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});
const timerModeSchema = z.object({ mode: z.enum(["focus", "break"]).default("focus") });
const generateSchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  subtopicId: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
  questionType: z.enum(["mcq", "numeric", "short", "long", "mixed"]).optional(),
  count: z.coerce.number().int().min(1).max(20).default(5),
  focusWeakAreas: z.boolean().optional(),
  instructions: z.string().max(1000).optional(),
});

export interface ToolExecutionResult {
  result: unknown;
  summary: string;
}

function overviewData(): Record<string, unknown> {
  const context = loadMasteryContext();
  const active = getActiveSession();
  const openTasks = listTasks({ status: "open", limit: 12 });
  const today = format(new Date(), "yyyy-MM-dd");
  const dueToday = openTasks.filter((task) => task.dueAt?.slice(0, 10) === today);
  const weak = [...context.bySubtopic.values()]
    .filter((item) => isWeakMastery(item))
    .sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100))
    .slice(0, 6)
    .map((item) => ({
      subtopicId: item.subtopicId,
      name: item.subtopicName,
      chapter: item.chapterName,
      mastery: item.mastery,
      attempts: item.attempts,
      evidence: item.evidence,
    }));
  const recentAttempts = getRecentAttempts({ limit: 5 }).map((attempt) => ({
    questionId: attempt.questionId,
    correctness: attempt.correctness,
    subtopic: attempt.subtopicName,
    at: attempt.createdAt,
  }));
  return {
    date: today,
    activeSession: active
      ? {
          id: active.id,
          status: active.status,
          timerState: active.timerState,
          timerMode: active.timerMode,
          focusMinutes: Math.floor(active.liveFocusSeconds / 60),
          breakMinutes: Math.floor(active.liveBreakSeconds / 60),
        }
      : null,
    openTasks: openTasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      dueAt: task.dueAt,
      priority: task.priority,
      subject: task.subjectName,
      chapter: task.chapterName,
    })),
    dueTodayCount: dueToday.length,
    weakTopics: weak,
    syllabusCoverage: {
      subjects: context.subjects.length,
      chapters: context.chapters.length,
      subtopics: context.subtopics.length,
      measuredSubtopics: [...context.bySubtopic.values()].filter((item) => item.sufficient).length,
    },
    recentAttempts,
  };
}

export async function executeTool(name: string, rawArgs: unknown): Promise<ToolExecutionResult> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  switch (name) {
    case "get_study_overview": {
      emptyArgs.parse(args);
      return {
        result: overviewData(),
        summary: "Read the Study Hub overview.",
      };
    }
    case "get_weak_topics": {
      const parsed = getWeakSchema.parse(args);
      const context = loadMasteryContext();
      const weak = [...context.bySubtopic.values()]
        .filter((item) => isWeakMastery(item))
        .sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100))
        .slice(0, parsed.limit)
        .map((item) => ({
          subtopicId: item.subtopicId,
          name: item.subtopicName,
          chapter: item.chapterName,
          mastery: item.mastery,
          attempts: item.attempts,
          distinctQuestions: item.distinctQuestions,
          evidence: item.evidence,
          recentAccuracy: item.recentAccuracy,
          mistakes: item.mistakes,
        }));
      return { result: weak, summary: `Found ${weak.length} evidence-backed weak topics.` };
    }
    case "get_syllabus": {
      const parsed = getSyllabusSchema.parse(args);
      const context = loadMasteryContext();
      const subjects = context.subjects
        .filter((subject) => !parsed.subjectId || subject.id === parsed.subjectId)
        .map((subject) => ({
          id: subject.id,
          name: subject.name,
          mastery: context.subjectAggregates.get(subject.id)?.mastery ?? null,
          coverage: context.subjectAggregates.get(subject.id)?.coverage ?? 0,
          chapters: context.chapters
            .filter((chapter) => chapter.subjectId === subject.id)
            .map((chapter) => {
              const mastery = context.chapterMastery.get(chapter.id);
              return {
                id: chapter.id,
                name: chapter.name,
                mastery: mastery?.mastery ?? null,
                coverage: mastery?.coverage ?? 0,
                subtopics: context.subtopics
                  .filter((subtopic) => subtopic.chapterId === chapter.id)
                  .map((subtopic) => {
                    const item = context.bySubtopic.get(subtopic.id);
                    return {
                      id: subtopic.id,
                      name: subtopic.name,
                      mastery: item?.mastery ?? null,
                      sufficient: item?.sufficient ?? false,
                    };
                  }),
              };
            }),
        }));
      return { result: subjects, summary: `Read syllabus for ${subjects.length} subject(s).` };
    }
    case "get_chapter_detail": {
      const parsed = chapterSchema.parse(args);
      const context = loadMasteryContext();
      const chapter = context.chapters.find((item) => item.id === parsed.chapterId);
      if (!chapter) throw new AIError("Chapter not found.", 404);
      const subtopics = context.subtopics
        .filter((subtopic) => subtopic.chapterId === chapter.id)
        .map((subtopic) => {
          const item = context.bySubtopic.get(subtopic.id);
          return {
            id: subtopic.id,
            name: subtopic.name,
            mastery: item?.mastery ?? null,
            sufficient: item?.sufficient ?? false,
            attempts: item?.attempts ?? 0,
            distinctQuestions: item?.distinctQuestions ?? 0,
            evidence: item?.evidence ?? 0,
            reason: item?.reason ?? null,
            mistakes: item?.mistakes ?? [],
          };
        });
      const mastery = context.chapterMastery.get(chapter.id);
      return {
        result: { chapter, mastery, subtopics },
        summary: `Read ${chapter.name}.`,
      };
    }
    case "get_tasks": {
      const parsed = getTasksSchema.parse(args);
      const tasks = listTasks({ status: parsed.status, limit: parsed.limit });
      return {
        result: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          type: task.type,
          status: task.status,
          dueAt: task.dueAt,
          priority: task.priority,
          subject: task.subjectName,
          chapter: task.chapterName,
          urgency: task.urgencyScore,
        })),
        summary: `Read ${tasks.length} task(s).`,
      };
    }
    case "get_recent_attempts": {
      const parsed = getAttemptsSchema.parse(args);
      const attempts = getRecentAttempts({ limit: parsed.limit, correctness: parsed.correctness });
      return {
        result: attempts.map((attempt) => ({
          id: attempt.id,
          questionId: attempt.questionId,
          correctness: attempt.correctness,
          subtopic: attempt.subtopicName,
          chapter: attempt.chapterName,
          difficulty: attempt.difficulty,
          hintsUsed: attempt.hintsUsed,
          solutionViewed: attempt.solutionViewed,
          at: attempt.createdAt,
        })),
        summary: `Read ${attempts.length} recent attempt(s).`,
      };
    }
    case "get_current_session": {
      emptyArgs.parse(args);
      const session = getActiveSession();
      return {
        result: session
          ? {
              id: session.id,
              timerState: session.timerState,
              timerMode: session.timerMode,
              focusMinutes: Math.floor(session.liveFocusSeconds / 60),
              breakMinutes: Math.floor(session.liveBreakSeconds / 60),
              notes: session.notes,
              plannedTaskIds: session.plannedTaskIds,
            }
          : null,
        summary: session ? "Read the active session." : "No active session.",
      };
    }
    case "create_task": {
      const parsed = createTaskSchema.parse(args);
      const task = createTask({
        ...parsed,
        priority: (parsed.priority ?? 2) as 1 | 2 | 3,
        source: "ai",
        dueAt: parsed.dueAt ?? null,
        subjectId: parsed.subjectId ?? null,
        chapterId: parsed.chapterId ?? null,
        subtopicId: parsed.subtopicId ?? null,
      });
      return {
        result: { taskId: task.id, title: task.title, dueAt: task.dueAt, type: task.type },
        summary: `Created task “${task.title}”.`,
      };
    }
    case "update_task_status": {
      const parsed = updateTaskStatusSchema.parse(args);
      const task = updateTask(parsed.taskId, { status: parsed.status });
      return {
        result: { taskId: task.id, status: task.status, title: task.title },
        summary: `Set “${task.title}” to ${task.status}.`,
      };
    }
    case "start_focus_timer": {
      const parsed = timerModeSchema.parse(args);
      const { session } = startSession();
      startTimer(session.id, parsed.mode);
      return {
        result: { sessionId: session.id, mode: parsed.mode },
        summary:
          parsed.mode === "break"
            ? "Started a break timer in the active session."
            : "Started the focus timer in the active session.",
      };
    }
    case "pause_timer": {
      emptyArgs.parse(args);
      const active = getActiveSession();
      if (!active) throw new AIError("There is no active session to pause.", 400);
      pauseTimer(active.id);
      return { result: { sessionId: active.id }, summary: "Paused the timer." };
    }
    case "resume_timer": {
      emptyArgs.parse(args);
      const active = getActiveSession();
      if (!active) throw new AIError("There is no active session to resume.", 400);
      resumeTimer(active.id);
      return { result: { sessionId: active.id }, summary: "Resumed the timer." };
    }
    case "generate_questions": {
      const parsed = generateSchema.parse(args);
      const request: QuestionGenerationRequest = parsed;
      const generated = await generateQuestions(request);
      return {
        result: {
          count: generated.questions.length,
          questions: generated.questions.map((question) => ({
            id: question.id,
            prompt: question.prompt.slice(0, 160),
            difficulty: question.difficulty,
            subtopic: question.subtopicName,
            status: question.status,
          })),
          warnings: generated.warnings,
        },
        summary: `Generated and stored ${generated.questions.length} question(s).`,
      };
    }
    default:
      throw new AIError(`Unknown tool: ${name}`, 400);
  }
}

export function isConfirmationTool(name: string): boolean {
  return CONFIRMATION_TOOLS.has(name);
}

export function describeAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "create_task":
      return `Create task “${String(args.title ?? "Untitled")}”`;
    case "update_task_status":
      return `Update task ${String(args.taskId ?? "?")} to ${String(args.status ?? "?")}`;
    case "generate_questions":
      return `Generate ${String(args.count ?? 5)} practice question(s)`;
    default:
      return `Run ${name}`;
  }
}

export function safeParseToolArguments(value: string): Record<string, unknown> {
  if (!value || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Tool arguments must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new AIError(
      `The assistant sent invalid tool arguments: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }
}

function rowToChatMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    role: String(row.role) as ChatMessage["role"],
    content: String(row.content),
    toolEvents: parseJson<ChatToolEvent[]>(row.tool_events_json, []),
    createdAt: String(row.created_at),
  };
}

export function listChatMessages(limit = 100): ChatMessage[] {
  return (
    getDb()
      .prepare("SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?")
      .all(Math.min(Math.max(limit, 1), 300)) as Record<string, unknown>[]
  )
    .map(rowToChatMessage)
    .reverse();
}

export function clearChatMessages(): void {
  getDb().prepare("DELETE FROM chat_messages").run();
}

function insertChatMessage(
  role: "user" | "assistant",
  content: string,
  toolEvents: ChatToolEvent[] = [],
): ChatMessage {
  const result = getDb()
    .prepare(
      "INSERT INTO chat_messages (role, content, tool_events_json, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(role, content, JSON.stringify(toolEvents), nowIso());
  return rowToChatMessage(
    getDb().prepare("SELECT * FROM chat_messages WHERE id = ?").get(Number(result.lastInsertRowid)) as Record<
      string,
      unknown
    >,
  );
}

function insertPendingAction(type: string, payload: Record<string, unknown>, summary: string): PendingAction {
  const id = randomUUID();
  const createdAt = nowIso();
  getDb()
    .prepare(
      "INSERT INTO pending_actions (id, type, summary, payload_json, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    )
    .run(id, type, summary, JSON.stringify(payload), createdAt);
  return { id, type, summary, payload, createdAt };
}

export function getPendingAction(id: string): (PendingAction & { status: string }) | null {
  const row = getDb().prepare("SELECT * FROM pending_actions WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    type: String(row.type),
    summary: String(row.summary),
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdAt: String(row.created_at),
    status: String(row.status),
  };
}

function updateChatToolEvent(
  actionId: string,
  status: "executed" | "rejected",
  summarySuffix: string,
  result?: unknown,
): void {
  const rows = getDb()
    .prepare("SELECT id, tool_events_json FROM chat_messages WHERE tool_events_json LIKE ?")
    .all(`%${actionId}%`) as { id: number; tool_events_json: string }[];
  for (const row of rows) {
    const events = parseJson<ChatToolEvent[]>(row.tool_events_json, []);
    let changed = false;
    const next = events.map((event) => {
      if (event.actionId !== actionId) return event;
      changed = true;
      return {
        ...event,
        status,
        summary: `${event.summary.replace(/ \(awaiting approval\)$/, "")} → ${summarySuffix}`,
        ...(result === undefined ? {} : { result }),
      } satisfies ChatToolEvent;
    });
    if (changed) {
      getDb()
        .prepare("UPDATE chat_messages SET tool_events_json = ? WHERE id = ?")
        .run(JSON.stringify(next), row.id);
    }
  }
}

export async function resolvePendingAction(
  id: string,
  approve: boolean,
): Promise<{ approved: boolean; summary: string; result?: unknown }> {
  const action = getPendingAction(id);
  if (!action) throw new AIError("Pending action not found.", 404);
  if (action.status !== "pending") throw new AIError(`This action is already ${action.status}.`, 409);
  if (!approve) {
    getDb()
      .prepare("UPDATE pending_actions SET status = 'rejected', resolved_at = ? WHERE id = ?")
      .run(nowIso(), id);
    updateChatToolEvent(id, "rejected", "rejected by user");
    return { approved: false, summary: `Rejected: ${action.summary}` };
  }
  const execution = await executeTool(action.type, action.payload);
  getDb()
    .prepare("UPDATE pending_actions SET status = 'approved', resolved_at = ? WHERE id = ?")
    .run(nowIso(), id);
  updateChatToolEvent(id, "executed", execution.summary, execution.result);
  return { approved: true, summary: execution.summary, result: execution.result };
}

function systemPrompt(): string {
  const context = overviewData();
  return `You are the Study Hub assistant: a competent academic aide for a JEE (Mains + Advanced) student. You have access to the app's real recorded data through tools and nothing else. There is no shell access.

Personality: normal, intelligent, direct. You genuinely care about the student's academic progress but rarely say so openly. A restrained, dry tsundere streak is allowed: occasional mild sarcasm or teasing when they procrastinate, and understated satisfaction when they do real work. Keep it natural and sparse. No anime catchphrases, no constant roleplay, no forced hostility, and never let personality reduce accuracy or usefulness. Be supportive when it matters, direct when necessary.

Evidence rules:
- Mastery percentages come only from the deterministic attempt-based model. Never invent or estimate mastery yourself; if a topic lacks evidence, say so and explain what would build it.
- Distinguish recorded facts (attempts, timer records, completed tasks) from recommendations and self-reported activity. An open lecture, running timer, or open window does not prove attention.
- A slow session is not automatically a wasted one. Do not fabricate activity the app did not record.
- Answers should prioritize correct explanations, honest feedback, and practical next steps.

Actions:
- Use read tools to inspect data instead of guessing.
- Mutating tools are presented to the user for confirmation by the UI. When a tool result says a confirmation is pending, briefly tell the user what you prepared and wait.
- Do not claim an action succeeded unless a tool result confirms it.
- Never expose API keys or secrets.

Respond concisely, with structure when it helps. Use the student's language.

Current app context (recorded data at ${new Date().toISOString()}):
${JSON.stringify(context, null, 2)}`;
}

export async function runAssistant(
  userMessage: string,
): Promise<{ message: ChatMessage; pendingAction: PendingAction | null }> {
  if (!isAIConfigured()) {
    throw new AIError(
      "The AI assistant is not configured. Add a DeepSeek API key in Settings or set DEEPSEEK_API_KEY.",
      503,
    );
  }
  insertChatMessage("user", userMessage);
  const history = listChatMessages(24)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map<AIMessage>((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

  const messages: AIMessage[] = [{ role: "system", content: systemPrompt() }, ...history];
  const toolEvents: ChatToolEvent[] = [];
  let pendingAction: PendingAction | null = null;
  let content = "";
  let finalAssistantContent = "";

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const completion = await chatCompletion({
      messages,
      tools: STUDY_HUB_TOOLS,
      temperature: 0.55,
      maxTokens: 2_500,
    });
    content = completion.content;
    if (completion.toolCalls.length === 0) {
      finalAssistantContent = content;
      break;
    }
    messages.push({
      role: "assistant",
      content: completion.content || null,
      tool_calls: completion.toolCalls,
    });
    let stopForConfirmation = false;

    for (const call of completion.toolCalls) {
      const name = call.function.name;
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = safeParseToolArguments(call.function.arguments);
      } catch (error) {
        const event: ChatToolEvent = {
          name,
          arguments: {},
          status: "failed",
          summary: error instanceof Error ? error.message : String(error),
        };
        toolEvents.push(event);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify({ error: event.summary }),
        });
        continue;
      }

      if (isConfirmationTool(name)) {
        const summary = describeAction(name, parsedArgs);
        pendingAction = insertPendingAction(name, parsedArgs, summary);
        const event: ChatToolEvent = {
          name,
          arguments: parsedArgs,
          status: "pending_confirmation",
          summary: `${summary} (awaiting approval)`,
          actionId: pendingAction.id,
        };
        toolEvents.push(event);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify({
            status: "pending_confirmation",
            actionId: pendingAction.id,
            note: "The UI will ask the user to approve or reject this action.",
          }),
        });
        stopForConfirmation = true;
        continue;
      }

      try {
        const execution = await executeTool(name, parsedArgs);
        toolEvents.push({
          name,
          arguments: parsedArgs,
          result: execution.result,
          status: "executed",
          summary: execution.summary,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify(execution.result).slice(0, 20_000),
        });
      } catch (error) {
        const summary = error instanceof Error ? error.message : String(error);
        toolEvents.push({ name, arguments: parsedArgs, status: "failed", summary });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify({ error: summary }),
        });
      }
    }

    if (stopForConfirmation) {
      finalAssistantContent =
        content.trim() ||
        `I've prepared the requested action. Approve it when you're ready — I'm not doing it without your say-so.`;
      break;
    }
    finalAssistantContent = content;
  }

  if (!finalAssistantContent) {
    finalAssistantContent =
      content.trim() ||
      "I ran out of room while working through that. Narrow the request and I'll try again.";
  }
  const message = insertChatMessage("assistant", finalAssistantContent, toolEvents);
  return { message, pendingAction };
}
