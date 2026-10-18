export type Difficulty = "easy" | "medium" | "hard";
export type Correctness = "correct" | "partial" | "incorrect" | "skipped";
export type QuestionType = "mcq" | "numeric" | "short" | "long";
export type QuestionStatus = "draft" | "needs_review" | "approved" | "archived";
export type QuestionSource = "manual" | "uploaded" | "generated";
export type TaskType =
  | "study"
  | "homework"
  | "assignment"
  | "project"
  | "test"
  | "exam"
  | "revision";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskSource = "manual" | "ai";
export type ExamScope = "mains_advanced" | "mains" | "advanced";
export type MistakeType =
  | "concept"
  | "calculation"
  | "silly"
  | "misread"
  | "time"
  | "guess"
  | "other";
export type Confidence = "low" | "medium" | "high";
export type TimerMode = "focus" | "break";
export type TimerState = "idle" | "running" | "paused";
export type SessionStatus = "active" | "ended";

export interface Subject {
  id: number;
  name: string;
  code: string;
  color: string | null;
  orderIndex: number;
}

export interface Chapter {
  id: number;
  subjectId: number;
  subjectName?: string;
  subjectCode?: string;
  name: string;
  code: string;
  description: string;
  orderIndex: number;
  examScope: ExamScope;
  subtopicCount?: number;
}

export interface Subtopic {
  id: number;
  chapterId: number;
  name: string;
  description: string;
  weight: number;
  orderIndex: number;
}

export interface Question {
  id: number;
  subjectId: number;
  chapterId: number | null;
  subtopicId: number | null;
  subjectName?: string | null;
  chapterName?: string | null;
  subtopicName?: string | null;
  sourceType: QuestionSource;
  sourceRef: string | null;
  prompt: string;
  options: string[] | null;
  answer: string;
  solution: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  marks: number | null;
  status: QuestionStatus;
  flags: string[];
  createdAt: string;
  updatedAt: string;
  attemptCount?: number;
  lastAttemptAt?: string | null;
  lastCorrectness?: Correctness | null;
}

export interface Attempt {
  id: number;
  questionId: number;
  sessionId: number | null;
  subtopicId: number | null;
  answer: string;
  correctness: Correctness;
  confidence: Confidence | null;
  mistakeType: MistakeType | null;
  hintsUsed: number;
  solutionViewed: boolean;
  timeSpentSeconds: number;
  createdAt: string;
  questionPrompt?: string;
  difficulty?: Difficulty;
  subtopicName?: string | null;
  chapterName?: string | null;
  subjectName?: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  type: TaskType;
  subjectId: number | null;
  chapterId: number | null;
  subtopicId: number | null;
  subjectName?: string | null;
  chapterName?: string | null;
  dueAt: string | null;
  priority: 1 | 2 | 3;
  status: TaskStatus;
  estimatedMinutes: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  source: TaskSource;
  urgencyScore?: number;
}

export interface StudySession {
  id: number;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  focusSeconds: number;
  breakSeconds: number;
  liveFocusSeconds: number;
  liveBreakSeconds: number;
  timerState: TimerState;
  timerMode: TimerMode;
  timerStartedAt: string | null;
  plannedTaskIds: number[];
  notes: string;
  summary: SessionSummary | null;
  createdAt: string;
}

export interface SessionSummary {
  generatedAt: string;
  focusMinutes: number;
  breakMinutes: number;
  attempts: number;
  correct: number;
  partial: number;
  incorrect: number;
  accuracy: number | null;
  hintsUsed: number;
  solutionsViewed: number;
  tasksCompleted: number;
  tasksPlanned: number;
  topicsStudied: string[];
  selfReported: string;
  evidenceNote: string;
}

export interface MasteryBreakdown {
  subtopicId: number;
  subtopicName?: string;
  chapterId?: number;
  chapterName?: string;
  attempts: number;
  distinctQuestions: number;
  evidence: number;
  confidence: number;
  mastery: number | null;
  sufficient: boolean;
  reason: string | null;
  weightedCorrectness: number | null;
  recentAccuracy: number | null;
  lastAttemptAt: string | null;
  mistakes: { type: string; count: number }[];
}

export interface DifficultyStats {
  attempts: number;
  correct: number;
  partial: number;
  incorrect: number;
  accuracy: number | null;
}

export interface ChapterMastery {
  chapterId: number;
  mastery: number | null;
  subtopicsMeasured: number;
  subtopicsTotal: number;
  coverage: number;
  evidence: number;
  confidence: number;
  sufficient: boolean;
  reason: string | null;
}

export interface ChapterWithMastery extends Chapter {
  mastery: ChapterMastery;
  subtopics?: { id: number; name: string }[];
}

export interface SubjectWithMastery extends Subject {
  chapterCount: number;
  subtopicCount: number;
  measuredSubtopics: number;
  mastery: number | null;
  coverage: number;
  evidence: number;
}

export interface BriefingItem {
  kind: "overdue" | "deadline" | "weak" | "review" | "goal" | "session" | "info";
  title: string;
  detail: string;
  href?: string;
}

export interface DailyBriefing {
  generatedAt: string;
  items: BriefingItem[];
  basis: string[];
}

export interface DashboardData {
  now: string;
  activeSession: StudySession | null;
  activeSubject: string | null;
  todayTasks: Task[];
  overdueTasks: Task[];
  upcomingDeadlines: Task[];
  upcomingExams: Task[];
  subjects: SubjectWithMastery[];
  weakTopics: MasteryBreakdown[];
  recentAttempts: Attempt[];
  recentSessions: StudySession[];
  weeklyActivity: { date: string; focusMinutes: number; attempts: number; tasksCompleted: number }[];
  stats: {
    focusMinutes7d: number;
    attempts7d: number;
    accuracy7d: number | null;
    tasksCompleted7d: number;
    evidenceDays: number;
    measuredSubtopics: number;
    totalSubtopics: number;
  };
  dailyGoalMinutes: number;
  dailyFocusMinutes: number;
  dailyBriefing: DailyBriefing;
  recentlyStudied: MasteryBreakdown[];
}

export interface ChapterDetail {
  chapter: Chapter;
  subject: Subject;
  mastery: ChapterMastery;
  subtopics: (Subtopic & { mastery: MasteryBreakdown })[];
  difficultyStats: Record<Difficulty, DifficultyStats>;
  recentAttempts: Attempt[];
  mistakeSummary: { type: string; count: number }[];
  history: { date: string; mastery: number | null; coverage: number; evidence: number }[];
}

export interface SyllabusData {
  subjects: SubjectWithMastery[];
  chapters: ChapterWithMastery[];
  coverage: {
    totalSubtopics: number;
    measuredSubtopics: number;
    evidenceAttempts: number;
  };
}

export interface ThemePayload {
  available: boolean;
  fallback: boolean;
  source: string | null;
  name: string | null;
  mode: string | null;
  flavour: string | null;
  variant: string | null;
  colours: Record<string, string> | null;
  updatedAt: string;
  error?: string;
}

export interface AISettings {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  providerLabel: string;
  extractionModel: string;
  updatedAt: string | null;
}

export interface AppSettings {
  dailyGoalMinutes: number;
  defaultFocusMinutes: number;
  defaultBreakMinutes: number;
  dataDir: string;
  launcherConfigPath: string;
  schemaVersion: number;
  ai: AISettings;
}

export interface ChatToolEvent {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: "executed" | "pending_confirmation" | "rejected" | "failed";
  summary: string;
  actionId?: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolEvents: ChatToolEvent[];
  createdAt: string;
}

export interface PendingAction {
  id: string;
  type: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ChatResponse {
  message: ChatMessage;
  pendingAction: PendingAction | null;
  error?: string;
}

export interface QuestionGenerationRequest {
  subjectId?: number;
  chapterId?: number;
  subtopicId?: number;
  difficulty?: Difficulty | "mixed";
  questionType?: QuestionType | "mixed";
  count?: number;
  focusWeakAreas?: boolean;
  instructions?: string;
}

export interface ExtractedQuestion {
  prompt: string;
  options: string[] | null;
  answer: string;
  solution: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  marks: number | null;
  subjectId: number | null;
  chapterId: number | null;
  subtopicId: number | null;
  subjectName: string | null;
  chapterName: string | null;
  subtopicName: string | null;
  confidence: number;
  flags: string[];
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  warnings: string[];
  sourceName: string | null;
  storedQuestionIds: number[];
}

export interface AIStatus {
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKeyHint: string | null;
  lastError: string | null;
}

export interface LauncherBrowserConfig {
  command?: string;
  fallback?: string[];
  windowClassIncludes?: string[];
  newWindowFlag?: string;
}

export interface LauncherServerConfig {
  host?: string;
  port?: number;
  dataDir?: string | null;
  startIfNeeded?: boolean;
}

export interface LauncherWorkspaceConfig {
  key: string;
  label?: string;
  target: number;
  url?: string;
  match?: string[];
  enabled?: boolean;
}

export interface LauncherConfig {
  browser?: LauncherBrowserConfig;
  server?: LauncherServerConfig;
  workspaces?: LauncherWorkspaceConfig[];
  occupiedStrategy?: "overflow" | "relocate" | "use";
  overflow?: { enabled?: boolean; start?: number };
  focusWorkspace?: number | "auto";
  windowWaitMs?: number;
  launchDelayMs?: number;
  createSession?: boolean;
}

export interface LauncherSummary {
  path: string;
  exists: boolean;
  config: LauncherConfig | null;
  error: string | null;
}

export const WEAK_MASTERY_THRESHOLD = 65;

export function isWeakMastery(
  item: Pick<MasteryBreakdown, "sufficient" | "mastery">,
  threshold = WEAK_MASTERY_THRESHOLD,
): boolean {
  return item.sufficient && item.mastery !== null && item.mastery < threshold;
}

export const MISTAKE_TYPES: { value: MistakeType; label: string }[] = [
  { value: "concept", label: "Concept gap" },
  { value: "calculation", label: "Calculation" },
  { value: "silly", label: "Silly mistake" },
  { value: "misread", label: "Misread question" },
  { value: "time", label: "Ran out of time" },
  { value: "guess", label: "Guessed" },
  { value: "other", label: "Other" },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  study: "Study",
  homework: "Homework",
  assignment: "Assignment",
  project: "Project",
  test: "Test",
  exam: "Exam",
  revision: "Revision",
};
