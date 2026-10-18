import type {
  AIStatus,
  AppSettings,
  Attempt,
  ChapterDetail,
  ChatMessage,
  ChatResponse,
  DashboardData,
  ExtractionResult,
  LauncherSummary,
  MasteryBreakdown,
  Question,
  QuestionGenerationRequest,
  StudySession,
  SyllabusData,
  Task,
  ThemePayload,
} from "../../shared/types.ts";

export class ApiError extends Error {
  status: number;
  issues: { path: string; message: string }[];

  constructor(message: string, status: number, issues: { path: string; message: string }[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      try {
        return decodeURIComponent(value.slice(prefix.length));
      } catch {
        return value.slice(prefix.length);
      }
    }
  }
  return null;
}

let apiToken: string | null = null;
let tokenRequest: Promise<string | null> | null = null;

async function ensureApiToken(force = false): Promise<string | null> {
  if (!force && (apiToken || readCookie("study_hub_token"))) {
    apiToken = readCookie("study_hub_token");
    return apiToken;
  }
  if (!tokenRequest) {
    tokenRequest = fetch("/api/health", { credentials: "same-origin", cache: "no-store" })
      .then(() => {
        apiToken = readCookie("study_hub_token");
        return apiToken;
      })
      .catch(() => null)
      .finally(() => {
        tokenRequest = null;
      });
  }
  return tokenRequest;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const isApi = path.startsWith("/api/");
  const send = async () => {
    const token = isApi ? await ensureApiToken() : null;
    const requestHeaders = new Headers(headers);
    if (token) requestHeaders.set("X-Study-Hub-Token", token);
    return fetch(path, { ...options, headers: requestHeaders, credentials: "same-origin" });
  };
  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && isApi) {
      await ensureApiToken(true);
      response = await send();
    }
  } catch (error) {
    throw new ApiError(
      `Could not reach the Study Hub server. Is it running? ${error instanceof Error ? error.message : ""}`.trim(),
      0,
    );
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const payload = data as { error?: string; issues?: { path: string; message: string }[] } | null;
    throw new ApiError(
      payload?.error ?? `Request failed with HTTP ${response.status}.`,
      response.status,
      payload?.issues ?? [],
    );
  }
  return data as T;
}

export function withQuery(path: string, params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export interface QuestionFilters {
  [key: string]: unknown;
  questionId?: number;
  subjectId?: number;
  chapterId?: number;
  subtopicId?: number;
  difficulty?: string;
  status?: string;
  sourceType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TaskFilters {
  [key: string]: unknown;
  status?: string;
  type?: string;
  dueFrom?: string;
  dueTo?: string;
  limit?: number;
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  syllabus: () => request<SyllabusData>("/api/syllabus"),
  chapter: (id: number) => request<ChapterDetail>(`/api/chapters/${id}`),
  updateChapter: (id: number, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/chapters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  addSubtopic: (chapterId: number, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/chapters/${chapterId}/subtopics`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSubtopic: (id: number, input: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/subtopics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteSubtopic: (id: number) =>
    request<{ ok: boolean }>(`/api/subtopics/${id}`, { method: "DELETE" }),

  questions: (filters: QuestionFilters = {}) =>
    request<{ questions: Question[]; total: number }>(withQuery("/api/questions", filters)),
  question: (id: number) =>
    request<{ question: Question; attempts: Attempt[] }>(`/api/questions/${id}`),
  createQuestion: (input: Record<string, unknown>) =>
    request<Question>("/api/questions", { method: "POST", body: JSON.stringify(input) }),
  updateQuestion: (id: number, input: Record<string, unknown>) =>
    request<Question>(`/api/questions/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  attempts: (params: Record<string, unknown> = {}) =>
    request<Attempt[]>(withQuery("/api/attempts", params)),
  createAttempt: (input: Record<string, unknown>) =>
    request<{ attempt: Attempt; mastery: MasteryBreakdown }>("/api/attempts", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  tasks: (filters: TaskFilters = {}) => request<Task[]>(withQuery("/api/tasks", filters)),
  createTask: (input: Record<string, unknown>) =>
    request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: number, input: Record<string, unknown>) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteTask: (id: number) => request<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),

  sessions: (limit = 30) => request<StudySession[]>(`/api/sessions?limit=${limit}`),
  activeSession: () => request<StudySession | null>("/api/sessions/active"),
  session: (id: number) =>
    request<{ session: StudySession; attempts: Attempt[]; plannedTasks: Task[] }>(
      `/api/sessions/${id}`,
    ),
  startSession: () => request<{ session: StudySession; created: boolean }>("/api/sessions/start", { method: "POST" }),
  startTimer: (id: number, mode: "focus" | "break") =>
    request<StudySession>(`/api/sessions/${id}/timer/start`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  pauseTimer: (id: number) =>
    request<StudySession>(`/api/sessions/${id}/timer/pause`, { method: "POST" }),
  resumeTimer: (id: number) =>
    request<StudySession>(`/api/sessions/${id}/timer/resume`, { method: "POST" }),
  endSession: (id: number) => request<StudySession>(`/api/sessions/${id}/end`, { method: "POST" }),
  updateSession: (id: number, input: Record<string, unknown>) =>
    request<StudySession>(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  settings: () => request<AppSettings>("/api/settings"),
  updateSettings: (input: Record<string, unknown>) =>
    request<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(input) }),
  backup: () => request<{ ok: boolean; path: string }>("/api/settings/backup", { method: "POST" }),
  launcher: () => request<LauncherSummary>("/api/settings/launcher"),
  system: () =>
    request<{
      dataDir: string;
      launcherConfigPath: string;
      theme: { available: boolean; source: string | null; name: string | null; mode: string | null; updatedAt: string };
      hyprland: boolean;
    }>("/api/settings/system"),
  testAI: () => request<{ ok: boolean; message: string; model?: string }>("/api/settings/test-ai", { method: "POST" }),

  theme: () => request<ThemePayload>("/api/theme"),
  aiStatus: () => request<AIStatus>("/api/ai/status"),
  messages: () => request<ChatMessage[]>("/api/ai/messages"),
  clearMessages: () => request<{ ok: boolean }>("/api/ai/messages", { method: "DELETE" }),
  chat: (message: string) =>
    request<ChatResponse>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  approveAction: (id: string) =>
    request<{ approved: boolean; summary: string; result?: unknown }>(`/api/ai/pending/${id}/approve`, {
      method: "POST",
    }),
  rejectAction: (id: string) =>
    request<{ approved: boolean; summary: string }>(`/api/ai/pending/${id}/reject`, { method: "POST" }),
  generateQuestions: (input: QuestionGenerationRequest) =>
    request<{ questions: Question[]; warnings: string[] }>("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  extract: (input: { text?: string; file?: File; sourceName?: string }) => {
    const form = new FormData();
    if (input.file) form.append("file", input.file);
    if (input.text) form.append("text", input.text);
    if (input.sourceName) form.append("sourceName", input.sourceName);
    return request<ExtractionResult>("/api/ai/extract", { method: "POST", body: form });
  },
};
