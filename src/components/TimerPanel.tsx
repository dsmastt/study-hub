import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { Coffee, Pause, Play, Square, Timer, Zap } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudySession } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useActiveSession, useLiveTimer, useSettings } from "../api/hooks.ts";
import { fmtClock, clamp } from "../lib/format.ts";
import { Badge, Button, InlineNotice, Panel, PanelHead } from "./ui.tsx";

export function TimerPanel({
  session: providedSession,
  compact = false,
}: {
  session?: StudySession | null;
  compact?: boolean;
}) {
  const activeQuery = useActiveSession();
  const session = providedSession === undefined ? activeQuery.data : providedSession;
  const settings = useSettings();
  const queryClient = useQueryClient();
  const timer = useLiveTimer(session);
  const focusTarget = settings.data?.defaultFocusMinutes ?? 25;
  const breakTarget = settings.data?.defaultBreakMinutes ?? 5;
  const targetMinutes = timer.mode === "break" ? breakTarget : focusTarget;
  const targetSeconds = targetMinutes * 60;
  const targetProgress = session ? clamp((timer.activeSeconds / Math.max(1, targetSeconds)) * 100, 0, 100) : 0;
  const targetRemaining = Math.max(0, targetSeconds - timer.activeSeconds);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["session"] }),
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const startSession = useMutation({
    mutationFn: api.startSession,
    onSuccess: async () => invalidate(),
  });
  const startTimer = useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: "focus" | "break" }) => api.startTimer(id, mode),
    onSuccess: async () => invalidate(),
  });
  const pause = useMutation({ mutationFn: (id: number) => api.pauseTimer(id), onSuccess: invalidate });
  const resume = useMutation({ mutationFn: (id: number) => api.resumeTimer(id), onSuccess: invalidate });
  const end = useMutation({ mutationFn: (id: number) => api.endSession(id), onSuccess: invalidate });

  const busy = startSession.isPending || startTimer.isPending || pause.isPending || resume.isPending || end.isPending;
  const error = startSession.error || startTimer.error || pause.error || resume.error || end.error;

  if (!session) {
    return (
      <Panel className="timer-panel">
        <PanelHead eyebrow="SESSION CONTROL" title="No active session" />
        <p className="small muted">
          Opening the dashboard does not start a timer. Start a session record when you are ready; the
          focus timer remains explicit.
        </p>
        <div className="timer-actions">
          <Button
            variant="primary"
            icon={<Play size={14} />}
            loading={startSession.isPending}
            onClick={() => startSession.mutate()}
          >
            Start session
          </Button>
          <Button variant="subtle" icon={<Timer size={14} />} onClick={() => void activeQuery.refetch()}>
            Refresh
          </Button>
        </div>
        {error && (
          <div className="mt-12">
            <InlineNotice tone="danger" title="Could not start session">
              {error instanceof Error ? error.message : String(error)}
            </InlineNotice>
          </div>
        )}
      </Panel>
    );
  }

  const running = session.timerState === "running";
  const paused = session.timerState === "paused";
  const isBreak = timer.mode === "break";

  return (
    <Panel className="timer-panel">
      <PanelHead
        eyebrow="SESSION CONTROL"
        title={
          <span className="row gap-8">
            Session #{session.id}
            <Badge tone={running ? (isBreak ? "info" : "success") : paused ? "warn" : "neutral"} dot>
              {running ? (isBreak ? "On break" : "Focusing") : paused ? "Paused" : "Idle"}
            </Badge>
          </span>
        }
        actions={
          <NavLink to="/sessions" className="badge badge-neutral">
            Details
          </NavLink>
        }
      />
      <div className={clsx("timer-display", running && !isBreak && "running", running && isBreak && "break")}>
        {fmtClock(timer.activeSeconds)}
      </div>
      <div className="timer-meta">
        <span>
          FOCUS <strong>{fmtClock(timer.focusSeconds)}</strong>
        </span>
        <span>
          BREAK <strong>{fmtClock(timer.breakSeconds)}</strong>
        </span>
        <span>
          TARGET <strong>{targetMinutes}m</strong>
        </span>
      </div>

      {running && (
        <div className="timer-progress">
          <div className="progress-track">
            <span
              style={{
                width: `${targetProgress}%`,
                background: isBreak ? "var(--info)" : "var(--accent)",
              }}
            />
          </div>
          <div className="timer-progress-label">
            <span>{targetRemaining > 0 ? `${fmtClock(targetRemaining)} until ${isBreak ? "break" : "focus"} target` : "Target reached"}</span>
            <span>{isBreak ? "Break timer" : "Focus timer"}</span>
          </div>
        </div>
      )}

      <div className="timer-actions">
        {!running && !paused && (
          <>
            <Button
              variant="primary"
              size={compact ? "sm" : "md"}
              icon={<Play size={14} />}
              loading={startTimer.isPending}
              onClick={() => startTimer.mutate({ id: session.id, mode: "focus" })}
            >
              Start focus
            </Button>
            <Button
              variant="subtle"
              size={compact ? "sm" : "md"}
              icon={<Coffee size={14} />}
              onClick={() => startTimer.mutate({ id: session.id, mode: "break" })}
            >
              Take break
            </Button>
          </>
        )}
        {running && (
          <>
            <Button
              variant="subtle"
              size={compact ? "sm" : "md"}
              icon={<Pause size={14} />}
              loading={pause.isPending}
              onClick={() => pause.mutate(session.id)}
            >
              Pause
            </Button>
            <Button
              variant="subtle"
              size={compact ? "sm" : "md"}
              icon={isBreak ? <Zap size={14} /> : <Coffee size={14} />}
              loading={startTimer.isPending}
              onClick={() => startTimer.mutate({ id: session.id, mode: isBreak ? "focus" : "break" })}
            >
              {isBreak ? "Back to focus" : "Switch to break"}
            </Button>
          </>
        )}
        {paused && (
          <Button
            variant="primary"
            size={compact ? "sm" : "md"}
            icon={<Play size={14} />}
            loading={resume.isPending}
            onClick={() => resume.mutate(session.id)}
          >
            Resume
          </Button>
        )}
        <Button
          variant="ghost"
          size={compact ? "sm" : "md"}
          icon={<Square size={13} />}
          loading={end.isPending}
          onClick={() => {
            if (window.confirm("End this session and generate an evidence-based summary?")) {
              end.mutate(session.id);
            }
          }}
        >
          End session
        </Button>
      </div>
      <div className="timer-meta" style={{ marginTop: 10 }}>
        <span>BREAKS UNLOCKED · NO QUIZ GATE</span>
      </div>
      {error && (
        <div className="mt-12">
          <InlineNotice tone="danger" title="Timer action failed">
            {error instanceof Error ? error.message : String(error)}
          </InlineNotice>
        </div>
      )}
      {busy && <div className="mt-8 tiny faint">Syncing session…</div>}
    </Panel>
  );
}
