import { Link, NavLink } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  Flame,
  Gauge,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import type { BriefingItem } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useDashboard } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { TimerPanel } from "../components/TimerPanel.tsx";
import { AttemptAccuracyBars, SubjectBars, WeeklyActivityChart } from "../components/charts.tsx";
import {
  Badge,
  Button,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  MasteryBadge,
  Metric,
  Panel,
  PanelHead,
  ProgressBar,
  ScoreBadge,
} from "../components/ui.tsx";
import { fmtDate, fmtDateTime, fmtMinutes, fmtRelative, pct } from "../lib/format.ts";

const briefingIcons: Record<BriefingItem["kind"], typeof Info> = {
  overdue: AlertTriangle,
  deadline: CalendarClock,
  weak: Target,
  review: RotateCcw,
  goal: Gauge,
  session: Timer,
  info: Info,
};

function BriefingRow({ item }: { item: BriefingItem }) {
  const Icon = briefingIcons[item.kind] ?? Info;
  const content = (
    <div className={`briefing-item ${item.kind}`}>
      <div className="briefing-icon">
        <Icon size={13} />
      </div>
      <div className="briefing-body">
        <div className="briefing-title">{item.title}</div>
        <div className="briefing-detail">{item.detail}</div>
      </div>
    </div>
  );
  return item.href ? <Link to={item.href}>{content}</Link> : content;
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useDashboard();
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["session"] }),
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    ]);
  };

  const toggleTask = useMutation({
    mutationFn: (task: { id: number; done: boolean }) =>
      api.updateTask(task.id, { status: task.done ? "pending" : "completed" }),
    onSuccess: invalidate,
  });

  const startFocus = useMutation({
    mutationFn: async () => {
      const { session } = await api.startSession();
      return api.startTimer(session.id, "focus");
    },
    onSuccess: invalidate,
  });

  if (isLoading) return <LoadingPanel label="Loading command center…" />;
  if (error || !data) return <ErrorPanel error={error} retry={() => void refetch()} />;

  const today = new Date(data.now);
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const goalProgress = Math.min(100, (data.dailyFocusMinutes / Math.max(1, data.dailyGoalMinutes)) * 100);
  const coverage = data.stats.totalSubtopics > 0 ? data.stats.measuredSubtopics / data.stats.totalSubtopics : 0;
  const isFresh =
    data.stats.attempts7d === 0 &&
    data.stats.focusMinutes7d === 0 &&
    data.stats.tasksCompleted7d === 0 &&
    data.recentSessions.length === 0;
  const timerRunning = data.activeSession?.timerState === "running";
  const taskCompletionRate =
    data.todayTasks.length > 0
      ? data.todayTasks.filter((task) => task.status === "completed").length / data.todayTasks.length
      : 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            COMMAND CENTER <span className="faint">/</span> {dateLabel}
          </>
        }
        title="Study Hub"
        description="Recorded evidence, current session state, and the next useful move. Nothing here is fabricated: an empty panel means the app has no data yet."
        actions={
          <>
            <Button
              variant="primary"
              icon={<Play size={14} />}
              loading={startFocus.isPending}
              disabled={timerRunning}
              onClick={() => startFocus.mutate()}
            >
              {timerRunning ? "Timer running" : "Start focus"}
            </Button>
            <NavLink to="/assistant">
              <Button variant="subtle" icon={<BrainCircuit size={14} />}>
                Ask assistant
              </Button>
            </NavLink>
          </>
        }
        meta={
          <>
            <span>
              {data.stats.measuredSubtopics} / {data.stats.totalSubtopics} subtopics measured
            </span>
            <span>{data.dailyBriefing.items.length} briefing signals</span>
            <span>focus: {data.activeSubject ?? "unrecorded"}</span>
            <span>theme-linked palette</span>
          </>
        }
      />

      {isFresh && (
        <Panel className="mb-16">
          <div className="between wrap">
            <div>
              <div className="eyebrow">FIRST BOOT / REAL DATA ONLY</div>
              <h2 className="mt-4">
                The command center is ready, but there is no recorded study activity yet.
              </h2>
              <p className="small muted mt-4" style={{ maxWidth: 760 }}>
                Start a session, add a task, or upload/generate questions. Mastery stays hidden until
                a subtopic has at least five attempts across four distinct questions and some
                medium/hard evidence. The app will never fill this space with sample statistics.
              </p>
            </div>
            <div className="row gap-8 wrap">
              <NavLink to="/planner">
                <Button variant="primary" size="sm">
                  Add a task
                </Button>
              </NavLink>
              <NavLink to="/questions?tab=generate">
                <Button size="sm" icon={<Sparkles size={13} />}>
                  Generate questions
                </Button>
              </NavLink>
              <NavLink to="/syllabus">
                <Button size="sm" variant="outline">
                  Open syllabus
                </Button>
              </NavLink>
            </div>
          </div>
        </Panel>
      )}

      <div className="dash-grid">
        <Panel className="span-8">
          <PanelHead
            eyebrow="DAILY BRIEFING"
            title="What matters today"
            subtitle="Deterministically generated from real tasks, attempts, sessions and syllabus coverage."
            actions={
              <Badge tone="primary" dot>
                LIVE RECORD
              </Badge>
            }
          />
          <div className="briefing-list">
            {data.dailyBriefing.items.map((item, index) => (
              <BriefingRow item={item} key={`${item.kind}-${index}`} />
            ))}
            {data.dailyBriefing.items.length === 0 && (
              <EmptyState
                compact
                icon={<CheckCircle2 size={20} />}
                title="Nothing urgent on record"
                description="No overdue tasks, upcoming deadlines, weak evidence-backed topics, or goal gaps were found."
              />
            )}
          </div>
          <details className="briefing-basis">
            <summary style={{ cursor: "pointer" }}>EVIDENCE BASIS</summary>
            <ul className="log-list mt-8">
              {data.dailyBriefing.basis.map((line) => (
                <li key={line}>› {line}</li>
              ))}
            </ul>
          </details>
        </Panel>

        <div className="span-4">
          <TimerPanel session={data.activeSession} />
        </div>

        <div className="span-12">
          <div className="grid cols-5 mobile-2">
            <Metric
              label="Focus / 7d"
              value={fmtMinutes(data.stats.focusMinutes7d)}
              sub="Recorded timer time"
              tone="primary"
              icon={<Timer size={15} />}
            />
            <Metric
              label="Attempts / 7d"
              value={data.stats.attempts7d}
              sub={
                data.stats.accuracy7d === null
                  ? "No attempted questions yet"
                  : `${data.stats.accuracy7d}% weighted accuracy`
              }
              tone={data.stats.attempts7d > 0 ? "info" : "neutral"}
              icon={<FileQuestion size={15} />}
            />
            <Metric
              label="Mastery coverage"
              value={pct(coverage)}
              sub={`${data.stats.measuredSubtopics} of ${data.stats.totalSubtopics} subtopics measured`}
              tone="success"
              icon={<Gauge size={15} />}
            />
            <Metric
              label="Evidence days / 7d"
              value={`${data.stats.evidenceDays}/7`}
              sub="Days with attempts, focus or task evidence"
              tone="warn"
              icon={<Flame size={15} />}
            />
            <Metric
              label="Tasks completed / 7d"
              value={data.stats.tasksCompleted7d}
              sub={`${data.overdueTasks.length} overdue right now`}
              tone={data.overdueTasks.length > 0 ? "danger" : "neutral"}
              icon={<ClipboardList size={15} />}
            />
          </div>
        </div>

        <Panel className="span-7">
          <PanelHead
            eyebrow="TODAY / PLAN"
            title="Today's plan"
            subtitle="Due today plus anything already marked in progress."
            actions={
              <NavLink to="/planner" className="btn btn-subtle btn-sm">
                Open planner
              </NavLink>
            }
          />
          {data.todayTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<ClipboardList size={20} />}
              title="No tasks scheduled for today"
              description="Add a task in the planner or pull one forward from an upcoming deadline."
              action={
                <NavLink to="/planner">
                  <Button size="sm" variant="outline">
                    Plan the day
                  </Button>
                </NavLink>
              }
            />
          ) : (
            <div className="list">
              {data.todayTasks.map((task) => {
                const done = task.status === "completed";
                return (
                  <div className={`task-row ${done ? "done" : ""}`} key={task.id}>
                    <button
                      className={`task-check ${done ? "done" : ""}`}
                      onClick={() => toggleTask.mutate({ id: task.id, done })}
                      aria-label={done ? "Mark pending" : "Mark complete"}
                    >
                      <CheckCircle2 size={11} />
                    </button>
                    <div className="task-body">
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        <span
                          className={
                            task.dueAt && new Date(task.dueAt) < new Date() && !done ? "overdue" : ""
                          }
                        >
                          {task.dueAt
                            ? `${fmtDateTime(task.dueAt)} · ${fmtRelative(task.dueAt)}`
                            : "No due date"}
                        </span>
                        <span>{task.type}</span>
                        {task.subjectName && <span>{task.subjectName}</span>}
                      </div>
                    </div>
                    <Badge
                      tone={task.priority === 1 ? "danger" : task.priority === 2 ? "warn" : "neutral"}
                    >
                      P{task.priority}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
          {data.todayTasks.length > 0 && (
            <div className="mt-12">
              <ProgressBar value={taskCompletionRate * 100} tone="success" />
              <div className="tiny faint mt-4">
                {Math.round(taskCompletionRate * 100)}% of today's known tasks completed.
              </div>
            </div>
          )}
        </Panel>

        <Panel className="span-5">
          <PanelHead
            eyebrow="DEADLINES"
            title="Next commitments"
            actions={
              <NavLink to="/planner" className="btn btn-ghost btn-sm">
                All
              </NavLink>
            }
          />
          {data.upcomingDeadlines.length === 0 &&
          data.overdueTasks.length === 0 &&
          data.upcomingExams.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarClock size={20} />}
              title="No upcoming deadlines"
              description="Assignments, tests and exams added to the planner will appear here."
            />
          ) : (
            <div className="list">
              {data.overdueTasks.slice(0, 2).map((task) => (
                <div className="list-row" key={`overdue-${task.id}`}>
                  <div className="list-row-main">
                    <div className="list-row-title">{task.title}</div>
                    <div className="list-row-sub">
                      <span className="text-danger">Overdue</span>
                      <span>{fmtDateTime(task.dueAt)}</span>
                    </div>
                  </div>
                  <Badge tone="danger">OVERDUE</Badge>
                </div>
              ))}
              {data.upcomingDeadlines.slice(0, 5).map((task) => (
                <div className="list-row" key={task.id}>
                  <div className="list-row-main">
                    <div className="list-row-title">{task.title}</div>
                    <div className="list-row-sub">
                      <span>{fmtDate(task.dueAt)}</span>
                      <span>{fmtRelative(task.dueAt)}</span>
                      {task.subjectName && <span>{task.subjectName}</span>}
                    </div>
                  </div>
                  <Badge tone={task.type === "exam" || task.type === "test" ? "warn" : "neutral"}>
                    {task.type}
                  </Badge>
                </div>
              ))}
              {data.upcomingExams.length > 0 && (
                <div className="mt-12">
                  <div className="eyebrow mb-8">NEXT EXAM WINDOW</div>
                  {data.upcomingExams.slice(0, 2).map((exam) => (
                    <div className="between" key={`exam-${exam.id}`}>
                      <span className="small">{exam.title}</span>
                      <span className="mono tiny faint">{fmtDate(exam.dueAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel className="span-8">
          <PanelHead
            eyebrow="ACTIVITY / 7 DAYS"
            title="Focus and attempts"
            subtitle="Focus is attributed to the day each session started. Hover for exact values."
            actions={<Badge tone="info">REAL RECORDS</Badge>}
          />
          <WeeklyActivityChart data={data.weeklyActivity} />
        </Panel>

        <div className="span-4 grid" style={{ gap: 14 }}>
          <Panel>
            <PanelHead
              eyebrow="DAILY GOAL"
              title="Focus target"
              actions={
                <NavLink to="/settings" className="btn btn-ghost btn-sm">
                  Edit
                </NavLink>
              }
            />
            <div className="between" style={{ alignItems: "flex-end" }}>
              <div>
                <div className="metric-value">
                  {data.dailyFocusMinutes}
                  <span className="small faint"> min</span>
                </div>
                <div className="metric-sub">
                  of {data.dailyGoalMinutes} minute goal recorded today
                </div>
              </div>
              <span className="mono small faint">{Math.round(goalProgress)}%</span>
            </div>
            <ProgressBar value={goalProgress} tone={goalProgress >= 100 ? "success" : "primary"} />
            <div className="hint-text">
              Timer time is recorded evidence, not proof of attention. Sessions started before midnight
              are counted on their start date.
            </div>
          </Panel>
          <Panel>
            <PanelHead eyebrow="QUICK ACTIONS" title="Next move" />
            <div className="quick-actions">
              <button
                className="quick-action"
                onClick={() => startFocus.mutate()}
                disabled={startFocus.isPending || timerRunning}
              >
                <Play size={15} />
                {timerRunning ? "Focus in progress" : "Start focus timer"}
              </button>
              <NavLink to="/questions?tab=generate" className="quick-action">
                <Sparkles size={15} /> Generate questions
              </NavLink>
              <NavLink to="/questions?tab=review-mistakes" className="quick-action">
                <RotateCcw size={15} /> Review mistakes
              </NavLink>
              <NavLink to="/planner" className="quick-action">
                <CalendarClock size={15} /> Update plan
              </NavLink>
            </div>
          </Panel>
        </div>

        <Panel className="span-4">
          <PanelHead
            eyebrow="SUBJECTS"
            title="Mastery signal"
            actions={
              <NavLink to="/syllabus" className="btn btn-ghost btn-sm">
                Syllabus
              </NavLink>
            }
          />
          <SubjectBars subjects={data.subjects} />
          <div className="hint-text">
            Subject values only aggregate subtopics with sufficient evidence and are withheld when
            coverage is below 50%.
          </div>
        </Panel>

        <Panel className="span-4">
          <PanelHead
            eyebrow="WEAK AREAS"
            title="Evidence-backed gaps"
            actions={
              <Badge tone={data.weakTopics.length > 0 ? "warn" : "muted"}>
                {data.weakTopics.length}
              </Badge>
            }
          />
          {data.weakTopics.length === 0 ? (
            <EmptyState
              compact
              icon={<Target size={20} />}
              title="No weak topics to flag yet"
              description={
                data.stats.measuredSubtopics === 0
                  ? "Weak-area detection needs evidence. Attempt at least 5 questions across 4 distinct questions in a subtopic."
                  : "Every subtopic with sufficient evidence is currently estimated at 65% mastery or above."
              }
              action={
                data.stats.measuredSubtopics === 0 ? (
                  <NavLink to="/questions">
                    <Button size="sm" variant="outline">
                      Practice questions
                    </Button>
                  </NavLink>
                ) : undefined
              }
            />
          ) : (
            <div className="list">
              {data.weakTopics.slice(0, 5).map((topic) => (
                <div className="list-row" key={topic.subtopicId}>
                  <div className="list-row-main">
                    <div className="list-row-title">{topic.subtopicName}</div>
                    <div className="list-row-sub">
                      <span>{topic.chapterName}</span>
                      <span>{topic.attempts} attempts</span>
                      <span>{topic.distinctQuestions} questions</span>
                    </div>
                  </div>
                  <div className="list-row-side">
                    <MasteryBadge mastery={topic.mastery} sufficient={topic.sufficient} />
                    <NavLink
                      to={`/questions?tab=practice&subtopicId=${topic.subtopicId}`}
                      className="icon-btn"
                      title="Practice this subtopic"
                    >
                      <ArrowUpRight size={14} />
                    </NavLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="span-4">
          <PanelHead
            eyebrow="RECENTLY STUDIED"
            title="Last 14 days"
            actions={
              <NavLink to="/sessions" className="btn btn-ghost btn-sm">
                Sessions
              </NavLink>
            }
          />
          {data.recentlyStudied.length === 0 ? (
            <EmptyState
              compact
              icon={<BookOpenCheck size={20} />}
              title="No topics studied recently"
              description="Question attempts will populate this list with the exact topics you practised."
            />
          ) : (
            <div className="list">
              {data.recentlyStudied.map((topic) => (
                <div className="list-row" key={topic.subtopicId}>
                  <div className="list-row-main">
                    <div className="list-row-title">{topic.subtopicName}</div>
                    <div className="list-row-sub">
                      <span>{topic.chapterName}</span>
                      <span>{topic.lastAttemptAt ? fmtRelative(topic.lastAttemptAt) : "—"}</span>
                    </div>
                  </div>
                  <MasteryBadge mastery={topic.mastery} sufficient={topic.sufficient} compact />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="span-7">
          <PanelHead
            eyebrow="RECENT ACTIVITY"
            title="Attempt log"
            actions={
              <NavLink to="/questions" className="btn btn-ghost btn-sm">
                Open questions
              </NavLink>
            }
          />
          {data.recentAttempts.length === 0 ? (
            <EmptyState
              compact
              icon={<FileQuestion size={20} />}
              title="No attempts recorded"
              description="Attempting a question creates the primary evidence used for mastery."
              action={
                <NavLink to="/questions">
                  <Button size="sm" variant="outline">
                    Browse questions
                  </Button>
                </NavLink>
              }
            />
          ) : (
            <div className="timeline">
              {data.recentAttempts.slice(0, 6).map((attempt) => (
                <div
                  className={`timeline-item ${
                    attempt.correctness === "correct"
                      ? "success"
                      : attempt.correctness === "incorrect"
                        ? "danger"
                        : "accent"
                  }`}
                  key={attempt.id}
                >
                  <div className="between">
                    <div className="timeline-title">
                      {attempt.subtopicName ?? "Unclassified"}{" "}
                      <span className="faint">· {attempt.chapterName ?? "—"}</span>
                    </div>
                    <ScoreBadge correctness={attempt.correctness} />
                  </div>
                  <div className="timeline-sub">
                    {attempt.difficulty ?? "medium"} · {attempt.timeSpentSeconds}s
                    {attempt.hintsUsed > 0
                      ? ` · ${attempt.hintsUsed} hint${attempt.hintsUsed === 1 ? "" : "s"}`
                      : ""}
                    {attempt.solutionViewed ? " · solution viewed" : ""} ·{" "}
                    {fmtRelative(attempt.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.recentAttempts.length > 0 && (
            <div className="mt-12">
              <AttemptAccuracyBars
                correct={data.recentAttempts.filter((a) => a.correctness === "correct").length}
                partial={data.recentAttempts.filter((a) => a.correctness === "partial").length}
                incorrect={data.recentAttempts.filter((a) => a.correctness === "incorrect").length}
              />
              <div className="tiny faint mt-4">
                Distribution across the last {data.recentAttempts.length} attempts, not mastery
                evidence weighting.
              </div>
            </div>
          )}
        </Panel>

        <Panel className="span-5">
          <PanelHead
            eyebrow="SESSIONS"
            title="Recent study sessions"
            actions={
              <NavLink to="/sessions" className="btn btn-ghost btn-sm">
                All
              </NavLink>
            }
          />
          {data.recentSessions.length === 0 ? (
            <EmptyState
              compact
              icon={<Timer size={20} />}
              title="No sessions recorded"
              description="The study command or the Start session action creates a session record. Opening the app does not start a timer."
            />
          ) : (
            <div className="list">
              {data.recentSessions.slice(0, 5).map((session) => (
                <div className="list-row" key={session.id}>
                  <div className="list-row-main">
                    <div className="list-row-title">
                      {fmtDate(session.startedAt)}{" "}
                      <span className="faint">· session #{session.id}</span>
                    </div>
                    <div className="list-row-sub">
                      <span>{fmtMinutes(session.liveFocusSeconds / 60)} focus</span>
                      <span>{fmtMinutes(session.liveBreakSeconds / 60)} break</span>
                      {session.summary ? (
                        <span>{session.summary.attempts} attempts</span>
                      ) : (
                        <span>{session.status}</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    tone={session.status === "active" ? "primary" : "neutral"}
                    dot={session.status === "active"}
                  >
                    {session.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <div className="hint-text">
            Session summaries separate recorded evidence from self-reported notes. A running timer is
            not treated as proof of attention.
          </div>
        </Panel>
      </div>
    </>
  );
}
