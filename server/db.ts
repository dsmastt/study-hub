import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import type {
  AppSettings,
  Attempt,
  Chapter,
  Confidence,
  Correctness,
  Difficulty,
  ExamScope,
  Question,
  QuestionSource,
  QuestionStatus,
  QuestionType,
  SessionSummary,
  StudySession,
  Subject,
  Subtopic,
  Task,
  TaskSource,
  TaskStatus,
  TaskType,
  TimerMode,
  TimerState,
} from "../shared/types.ts";
import { JEE_SYLLABUS } from "./seed.ts";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = process.env.STUDY_HUB_DATA_DIR
  ? path.resolve(process.env.STUDY_HUB_DATA_DIR)
  : path.join(ROOT_DIR, "data");
export const DB_PATH = path.join(DATA_DIR, "study-hub.db");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const SCHEMA_VERSION = 2;

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
for (const directory of [DATA_DIR, BACKUP_DIR]) {
  try {
    fs.chmodSync(directory, 0o700);
  } catch (error) {
    console.warn(`Could not set permissions on ${directory}:`, error);
  }
}
try {
  for (const entry of fs.readdirSync(BACKUP_DIR, { withFileTypes: true })) {
    if (entry.isFile()) fs.chmodSync(path.join(BACKUP_DIR, entry.name), 0o600);
  }
} catch (error) {
  console.warn(`Could not secure existing backups in ${BACKUP_DIR}:`, error);
}

function chmodIfExists(file: string, mode: number): void {
  try {
    if (fs.existsSync(file)) fs.chmodSync(file, mode);
  } catch (error) {
    console.warn(`Could not set permissions on ${file}:`, error);
  }
}

let db: DatabaseSync | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  color TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  exam_scope TEXT NOT NULL DEFAULT 'mains_advanced',
  UNIQUE(subject_id, code)
);

CREATE TABLE IF NOT EXISTS subtopics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  weight REAL NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE(chapter_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  focus_seconds INTEGER NOT NULL DEFAULT 0,
  break_seconds INTEGER NOT NULL DEFAULT 0,
  timer_state TEXT NOT NULL DEFAULT 'idle',
  timer_mode TEXT NOT NULL DEFAULT 'focus',
  timer_started_at TEXT,
  planned_task_ids_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  summary_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  subtopic_id INTEGER REFERENCES subtopics(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  prompt TEXT NOT NULL,
  options_json TEXT,
  answer TEXT NOT NULL DEFAULT '',
  solution TEXT NOT NULL DEFAULT '',
  question_type TEXT NOT NULL DEFAULT 'mcq',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  marks REAL,
  status TEXT NOT NULL DEFAULT 'approved',
  flags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  subtopic_id INTEGER REFERENCES subtopics(id) ON DELETE SET NULL,
  answer TEXT NOT NULL DEFAULT '',
  correctness TEXT NOT NULL,
  difficulty TEXT,
  confidence TEXT,
  mistake_type TEXT,
  hints_used INTEGER NOT NULL DEFAULT 0,
  solution_viewed INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'study',
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  subtopic_id INTEGER REFERENCES subtopics(id) ON DELETE SET NULL,
  due_at TEXT,
  priority INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_minutes INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subtopic_id INTEGER NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  mastery REAL,
  evidence REAL NOT NULL,
  confidence REAL NOT NULL,
  attempts_count INTEGER NOT NULL,
  computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_events_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id, order_index);
CREATE INDEX IF NOT EXISTS idx_subtopics_chapter ON subtopics(chapter_id, order_index);
CREATE INDEX IF NOT EXISTS idx_attempts_subtopic ON attempts(subtopic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_subtopic ON questions(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_subtopic ON progress_snapshots(subtopic_id, computed_at);
`;

const DEFAULT_SETTINGS: Record<string, string> = {
  dailyGoalMinutes: "120",
  defaultFocusMinutes: "25",
  defaultBreakMinutes: "5",
  aiBaseUrl: "https://api.deepseek.com",
  aiModel: "deepseek-chat",
  aiExtractionModel: "deepseek-chat",
  aiApiKey: "",
};

function readSchemaVersion(database: DatabaseSync): number {
  try {
    const row = database.prepare("SELECT value FROM meta WHERE key = 'schemaVersion'").get() as
      | { value?: string }
      | undefined;
    return Number(row?.value ?? 0);
  } catch {
    return 0;
  }
}

export function initDb(): DatabaseSync {
  if (db) return db;
  const existing = fs.existsSync(DB_PATH);
  db = new DatabaseSync(DB_PATH);
  chmodIfExists(DB_PATH, 0o600);
  chmodIfExists(`${DB_PATH}-wal`, 0o600);
  chmodIfExists(`${DB_PATH}-shm`, 0o600);
  const existingVersion = existing ? readSchemaVersion(db) : 0;

  if (existingVersion > SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${existingVersion} is newer than this app supports (${SCHEMA_VERSION}). Refusing to modify data.`,
    );
  }
  if (existing && existingVersion < SCHEMA_VERSION) {
    try {
      backupDatabase(`pre-migration-v${existingVersion}`);
    } catch (error) {
      throw new Error(
        `Pre-migration backup failed; refusing to modify the database: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  db.exec(SCHEMA);
  chmodIfExists(DB_PATH, 0o600);
  chmodIfExists(`${DB_PATH}-wal`, 0o600);
  chmodIfExists(`${DB_PATH}-shm`, 0o600);

  const columns = db.prepare("PRAGMA table_info(attempts)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "difficulty")) {
    db.exec("ALTER TABLE attempts ADD COLUMN difficulty TEXT");
  }

  const appliedVersion = readSchemaVersion(db);
  if (appliedVersion < SCHEMA_VERSION) {
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('schemaVersion', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(String(SCHEMA_VERSION));
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  seedSyllabus(db);
  return db;
}

function seedSyllabus(database: DatabaseSync): void {
  const count = (database.prepare("SELECT COUNT(*) AS count FROM subjects").get() as { count: number }).count;
  if (count > 0) return;

  const insertSubject = database.prepare(
    "INSERT INTO subjects (name, code, color, order_index) VALUES (?, ?, ?, ?)",
  );
  const insertChapter = database.prepare(
    "INSERT INTO chapters (subject_id, name, code, description, order_index, exam_scope) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertSubtopic = database.prepare(
    "INSERT INTO subtopics (chapter_id, name, description, weight, order_index) VALUES (?, ?, ?, ?, ?)",
  );

  database.exec("BEGIN");
  try {
    JEE_SYLLABUS.forEach((subject, subjectIndex) => {
      const subjectResult = insertSubject.run(subject.name, subject.code, null, subjectIndex);
      const subjectId = Number(subjectResult.lastInsertRowid);
      subject.chapters.forEach((chapter, chapterIndex) => {
        const chapterResult = insertChapter.run(
          subjectId,
          chapter.name,
          chapter.code,
          chapter.description,
          chapterIndex,
          chapter.examScope,
        );
        const chapterId = Number(chapterResult.lastInsertRowid);
        chapter.subtopics.forEach((rawSubtopic, subtopicIndex) => {
          const subtopic = typeof rawSubtopic === "string" ? { name: rawSubtopic } : rawSubtopic;
          insertSubtopic.run(
            chapterId,
            subtopic.name,
            subtopic.description ?? "",
            subtopic.weight ?? 1,
            subtopicIndex,
          );
        });
      });
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getDb(): DatabaseSync {
  return db ?? initDb();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function getAIConfig(): {
  baseUrl: string;
  model: string;
  extractionModel: string;
  apiKey: string;
  providerLabel: string;
} {
  const baseUrl =
    process.env.STUDY_HUB_AI_BASE_URL ??
    process.env.DEEPSEEK_BASE_URL ??
    getSetting("aiBaseUrl") ??
    "https://api.deepseek.com";
  const model =
    process.env.STUDY_HUB_AI_MODEL ?? process.env.DEEPSEEK_MODEL ?? getSetting("aiModel") ?? "deepseek-chat";
  const extractionModel =
    process.env.STUDY_HUB_AI_EXTRACTION_MODEL ?? getSetting("aiExtractionModel") ?? model;
  const apiKey =
    process.env.STUDY_HUB_AI_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    getSetting("aiApiKey") ??
    "";
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    extractionModel,
    apiKey,
    providerLabel: "DeepSeek-compatible",
  };
}

export function publicAISettings(): {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  providerLabel: string;
  extractionModel: string;
  updatedAt: string | null;
} {
  const config = getAIConfig();
  const key = config.apiKey;
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: key.length > 0,
    apiKeyHint: key.length >= 4 ? `••••${key.slice(-4)}` : key.length > 0 ? "••••" : null,
    providerLabel: config.providerLabel,
    extractionModel: config.extractionModel,
    updatedAt: getSetting("aiUpdatedAt"),
  };
}

export function launcherConfigPath(): string {
  return (
    process.env.STUDY_HUB_LAUNCHER_CONFIG ??
    path.join(os.homedir(), ".config", "study-hub", "launcher.json")
  );
}

export function getPublicSettings(): AppSettings {
  return {
    dailyGoalMinutes: Number(getSetting("dailyGoalMinutes") ?? 120),
    defaultFocusMinutes: Number(getSetting("defaultFocusMinutes") ?? 25),
    defaultBreakMinutes: Number(getSetting("defaultBreakMinutes") ?? 5),
    dataDir: DATA_DIR,
    launcherConfigPath: launcherConfigPath(),
    schemaVersion: SCHEMA_VERSION,
    ai: publicAISettings(),
  };
}

export function backupDatabase(reason = "manual"): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}-${String(
    now.getMilliseconds(),
  ).padStart(3, "0")}`;
  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  const target = path.join(BACKUP_DIR, `study-hub-${stamp}-${suffix}-${safeReason}.db`);
  getDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  try {
    fs.chmodSync(target, 0o600);
  } catch (error) {
    console.warn(`Could not set permissions on backup ${target}:`, error);
  }
  return target;
}

export function rowToSubject(row: Record<string, unknown>): Subject {
  return {
    id: Number(row.id),
    name: String(row.name),
    code: String(row.code),
    color: row.color === null ? null : String(row.color),
    orderIndex: Number(row.order_index),
  };
}

export function rowToChapter(row: Record<string, unknown>): Chapter {
  return {
    id: Number(row.id),
    subjectId: Number(row.subject_id),
    subjectName: row.subject_name === undefined ? undefined : String(row.subject_name),
    subjectCode: row.subject_code === undefined ? undefined : String(row.subject_code),
    name: String(row.name),
    code: String(row.code),
    description: String(row.description ?? ""),
    orderIndex: Number(row.order_index),
    examScope: String(row.exam_scope) as ExamScope,
    subtopicCount: row.subtopic_count === undefined ? undefined : Number(row.subtopic_count),
  };
}

export function rowToSubtopic(row: Record<string, unknown>): Subtopic {
  return {
    id: Number(row.id),
    chapterId: Number(row.chapter_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    weight: Number(row.weight),
    orderIndex: Number(row.order_index),
  };
}

export function rowToQuestion(row: Record<string, unknown>): Question {
  return {
    id: Number(row.id),
    subjectId: Number(row.subject_id),
    chapterId: row.chapter_id === null ? null : Number(row.chapter_id),
    subtopicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
    subjectName: row.subject_name === undefined || row.subject_name === null ? null : String(row.subject_name),
    chapterName: row.chapter_name === undefined || row.chapter_name === null ? null : String(row.chapter_name),
    subtopicName: row.subtopic_name === undefined || row.subtopic_name === null ? null : String(row.subtopic_name),
    sourceType: String(row.source_type) as QuestionSource,
    sourceRef: row.source_ref === null ? null : String(row.source_ref),
    prompt: String(row.prompt),
    options: row.options_json === null ? null : parseJson<string[] | null>(row.options_json, null),
    answer: String(row.answer ?? ""),
    solution: String(row.solution ?? ""),
    questionType: String(row.question_type) as QuestionType,
    difficulty: String(row.difficulty) as Difficulty,
    marks: row.marks === null ? null : Number(row.marks),
    status: String(row.status) as QuestionStatus,
    flags: parseJson<string[]>(row.flags_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    attemptCount: row.attempt_count === undefined ? undefined : Number(row.attempt_count),
    lastAttemptAt: row.last_attempt_at === undefined || row.last_attempt_at === null ? null : String(row.last_attempt_at),
    lastCorrectness:
      row.last_correctness === undefined || row.last_correctness === null
        ? null
        : (String(row.last_correctness) as Correctness),
  };
}

export function rowToAttempt(row: Record<string, unknown>): Attempt {
  return {
    id: Number(row.id),
    questionId: Number(row.question_id),
    sessionId: row.session_id === null ? null : Number(row.session_id),
    subtopicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
    answer: String(row.answer ?? ""),
    correctness: String(row.correctness) as Correctness,
    confidence: row.confidence === null ? null : (String(row.confidence) as Confidence),
    mistakeType: row.mistake_type === null ? null : (String(row.mistake_type) as Attempt["mistakeType"]),
    hintsUsed: Number(row.hints_used),
    solutionViewed: Number(row.solution_viewed) === 1,
    timeSpentSeconds: Number(row.time_spent_seconds),
    createdAt: String(row.created_at),
    questionPrompt: row.question_prompt === undefined ? undefined : String(row.question_prompt),
    difficulty: row.difficulty === undefined ? undefined : (String(row.difficulty) as Difficulty),
    subtopicName: row.subtopic_name === undefined || row.subtopic_name === null ? null : String(row.subtopic_name),
    chapterName: row.chapter_name === undefined || row.chapter_name === null ? null : String(row.chapter_name),
    subjectName: row.subject_name === undefined || row.subject_name === null ? null : String(row.subject_name),
  };
}

export function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    type: String(row.type) as TaskType,
    subjectId: row.subject_id === null ? null : Number(row.subject_id),
    chapterId: row.chapter_id === null ? null : Number(row.chapter_id),
    subtopicId: row.subtopic_id === null ? null : Number(row.subtopic_id),
    subjectName: row.subject_name === undefined || row.subject_name === null ? null : String(row.subject_name),
    chapterName: row.chapter_name === undefined || row.chapter_name === null ? null : String(row.chapter_name),
    dueAt: row.due_at === null || row.due_at === undefined ? null : String(row.due_at),
    priority: Number(row.priority) as 1 | 2 | 3,
    status: String(row.status) as TaskStatus,
    estimatedMinutes: row.estimated_minutes === null || row.estimated_minutes === undefined ? null : Number(row.estimated_minutes),
    completedAt: row.completed_at === null || row.completed_at === undefined ? null : String(row.completed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    source: String(row.source) as TaskSource,
  };
}

export function elapsedSeconds(timerState: TimerState, timerStartedAt: string | null, now = Date.now()): number {
  if (timerState !== "running" || !timerStartedAt) return 0;
  const started = new Date(timerStartedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((now - started) / 1000));
}

export function rowToSession(row: Record<string, unknown>): StudySession {
  const timerState = String(row.timer_state) as TimerState;
  const timerMode = String(row.timer_mode) as TimerMode;
  const timerStartedAt = row.timer_started_at === null ? null : String(row.timer_started_at);
  const live = elapsedSeconds(timerState, timerStartedAt);
  const focusSeconds = Number(row.focus_seconds);
  const breakSeconds = Number(row.break_seconds);
  return {
    id: Number(row.id),
    startedAt: String(row.started_at),
    endedAt: row.ended_at === null ? null : String(row.ended_at),
    status: String(row.status) as StudySession["status"],
    focusSeconds,
    breakSeconds,
    liveFocusSeconds: focusSeconds + (timerState === "running" && timerMode === "focus" ? live : 0),
    liveBreakSeconds: breakSeconds + (timerState === "running" && timerMode === "break" ? live : 0),
    timerState,
    timerMode,
    timerStartedAt,
    plannedTaskIds: parseJson<number[]>(row.planned_task_ids_json, []),
    notes: String(row.notes ?? ""),
    summary: row.summary_json === null ? null : parseJson<SessionSummary | null>(row.summary_json, null),
    createdAt: String(row.created_at),
  };
}
