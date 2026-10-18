import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Bot, CalendarDays, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { Task, TaskStatus, TaskType } from "../../shared/types.ts";
import { TASK_TYPE_LABELS } from "../../shared/types.ts";
import { api } from "../api/client.ts";
import { useSyllabus, useTasks } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { TaskRow } from "../components/TaskRow.tsx";
import {
  Badge,
  Button,
  EmptyState,
  ErrorPanel,
  Field,
  InlineNotice,
  LoadingPanel,
  Metric,
  Modal,
  Panel,
  PanelHead,
  Tabs,
  useFieldId,
} from "../components/ui.tsx";
import { fmtDate, fromDateTimeLocal, toDateTimeLocal } from "../lib/format.ts";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function TaskModal({
  open,
  task,
  defaultDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null;
  defaultDate: Date;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { data: syllabus } = useSyllabus();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("study");
  const [priority, setPriority] = useState("2");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [dueAt, setDueAt] = useState("");
  const [estimated, setEstimated] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const titleId = useFieldId("task-title");
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        description,
        type,
        priority: Number(priority),
        status,
        dueAt: fromDateTimeLocal(dueAt),
        estimatedMinutes: estimated === "" ? null : Number(estimated),
        subjectId: subjectId ? Number(subjectId) : null,
        chapterId: chapterId ? Number(chapterId) : null,
        subtopicId: subtopicId ? Number(subtopicId) : null,
      };
      return task ? api.updateTask(task.id, payload) : api.createTask(payload);
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    mutation.reset();
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setType(task.type);
      setPriority(String(task.priority));
      setStatus(task.status);
      setDueAt(toDateTimeLocal(task.dueAt));
      setEstimated(task.estimatedMinutes === null ? "" : String(task.estimatedMinutes));
      setSubjectId(task.subjectId ? String(task.subjectId) : "");
      setChapterId(task.chapterId ? String(task.chapterId) : "");
      setSubtopicId(task.subtopicId ? String(task.subtopicId) : "");
    } else {
      setTitle("");
      setDescription("");
      setType("study");
      setPriority("2");
      setStatus("pending");
      const date = new Date(defaultDate);
      date.setHours(18, 0, 0, 0);
      setDueAt(toDateTimeLocal(date.toISOString()));
      setEstimated("");
      setSubjectId("");
      setChapterId("");
      setSubtopicId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const subjects = syllabus?.subjects ?? [];
  const chapters = (syllabus?.chapters ?? []).filter(
    (chapter) => !subjectId || String(chapter.subjectId) === subjectId,
  );
  const chapter = chapters.find((item) => String(item.id) === chapterId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      eyebrow="PLANNER / MANUAL CONTROL"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!title.trim()}
            onClick={() => mutation.mutate()}
          >
            {task ? "Save task" : "Add task"}
          </Button>
        </>
      }
    >
      <div className="grid" style={{ gap: 13 }}>
        <Field label="Title" htmlFor={titleId}>
          <input
            id={titleId}
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </Field>
        <div className="form-grid">
          <Field label="Type">
            <select className="select" value={type} onChange={(event) => setType(event.target.value as TaskType)}>
              {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((value) => (
                <option key={value} value={value}>
                  {TASK_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="1">High</option>
              <option value="2">Medium</option>
              <option value="3">Low</option>
            </select>
          </Field>
          <Field label="Due date & time">
            <input
              className="input"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
          <Field label="Estimated minutes">
            <input
              className="input"
              type="number"
              min={5}
              max={600}
              value={estimated}
              onChange={(event) => setEstimated(event.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Status">
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <div />
          <Field label="Subject">
            <select
              className="select"
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setChapterId("");
                setSubtopicId("");
              }}
            >
              <option value="">None</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chapter">
            <select
              className="select"
              value={chapterId}
              onChange={(event) => {
                setChapterId(event.target.value);
                setSubtopicId("");
              }}
            >
              <option value="">None</option>
              {chapters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subtopic" className="span-full">
            <select
              className="select"
              value={subtopicId}
              onChange={(event) => setSubtopicId(event.target.value)}
              disabled={!chapter}
            >
              <option value="">None</option>
              {(chapter?.subtopics ?? []).map((subtopic) => (
                <option key={subtopic.id} value={subtopic.id}>
                  {subtopic.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional details, instructions or page numbers…"
          />
        </Field>
        {mutation.error && (
          <InlineNotice tone="danger" title="Could not save task">
            {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </InlineNotice>
        )}
      </div>
    </Modal>
  );
}

export default function Planner() {
  const { data: tasks, isLoading, error, refetch } = useTasks({ limit: 500 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<"day" | "all">("day");
  const [statusFilter, setStatusFilter] = useState<"open" | "completed" | "all">("open");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [search, setSearch] = useState("");

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["session"] }),
    ]);
  };

  const toggle = useMutation({
    mutationFn: (task: Task) =>
      api.updateTask(task.id, { status: task.status === "completed" ? "pending" : "completed" }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteTask(id),
    onSuccess: invalidate,
  });

  const all = tasks ?? [];
  const isOpenTask = (task: Task) => task.status === "pending" || task.status === "in_progress";
  const openTasks = all.filter(isOpenTask);
  const overdue = openTasks.filter((task) => task.dueAt && new Date(task.dueAt) < new Date());
  const today = new Date();
  const dueThisWeek = openTasks.filter((task) => {
    if (!task.dueAt) return false;
    const due = new Date(task.dueAt);
    return due >= today && due <= addDays(today, 7);
  });
  const completed = all.filter((task) => task.status === "completed");

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  const taskDates = useMemo(() => {
    const map = new Map<string, { count: number; hasTest: boolean; hasOverdue: boolean }>();
    for (const task of all) {
      if (!task.dueAt) continue;
      const key = format(new Date(task.dueAt), "yyyy-MM-dd");
      const entry = map.get(key) ?? { count: 0, hasTest: false, hasOverdue: false };
      entry.count += 1;
      if (task.type === "test" || task.type === "exam") entry.hasTest = true;
      if (isOpenTask(task) && new Date(task.dueAt) < new Date()) entry.hasOverdue = true;
      map.set(key, entry);
    }
    return map;
  }, [all]);

  const baseList = all.filter((task) => {
    if (statusFilter === "open" && !isOpenTask(task)) return false;
    if (statusFilter === "completed" && task.status !== "completed") return false;
    if (search.trim() && !`${task.title} ${task.chapterName ?? ""} ${task.subjectName ?? ""}`.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (view === "all") return true;
    if (!task.dueAt) return task.status !== "completed";
    return isSameDay(new Date(task.dueAt), selectedDate);
  });
  const overdueGroupTasks = baseList.filter(
    (task) =>
      task.dueAt &&
      new Date(task.dueAt) < new Date() &&
      isOpenTask(task) &&
      !isSameDay(new Date(task.dueAt), selectedDate),
  );
  const overdueIds = new Set(overdueGroupTasks.map((task) => task.id));
  const scheduledTasks = baseList.filter((task) => task.dueAt && !overdueIds.has(task.id));
  const dayGroups = [
    { title: "Overdue", tasks: overdueGroupTasks },
    {
      title: view === "day" ? format(selectedDate, "EEEE, d MMMM") : "Scheduled",
      tasks: scheduledTasks,
    },
    {
      title: "No due date",
      tasks: baseList.filter((task) => !task.dueAt),
    },
  ].filter((group) => group.tasks.length > 0);

  if (isLoading) return <LoadingPanel label="Loading planner…" />;
  if (error) return <ErrorPanel error={error} retry={() => void refetch()} />;

  const aiPrompt = encodeURIComponent(
    "Review my open tasks, upcoming deadlines, and evidence-backed weak topics. Build a realistic plan for today and the next few days, and propose specific tasks for me to approve. Be honest about missing information and do not invent progress.",
  );

  return (
    <>
      <PageHeader
        eyebrow="PLANNER / ACADEMIC OPERATIONS"
        title="Plan the next useful move"
        description="Assignments, homework, revision, tests and exams live here. Urgency combines deadline proximity, priority and evidence-backed weak areas; you always retain manual control."
        actions={
          <>
            <Button
              variant="subtle"
              icon={<Bot size={14} />}
              onClick={() => navigate(`/assistant?prompt=${aiPrompt}`)}
            >
              AI plan review
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => setModal({ open: true, task: null })}
            >
              Add task
            </Button>
          </>
        }
        meta={
          <>
            <span>{openTasks.length} open tasks</span>
            <span>{overdue.length} overdue</span>
            <span>{dueThisWeek.length} due in 7 days</span>
          </>
        }
      />

      <div className="grid cols-4 mb-16">
        <Metric label="Open tasks" value={openTasks.length} sub="Pending or in progress" tone="primary" icon={<CalendarDays size={15} />} />
        <Metric label="Overdue" value={overdue.length} sub="Past due and still open" tone={overdue.length > 0 ? "danger" : "neutral"} />
        <Metric label="Due in 7 days" value={dueThisWeek.length} sub="Deadline proximity window" tone="warn" />
        <Metric label="Completed" value={completed.length} sub="All-time completed records" tone="success" />
      </div>

      <div className="std-grid">
        <div className="settings-stack">
          <Panel>
            <PanelHead
              eyebrow="WEEK VIEW"
              title={format(weekStart, "d MMM") + " — " + format(addDays(weekStart, 6), "d MMM yyyy")}
              actions={
                <div className="row gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(addDays(weekStart, -7))}
                    icon={<ChevronLeft size={13} />}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(addDays(weekStart, 7))}
                    icon={<ChevronRight size={13} />}
                  />
                </div>
              }
            />
            <div className="week-strip">
              {weekDays.map((day) => {
                const entry = taskDates.get(format(day, "yyyy-MM-dd"));
                return (
                  <button
                    key={day.toISOString()}
                    className={`week-day ${isSameDay(day, selectedDate) ? "active" : ""}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span>{format(day, "EEE")}</span>
                    <strong>{format(day, "d")}</strong>
                    <small>{entry ? `${entry.count} task${entry.count === 1 ? "" : "s"}` : "—"}</small>
                  </button>
                );
              })}
            </div>
            <div className="between mt-12 wrap">
              <Tabs
                value={view}
                onChange={(value) => setView(value)}
                tabs={[
                  { value: "day", label: "Selected day" },
                  { value: "all", label: "All open" },
                ]}
              />
              <div className="row gap-8">
                <div className="search-input" style={{ minWidth: 180 }}>
                  <Search size={14} />
                  <input
                    className="input"
                    placeholder="Search tasks…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <select
                  className="select"
                  style={{ width: 120 }}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHead
              eyebrow="TASK REGISTER"
              title={view === "day" ? format(selectedDate, "EEEE, d MMMM") : "All matching tasks"}
              actions={
                <Button variant="subtle" size="sm" icon={<Plus size={12} />} onClick={() => setModal({ open: true, task: null })}>
                  Add
                </Button>
              }
            />
            {dayGroups.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarDays size={20} />}
                title={view === "day" ? "Nothing scheduled for this day" : "No tasks match this filter"}
                description="Add a task or switch the view. Completed and cancelled tasks stay in the register."
                action={
                  <Button variant="outline" size="sm" onClick={() => setModal({ open: true, task: null })}>
                    Add task
                  </Button>
                }
              />
            ) : (
              <div className="settings-stack">
                {dayGroups.map((group) => (
                  <div key={group.title}>
                    <div className="between mb-8">
                      <div className="eyebrow">{group.title.toUpperCase()}</div>
                      <span className="mono tiny faint">{group.tasks.length}</span>
                    </div>
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={() => toggle.mutate(task)}
                        onEdit={() => setModal({ open: true, task })}
                        onDelete={() => {
                          if (window.confirm(`Delete “${task.title}”? This removes the task record.`)) {
                            remove.mutate(task.id);
                          }
                        }}
                        showDescription
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {(toggle.error || remove.error) && (
              <div className="mt-12">
                <InlineNotice tone="danger" title="Task action failed">
                  {(toggle.error ?? remove.error) instanceof Error
                    ? (toggle.error ?? remove.error)?.message
                    : String(toggle.error ?? remove.error)}
                </InlineNotice>
              </div>
            )}
          </Panel>
        </div>

        <div className="settings-stack">
          <Panel>
            <PanelHead
              eyebrow="CALENDAR"
              title={format(month, "MMMM yyyy")}
              actions={
                <div className="row gap-4">
                  <Button variant="ghost" size="sm" onClick={() => setMonth(subMonths(month, 1))} icon={<ChevronLeft size={13} />} />
                  <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
                    Now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))} icon={<ChevronRight size={13} />} />
                </div>
              }
            />
            <div className="calendar">
              <div className="calendar-grid">
                {weekdayLabels.map((label) => (
                  <div className="calendar-weekday" key={label}>
                    {label}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const entry = taskDates.get(format(day, "yyyy-MM-dd"));
                  return (
                    <button
                      key={day.toISOString()}
                      className={`calendar-day ${isSameMonth(day, month) ? "" : "outside"} ${
                        isSameDay(day, new Date()) ? "today" : ""
                      } ${isSameDay(day, selectedDate) ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedDate(day);
                        setView("day");
                      }}
                    >
                      {format(day, "d")}
                      {entry && (
                        <span className="calendar-dots">
                          {Array.from({ length: Math.min(4, entry.count) }, (_, index) => (
                            <span
                              key={index}
                              className={`calendar-dot ${entry.hasOverdue ? "overdue" : entry.hasTest ? "test" : ""}`}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="row gap-12 mt-12 tiny faint wrap">
              <span className="row gap-4"><i className="calendar-dot" /> task</span>
              <span className="row gap-4"><i className="calendar-dot test" /> test/exam</span>
              <span className="row gap-4"><i className="calendar-dot overdue" /> overdue</span>
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="PRIORITISATION" title="How urgency is ordered" />
            <p className="small muted">
              Deadline proximity and manual priority dominate. A linked chapter or subtopic with weak
              evidence adds a modest bonus, never an override. This is a sorting aid, not an AI
              judgement.
            </p>
            <div className="hint-text">
              AI plan review is a conversation, not an automatic rewrite. Any proposed task requires your
              approval in the assistant before it is created.
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-12"
              icon={<Bot size={13} />}
              onClick={() => navigate(`/assistant?prompt=${aiPrompt}`)}
            >
              Ask for a realistic plan
            </Button>
          </Panel>

          <Panel>
            <PanelHead eyebrow="DEADLINES / EXAMS" title="Upcoming" />
            {all
              .filter((task) => task.dueAt && isOpenTask(task))
              .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
              .slice(0, 6)
              .map((task) => (
                <div className="list-row" key={`upcoming-${task.id}`}>
                  <div className="list-row-main">
                    <div className="list-row-title">{task.title}</div>
                    <div className="list-row-sub">
                      <span>{fmtDate(task.dueAt)}</span>
                      <span>{TASK_TYPE_LABELS[task.type]}</span>
                    </div>
                  </div>
                  <Badge tone={task.type === "exam" || task.type === "test" ? "warn" : "neutral"}>
                    {task.type}
                  </Badge>
                </div>
              ))}
            {all.filter((task) => task.dueAt && isOpenTask(task)).length === 0 && (
              <EmptyState compact title="No dated commitments" description="Add a task with a deadline to populate this list." />
            )}
          </Panel>
        </div>
      </div>

      <TaskModal
        open={modal.open}
        task={modal.task}
        defaultDate={selectedDate}
        onClose={() => setModal({ open: false, task: null })}
        onSaved={invalidate}
      />
    </>
  );
}
