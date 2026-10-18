import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay, subDays } from "date-fns";
import { CheckCircle2, Eye, NotebookPen, Timer } from "lucide-react";
import type { StudySession } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useActiveSession, useSession, useSessions, useSettings, useTasks } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { TimerPanel } from "../components/TimerPanel.tsx";
import {
  Badge,
  Button,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  Metric,
  Modal,
  Panel,
  PanelHead,
  ScoreBadge,
} from "../components/ui.tsx";
import { fmtClock, fmtDate, fmtDateTime, fmtMinutes, fmtTime } from "../lib/format.ts";

function SessionDetailModal({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const { data, isLoading, error } = useSession(sessionId);
  const session = data?.session;
  const summary = session?.summary;
  const focusSeconds = session ? (session.status === "active" ? session.liveFocusSeconds : session.focusSeconds) : 0;
  const breakSeconds = session ? (session.status === "active" ? session.liveBreakSeconds : session.breakSeconds) : 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Session #${sessionId}`}
      eyebrow={session ? `${fmtDate(session.startedAt)} · ${session.status.toUpperCase()}` : "SESSION"}
      size="lg"
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}
    >
      {isLoading ? (
        <LoadingPanel label="Loading session evidence…" />
      ) : error || !session ? (
        <ErrorPanel error={error} />
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div className="session-summary-box">
            <div className="session-summary-grid">
              <div>
                <div className="summary-number">{fmtClock(focusSeconds)}</div>
                <div className="summary-label">Focus</div>
              </div>
              <div>
                <div className="summary-number">{fmtClock(breakSeconds)}</div>
                <div className="summary-label">Break</div>
              </div>
              <div>
                <div className="summary-number">{summary?.attempts ?? data?.attempts.length ?? 0}</div>
                <div className="summary-label">Attempts</div>
              </div>
              <div>
                <div className="summary-number">{summary?.accuracy === null || summary?.accuracy === undefined ? "—" : `${summary.accuracy}%`}</div>
                <div className="summary-label">Accuracy</div>
              </div>
              <div>
                <div className="summary-number">
                  {summary ? `${summary.tasksCompleted}/${summary.tasksPlanned}` : data?.plannedTasks.filter((task) => task.status === "completed").length ?? 0}
                </div>
                <div className="summary-label">Planned tasks done</div>
              </div>
            </div>
            <div className="info-list">
              <div className="info-row">
                <span>Started</span>
                <span>{fmtDateTime(session.startedAt)}</span>
              </div>
              <div className="info-row">
                <span>Ended</span>
                <span>{session.endedAt ? fmtDateTime(session.endedAt) : "still active"}</span>
              </div>
              <div className="info-row">
                <span>Timer</span>
                <span>{session.timerState} / {session.timerMode}</span>
              </div>
            </div>
            {summary && (
              <>
                <div className="mt-12">
                  <div className="eyebrow mb-8">TOPICS STUDIED</div>
                  <div className="pill-list">
                    {summary.topicsStudied.length > 0 ? (
                      summary.topicsStudied.map((topic) => <Badge key={topic} tone="primary">{topic}</Badge>)
                    ) : (
                      <span className="tiny faint">No classified question attempts in this session.</span>
                    )}
                  </div>
                </div>
                {(summary.correct > 0 || summary.partial > 0 || summary.incorrect > 0) && (
                  <div className="row gap-8 mt-12 wrap">
                    <Badge tone="success">{summary.correct} correct</Badge>
                    <Badge tone="warn">{summary.partial} partial</Badge>
                    <Badge tone="danger">{summary.incorrect} incorrect</Badge>
                    <Badge tone="info">{summary.hintsUsed} hints</Badge>
                    <Badge tone="info">{summary.solutionsViewed} solutions viewed</Badge>
                  </div>
                )}
                <div className="evidence-note">{summary.evidenceNote}</div>
              </>
            )}
          </div>

          {session.notes && (
            <div>
              <div className="eyebrow mb-8">SELF-REPORTED NOTES</div>
              <div className="session-summary-box small muted" style={{ whiteSpace: "pre-wrap" }}>
                {session.notes}
              </div>
            </div>
          )}

          <div>
            <div className="eyebrow mb-8">RECORDED ATTEMPTS</div>
            {data?.attempts.length === 0 ? (
              <EmptyState compact title="No attempts in this session" description="Question attempts recorded during the session appear here." />
            ) : (
              <div className="list">
                {data?.attempts.map((attempt) => (
                  <div className="list-row" key={attempt.id}>
                    <div className="list-row-main">
                      <div className="list-row-title">{attempt.questionPrompt ?? `Question #${attempt.questionId}`}</div>
                      <div className="list-row-sub">
                        <span>{attempt.subtopicName ?? "Unclassified"}</span>
                        <span>{attempt.difficulty ?? "medium"}</span>
                        <span>{attempt.timeSpentSeconds}s</span>
                        {attempt.hintsUsed > 0 && <span>{attempt.hintsUsed} hints</span>}
                        {attempt.solutionViewed && <span>solution viewed</span>}
                        <span>{fmtTime(attempt.createdAt)}</span>
                      </div>
                    </div>
                    <ScoreBadge correctness={attempt.correctness} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="eyebrow mb-8">PLANNED TASKS</div>
            {data?.plannedTasks.length === 0 ? (
              <span className="tiny faint">No tasks were attached to this session.</span>
            ) : (
              <div className="list">
                {data?.plannedTasks.map((task) => (
                  <div className="list-row" key={task.id}>
                    <div className="list-row-main">
                      <div className="list-row-title">{task.title}</div>
                      <div className="list-row-sub">
                        <span>{task.type}</span>
                        {task.dueAt && <span>due {fmtDate(task.dueAt)}</span>}
                      </div>
                    </div>
                    <Badge tone={task.status === "completed" ? "success" : "neutral"}>{task.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Sessions() {
  const { data: active, isLoading: activeLoading, error: activeError, refetch: refetchActive } = useActiveSession();
  const { data: sessions, isLoading, error, refetch } = useSessions();
  const { data: tasks } = useTasks({ status: "open", limit: 100 });
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [planned, setPlanned] = useState<number[]>([]);
  const [planDirty, setPlanDirty] = useState(false);

  useEffect(() => {
    if (active) {
      setNotes(active.notes);
      setPlanned(active.plannedTaskIds);
      setPlanDirty(false);
    }
  }, [active?.id, active?.notes, active?.plannedTaskIds.join(",")]);

  const saveNotes = useMutation({
    mutationFn: () => api.updateSession(active!.id, { notes }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  const savePlan = useMutation({
    mutationFn: () => api.updateSession(active!.id, { plannedTaskIds: planned }),
    onSuccess: async () => {
      setPlanDirty(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      ]);
    },
  });
  const completeTask = useMutation({
    mutationFn: (id: number) => api.updateTask(id, { status: "completed" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  const recentAttempts = useQuery({
    queryKey: ["attempts", "sessions-summary"],
    queryFn: () => api.attempts({ limit: 200, since: startOfDay(subDays(new Date(), 6)).toISOString() }),
  });

  const allSessions = sessions ?? [];
  const weekSessions = allSessions.filter(
    (session) => new Date(session.startedAt) >= startOfDay(subDays(new Date(), 6)),
  );
  const weekFocusSeconds = weekSessions.reduce((sum, session) => sum + session.liveFocusSeconds, 0);
  const ended = allSessions.filter((session) => session.status === "ended");
  const averageFocus =
    ended.length > 0
      ? Math.round(
          (ended.reduce((sum, session) => sum + session.focusSeconds, 0) / ended.length / 60) * 10,
        ) / 10
      : 0;
  const recentAttemptsData = recentAttempts.data ?? [];
  const weeklyAccuracy = useMemo(() => {
    const attempted = recentAttemptsData.filter((attempt) => attempt.correctness !== "skipped");
    if (attempted.length === 0) return null;
    const score = attempted.reduce(
      (sum, attempt) => sum + (attempt.correctness === "correct" ? 1 : attempt.correctness === "partial" ? 0.5 : 0),
      0,
    );
    return Math.round((score / attempted.length) * 1000) / 10;
  }, [recentAttemptsData]);
  const openTasks = tasks ?? [];

  if (isLoading || activeLoading) return <LoadingPanel label="Loading session records…" />;
  if (error || activeError) return <ErrorPanel error={error ?? activeError} retry={() => { void refetch(); void refetchActive(); }} />;

  return (
    <>
      <PageHeader
        eyebrow="SESSIONS / EVIDENCE"
        title="Study sessions"
        description="Session records and focus timers are explicit. The study command creates a session but never starts a timer. Breaks are always available; no quiz gates or lockouts."
        actions={
          <Badge tone="primary" dot>
            {settings ? `${settings.defaultFocusMinutes}m focus / ${settings.defaultBreakMinutes}m break targets` : "Loading targets…"}
          </Badge>
        }
        meta={
          <>
            <span>{allSessions.length} session records</span>
            <span>{active ? `active session #${active.id}` : "no active session"}</span>
            <span>evidence not surveillance</span>
          </>
        }
      />

      <div className="grid cols-4 mb-16">
        <Metric label="Active session" value={active ? `#${active.id}` : "None"} sub={active ? `${active.timerState} · ${active.timerMode}` : "Start one explicitly"} tone={active ? "primary" : "neutral"} icon={<Timer size={15} />} />
        <Metric label="Focus / 7d" value={fmtMinutes(weekFocusSeconds / 60)} sub={`${weekSessions.length} session(s) started this week`} tone="success" />
        <Metric label="Avg ended session" value={ended.length > 0 ? fmtMinutes(averageFocus) : "—"} sub={`Across ${ended.length} ended session(s)`} tone="info" />
        <Metric label="Attempt accuracy / 7d" value={weeklyAccuracy === null ? "—" : `${weeklyAccuracy}%`} sub={`${recentAttemptsData.length} recorded attempts`} tone="warn" />
      </div>

      <div className="dash-grid">
        <div className="span-5">
          <TimerPanel session={active} />
          <Panel className="mt-16">
            <PanelHead eyebrow="SESSION PLAN" title="Tasks for this session" />
            {!active ? (
              <EmptyState compact title="No active session" description="Start a session to attach planned tasks and self-reported notes." />
            ) : (
              <>
                {openTasks.length === 0 ? (
                  <span className="tiny faint">No open tasks available. Add tasks in the planner.</span>
                ) : (
                  <div className="list">
                    {openTasks.slice(0, 14).map((task) => (
                      <label className="list-row" key={task.id} style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={planned.includes(task.id)}
                          onChange={(event) => {
                            setPlanDirty(true);
                            setPlanned((current) =>
                              event.target.checked
                                ? [...current, task.id]
                                : current.filter((id) => id !== task.id),
                            );
                          }}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <div className="list-row-main">
                          <div className="list-row-title">{task.title}</div>
                          <div className="list-row-sub">
                            <span>{task.type}</span>
                            {task.dueAt && <span>{fmtDate(task.dueAt)}</span>}
                            {task.subjectName && <span>{task.subjectName}</span>}
                          </div>
                        </div>
                        <Badge tone={task.priority === 1 ? "danger" : task.priority === 2 ? "warn" : "neutral"}>
                          P{task.priority}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
                <div className="between mt-12">
                  <span className="tiny faint">{planned.length} selected</span>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={savePlan.isPending}
                    disabled={!planDirty}
                    onClick={() => savePlan.mutate()}
                  >
                    Save plan
                  </Button>
                </div>
                {active.plannedTaskIds.length > 0 && (
                  <div className="mt-16">
                    <div className="eyebrow mb-8">ATTACHED TASKS</div>
                    {openTasks
                      .filter((task) => active.plannedTaskIds.includes(task.id))
                      .map((task) => (
                        <div className="list-row" key={`attached-${task.id}`}>
                          <div className="list-row-main">
                            <div className="list-row-title">{task.title}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<CheckCircle2 size={12} />}
                            loading={completeTask.isPending}
                            onClick={() => completeTask.mutate(task.id)}
                          >
                            Complete
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>

        <div className="span-7">
          <Panel>
            <PanelHead
              eyebrow="SELF-REPORTED ACTIVITY"
              title="Session notes"
              subtitle="Recorded separately from timer and attempt evidence. Describe what you actually studied."
            />
            {!active ? (
              <EmptyState compact icon={<NotebookPen size={20} />} title="No active session" description="Notes are attached to the active session." />
            ) : (
              <>
                <textarea
                  className="textarea"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="e.g. Watched lecture 4 on rotational dynamics; still shaky on rolling friction…"
                />
                <div className="between mt-8">
                  <span className="tiny faint">Self-reported · not verified by the app</span>
                  <Button
                    variant="subtle"
                    size="sm"
                    loading={saveNotes.isPending}
                    onClick={() => saveNotes.mutate()}
                  >
                    Save notes
                  </Button>
                </div>
                <div className="evidence-note">
                  If you mainly watched lectures, the assistant may ask which topics you covered and
                  offer a short quiz. The app will not pretend an open lecture proves attention.
                </div>
              </>
            )}
          </Panel>

          <Panel className="mt-16">
            <PanelHead
              eyebrow="HISTORY"
              title="Session records"
              actions={<Badge tone="neutral">{allSessions.length}</Badge>}
            />
            {allSessions.length === 0 ? (
              <EmptyState
                icon={<Timer size={22} />}
                title="No session records yet"
                description="Run the study command or start a session manually. Opening the dashboard alone never creates study evidence."
              />
            ) : (
              <div>
                {allSessions.map((session) => (
                  <button
                    key={session.id}
                    className="session-row"
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "inherit",
                      font: "inherit",
                    }}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <div className="session-date">
                      {fmtDate(session.startedAt)}
                      <span>{fmtTime(session.startedAt)} · #{session.id}</span>
                    </div>
                    <div className="session-stats">
                      <span><strong>{fmtMinutes(session.liveFocusSeconds / 60)}</strong> focus</span>
                      <span><strong>{fmtMinutes(session.liveBreakSeconds / 60)}</strong> break</span>
                      {session.summary ? (
                        <>
                          <span><strong>{session.summary.attempts}</strong> attempts</span>
                          <span><strong>{session.summary.accuracy === null ? "—" : `${session.summary.accuracy}%`}</strong> accuracy</span>
                          <span><strong>{session.summary.tasksCompleted}/{session.summary.tasksPlanned}</strong> tasks</span>
                        </>
                      ) : (
                        <span><strong>{session.timerState}</strong> timer</span>
                      )}
                    </div>
                    <div className="row gap-6">
                      <Badge tone={session.status === "active" ? "primary" : "neutral"} dot={session.status === "active"}>
                        {session.status}
                      </Badge>
                      <Eye size={14} className="faint" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {selectedId !== null && <SessionDetailModal sessionId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
