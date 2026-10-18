import { Router } from "express";
import {
  addDays,
  endOfDay,
  format,
  isWithinInterval,
  startOfDay,
  subDays,
} from "date-fns";
import { isWeakMastery, type DashboardData, type SubjectWithMastery } from "../../shared/types.ts";
import { getDb, getSetting, rowToSession, rowToTask } from "../db.ts";
import { loadMasteryContext, getRecentAttempts } from "../services/masteryService.ts";
import { listSessions, getActiveSession } from "../services/sessions.ts";
import { listTasks } from "../services/tasks.ts";

export const dashboardRouter = Router();

dashboardRouter.get("/", (_req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfDay(subDays(now, 6));
  const context = loadMasteryContext();
  const allOpen = listTasks({ status: "open", limit: 300 });
  const activeSession = getActiveSession();
  const weekSessions = (
    getDb()
      .prepare("SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at DESC")
      .all(weekStart.toISOString()) as Record<string, unknown>[]
  ).map(rowToSession);
  const completedRelevant = (
    getDb()
      .prepare(
        `SELECT t.*, s.name AS subject_name, c.name AS chapter_name
         FROM tasks t
         LEFT JOIN subjects s ON s.id = t.subject_id
         LEFT JOIN chapters c ON c.id = t.chapter_id
         WHERE t.status = 'completed'
           AND (t.completed_at >= ? OR (t.due_at >= ? AND t.due_at <= ?))`,
      )
      .all(weekStart.toISOString(), todayStart.toISOString(), todayEnd.toISOString()) as Record<string, unknown>[]
  ).map(rowToTask);
  const completedDueToday = completedRelevant.filter(
    (task) => task.dueAt && isWithinInterval(new Date(task.dueAt), { start: todayStart, end: todayEnd }),
  );
  const completedSinceWeek = completedRelevant.filter(
    (task) => task.completedAt && new Date(task.completedAt) >= weekStart,
  );
  let activeSubject: string | null = null;
  if (activeSession) {
    const sessionSubject = getDb()
      .prepare(
        `SELECT s.name AS name FROM attempts a
         JOIN questions q ON q.id = a.question_id
         JOIN subjects s ON s.id = q.subject_id
         WHERE a.session_id = ? ORDER BY a.created_at DESC LIMIT 1`,
      )
      .get(activeSession.id) as { name: string } | undefined;
    if (sessionSubject) activeSubject = sessionSubject.name;
    if (!activeSubject && activeSession.plannedTaskIds.length > 0) {
      const placeholders = activeSession.plannedTaskIds.map(() => "?").join(",");
      const plannedSubject = getDb()
        .prepare(
          `SELECT s.name AS name FROM tasks t JOIN subjects s ON s.id = t.subject_id
           WHERE t.id IN (${placeholders}) AND t.subject_id IS NOT NULL LIMIT 1`,
        )
        .get(...activeSession.plannedTaskIds) as { name: string } | undefined;
      if (plannedSubject) activeSubject = plannedSubject.name;
    }
    if (!activeSubject) {
      const todaySubject = getDb()
        .prepare(
          `SELECT s.name AS name FROM tasks t JOIN subjects s ON s.id = t.subject_id
           WHERE t.due_at >= ? AND t.due_at <= ? AND t.subject_id IS NOT NULL
             AND t.status IN ('pending', 'in_progress')
           ORDER BY t.priority ASC LIMIT 1`,
        )
        .get(todayStart.toISOString(), todayEnd.toISOString()) as { name: string } | undefined;
      if (todaySubject) activeSubject = todaySubject.name;
    }
  }

  const todayTasks = [...allOpen, ...completedDueToday]
    .filter((task) => {
      if (task.status === "in_progress") return true;
      if (!task.dueAt) return false;
      return isWithinInterval(new Date(task.dueAt), { start: todayStart, end: todayEnd });
    })
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      return (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0);
    });
  const overdueTasks = allOpen.filter(
    (task) => task.dueAt !== null && new Date(task.dueAt) < todayStart,
  );
  const upcomingDeadlines = allOpen
    .filter((task) => {
      if (!task.dueAt) return false;
      const due = new Date(task.dueAt);
      return due > todayEnd && due <= endOfDay(addDays(now, 14));
    })
    .slice(0, 10);
  const upcomingExams = allOpen
    .filter((task) => {
      if (!task.dueAt || (task.type !== "test" && task.type !== "exam")) return false;
      return new Date(task.dueAt) >= todayStart && new Date(task.dueAt) <= endOfDay(addDays(now, 60));
    })
    .slice(0, 6);

  const subjects: SubjectWithMastery[] = context.subjects.map((subject) => {
    const aggregate = context.subjectAggregates.get(subject.id)!;
    const subjectChapters = context.chapters.filter((chapter) => chapter.subjectId === subject.id);
    return {
      ...subject,
      chapterCount: subjectChapters.length,
      subtopicCount: aggregate.totalSubtopics,
      measuredSubtopics: aggregate.measuredSubtopics,
      mastery: aggregate.mastery,
      coverage: aggregate.coverage,
      evidence: aggregate.evidence,
    };
  });

  const weakTopics = [...context.bySubtopic.values()]
    .filter((item) => isWeakMastery(item))
    .sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100) || b.evidence - a.evidence)
    .slice(0, 6);

  const recentAttempts = getRecentAttempts({ limit: 10 });
  const recentSessions = listSessions(30).slice(0, 8);
  const recent14 = subDays(now, 13);
  const attempts7 = getDb()
    .prepare("SELECT correctness, created_at FROM attempts WHERE created_at >= ?")
    .all(startOfDay(subDays(now, 6)).toISOString()) as { correctness: string; created_at: string }[];
  const recentlyStudied = [...context.bySubtopic.values()]
    .filter((item) => item.lastAttemptAt && new Date(item.lastAttemptAt) >= recent14)
    .sort(
      (a, b) =>
        new Date(b.lastAttemptAt ?? 0).getTime() - new Date(a.lastAttemptAt ?? 0).getTime(),
    )
    .slice(0, 6);

  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const day = subDays(now, 6 - index);
    const key = format(day, "yyyy-MM-dd");
    const focusSeconds = weekSessions
      .filter((session) => format(new Date(session.startedAt), "yyyy-MM-dd") === key)
      .reduce((sum, session) => sum + session.liveFocusSeconds, 0);
    const attemptsCount = attempts7.filter(
      (attempt) => format(new Date(attempt.created_at), "yyyy-MM-dd") === key,
    ).length;
    const taskCount = completedSinceWeek.filter(
      (task) =>
        task.completedAt && format(new Date(task.completedAt), "yyyy-MM-dd") === key,
    ).length;
    return {
      date: key,
      focusMinutes: Math.round((focusSeconds / 60) * 10) / 10,
      attempts: attemptsCount,
      tasksCompleted: taskCount,
    };
  });

  const attempted7 = attempts7.filter((attempt) => attempt.correctness !== "skipped");
  const accuracy7d =
    attempted7.length > 0
      ? Math.round(
          (attempted7.reduce(
            (sum, attempt) =>
              sum + (attempt.correctness === "correct" ? 1 : attempt.correctness === "partial" ? 0.5 : 0),
            0,
          ) /
            attempted7.length) *
            1000,
        ) / 10
      : null;
  const focusSeconds7d = weekSessions.reduce(
    (sum, session) => sum + session.liveFocusSeconds,
    0,
  );
  const tasksCompleted7d = completedSinceWeek.length;
  const evidenceDays = new Set<string>();
  for (const attempt of attempts7) evidenceDays.add(format(new Date(attempt.created_at), "yyyy-MM-dd"));
  for (const session of weekSessions) {
    if (session.liveFocusSeconds > 0) {
      evidenceDays.add(format(new Date(session.startedAt), "yyyy-MM-dd"));
    }
  }
  for (const task of completedSinceWeek) {
    if (task.completedAt) {
      evidenceDays.add(format(new Date(task.completedAt), "yyyy-MM-dd"));
    }
  }
  const measuredSubtopics = [...context.bySubtopic.values()].filter((item) => item.sufficient).length;
  const totalSubtopics = context.subtopics.length;

  const dailyGoalMinutes = Number(getSetting("dailyGoalMinutes") ?? 120);
  const todaySessions = weekSessions.filter(
    (session) => format(new Date(session.startedAt), "yyyy-MM-dd") === format(now, "yyyy-MM-dd"),
  );
  const dailyFocusMinutes =
    Math.round(
      (todaySessions.reduce((sum, session) => sum + session.liveFocusSeconds, 0) / 60) * 10,
    ) / 10;

  const briefingItems: DashboardData["dailyBriefing"]["items"] = [];
  if (overdueTasks.length > 0) {
    briefingItems.push({
      kind: "overdue",
      title: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      detail: overdueTasks
        .slice(0, 3)
        .map((task) => task.title)
        .join(" · "),
      href: "/planner",
    });
  }
  if (todayTasks.length > 0) {
    briefingItems.push({
      kind: "deadline",
      title: `${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} on today's plan`,
      detail: todayTasks
        .slice(0, 3)
        .map((task) => task.title)
        .join(" · "),
      href: "/planner",
    });
  }
  if (weakTopics.length > 0) {
    const first = weakTopics[0];
    briefingItems.push({
      kind: "weak",
      title: `Weakest evidence-backed topic: ${first.subtopicName}`,
      detail: `${first.mastery}% mastery from ${first.attempts} attempts across ${first.distinctQuestions} questions in ${first.chapterName}.`,
      href: first.chapterId ? `/syllabus/${first.chapterId}` : "/syllabus",
    });
  }
  const incorrect7 = attempts7.filter((attempt) => attempt.correctness === "incorrect").length;
  if (incorrect7 > 0) {
    briefingItems.push({
      kind: "review",
      title: `${incorrect7} incorrect attempt${incorrect7 === 1 ? "" : "s"} in the last 7 days`,
      detail: "Review the worked solutions and record the mistake type before re-attempting.",
      href: "/questions?tab=review-mistakes",
    });
  }
  if (dailyFocusMinutes < dailyGoalMinutes) {
    briefingItems.push({
      kind: "goal",
      title: `${Math.max(0, dailyGoalMinutes - dailyFocusMinutes)} focus minutes remaining today`,
      detail: `Recorded ${dailyFocusMinutes} of ${dailyGoalMinutes} minutes from sessions started today. Timer time is recorded evidence, not proof of attention.`,
      href: "/sessions",
    });
  } else {
    briefingItems.push({
      kind: "goal",
      title: "Daily focus goal met",
      detail: `${dailyFocusMinutes} recorded focus minutes today.`,
    });
  }
  if (upcomingExams.length > 0) {
    const exam = upcomingExams[0];
    briefingItems.push({
      kind: "deadline",
      title: `Next ${exam.type}: ${exam.title}`,
      detail: exam.dueAt ? `Due ${new Date(exam.dueAt).toLocaleString()}` : "No date",
      href: "/planner",
    });
  }
  if (measuredSubtopics === 0) {
    briefingItems.push({
      kind: "info",
      title: "No mastery estimates yet",
      detail:
        "Attempt at least 5 questions across 4 distinct questions in a subtopic before the app will display a mastery percentage.",
      href: "/questions",
    });
  }

  const data: DashboardData = {
    now: now.toISOString(),
    activeSession,
    activeSubject,
    todayTasks,
    overdueTasks,
    upcomingDeadlines,
    upcomingExams,
    subjects,
    weakTopics,
    recentAttempts,
    recentSessions,
    weeklyActivity,
    stats: {
      focusMinutes7d: Math.round((focusSeconds7d / 60) * 10) / 10,
      attempts7d: attempts7.length,
      accuracy7d,
      tasksCompleted7d,
      evidenceDays: evidenceDays.size,
      measuredSubtopics,
      totalSubtopics,
    },
    dailyGoalMinutes,
    dailyFocusMinutes,
    dailyBriefing: {
      generatedAt: now.toISOString(),
      items: briefingItems,
      basis: [
        `${attempts7.length} recorded attempts in the last 7 days (${attempted7.length} attempted).`,
        `${weekSessions.length} recorded session(s) in the last 7 days; focus minutes from session records.`,
        `${measuredSubtopics}/${totalSubtopics} subtopics have enough evidence for a mastery estimate.`,
        `${completedSinceWeek.length} task(s) completed in the last 7 days.`,
      ],
    },
    recentlyStudied,
  };
  res.json(data);
});

