import { Check, Clock, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { Task } from "../../shared/types.ts";
import { TASK_TYPE_LABELS } from "../../shared/types.ts";
import { fmtDateTime, fmtRelative } from "../lib/format.ts";
import { Badge, IconButton } from "./ui.tsx";

export function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  showDescription = false,
}: {
  task: Task;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showDescription?: boolean;
}) {
  const done = task.status === "completed";
  const overdue = task.dueAt !== null && !done && task.status !== "cancelled" && new Date(task.dueAt) < new Date();
  return (
    <div className={clsx("task-row", done && "done")}>
      {onToggle ? (
        <button
          className={clsx("task-check", done && "done")}
          onClick={onToggle}
          aria-label={done ? "Mark task as pending" : "Mark task as completed"}
          title={done ? "Mark as pending" : "Mark as completed"}
        >
          <Check size={11} />
        </button>
      ) : (
        <span className={clsx("task-check", done && "done")} aria-hidden="true">
          <Check size={11} />
        </span>
      )}
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {showDescription && task.description && (
          <div className="tiny faint mt-4">{task.description}</div>
        )}
        <div className="task-meta">
          <span className={clsx(overdue && "overdue")}>
            {task.dueAt ? (
              <>
                <Clock size={9} style={{ verticalAlign: -1, marginRight: 3 }} />
                {fmtDateTime(task.dueAt)} · {fmtRelative(task.dueAt)}
              </>
            ) : (
              "No due date"
            )}
          </span>
          <span>{TASK_TYPE_LABELS[task.type]}</span>
          {task.subjectName && <span>{task.subjectName}</span>}
          {task.chapterName && <span>{task.chapterName}</span>}
          {task.estimatedMinutes ? <span>~{task.estimatedMinutes}m</span> : null}
        </div>
      </div>
      <div className="task-actions">
        <Badge tone={task.priority === 1 ? "danger" : task.priority === 2 ? "warn" : "neutral"}>
          P{task.priority}
        </Badge>
        {onEdit && (
          <IconButton label="Edit task" onClick={onEdit}>
            <Pencil size={13} />
          </IconButton>
        )}
        {onDelete && (
          <IconButton label="Delete task" onClick={onDelete}>
            <Trash2 size={13} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
