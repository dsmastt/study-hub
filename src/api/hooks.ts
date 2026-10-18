import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { StudySession } from "../../shared/types.ts";
import { api, type QuestionFilters, type TaskFilters } from "./client.ts";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  syllabus: ["syllabus"] as const,
  chapter: (id: number) => ["chapter", id] as const,
  questions: (filters: QuestionFilters) => ["questions", filters] as const,
  question: (id: number) => ["question", id] as const,
  tasks: (filters: TaskFilters) => ["tasks", filters] as const,
  sessions: ["sessions"] as const,
  activeSession: ["session", "active"] as const,
  session: (id: number) => ["session", id] as const,
  settings: ["settings"] as const,
  theme: ["theme"] as const,
  launcher: ["launcher"] as const,
  system: ["system"] as const,
  aiStatus: ["ai", "status"] as const,
  messages: ["ai", "messages"] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboard,
    refetchInterval: 30_000,
  });
}

export function useSyllabus() {
  return useQuery({ queryKey: queryKeys.syllabus, queryFn: api.syllabus });
}

export function useChapter(id: number) {
  return useQuery({
    queryKey: queryKeys.chapter(id),
    queryFn: () => api.chapter(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useQuestions(filters: QuestionFilters = {}) {
  return useQuery({
    queryKey: queryKeys.questions(filters),
    queryFn: () => api.questions(filters),
  });
}

export function useQuestion(id: number | null) {
  return useQuery({
    queryKey: queryKeys.question(id ?? 0),
    queryFn: () => api.question(id!),
    enabled: id !== null && id > 0,
  });
}

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () => api.tasks(filters),
    refetchInterval: 60_000,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => api.sessions(50),
    refetchInterval: 60_000,
  });
}

export function useActiveSession() {
  return useQuery({
    queryKey: queryKeys.activeSession,
    queryFn: api.activeSession,
    refetchInterval: 20_000,
  });
}

export function useSession(id: number | null) {
  return useQuery({
    queryKey: queryKeys.session(id ?? 0),
    queryFn: () => api.session(id!),
    enabled: id !== null && id > 0,
  });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
}

export function useLauncher() {
  return useQuery({ queryKey: queryKeys.launcher, queryFn: api.launcher });
}

export function useSystemInfo() {
  return useQuery({ queryKey: queryKeys.system, queryFn: api.system });
}

export function useAIStatus() {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: api.aiStatus,
    refetchInterval: 60_000,
  });
}

export function useChatMessages() {
  return useQuery({ queryKey: queryKeys.messages, queryFn: api.messages });
}

export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["syllabus"] }),
      queryClient.invalidateQueries({ queryKey: ["chapter"] }),
      queryClient.invalidateQueries({ queryKey: ["questions"] }),
      queryClient.invalidateQueries({ queryKey: ["question"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["session"] }),
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
      queryClient.invalidateQueries({ queryKey: ["ai"] }),
    ]);
  };
}

export interface LiveTimer {
  focusSeconds: number;
  breakSeconds: number;
  activeSeconds: number;
  mode: StudySession["timerMode"];
  running: boolean;
}

export function useLiveTimer(session: StudySession | null | undefined): LiveTimer {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session || session.timerState !== "running") return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.id, session?.timerState, session?.timerStartedAt]);

  if (!session) {
    return { focusSeconds: 0, breakSeconds: 0, activeSeconds: 0, mode: "focus", running: false };
  }
  const running = session.timerState === "running";
  const delta =
    running && session.timerStartedAt
      ? Math.max(0, Math.floor((now - new Date(session.timerStartedAt).getTime()) / 1000))
      : 0;
  const focusSeconds = session.focusSeconds + (session.timerMode === "focus" ? delta : 0);
  const breakSeconds = session.breakSeconds + (session.timerMode === "break" ? delta : 0);
  return {
    focusSeconds,
    breakSeconds,
    activeSeconds: session.timerMode === "focus" ? focusSeconds : breakSeconds,
    mode: session.timerMode,
    running,
  };
}
