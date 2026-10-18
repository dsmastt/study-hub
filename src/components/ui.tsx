import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { masteryTone } from "../lib/format.ts";

export function Panel({
  className,
  children,
  interactive,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div className={clsx("panel", interactive && "panel-interactive", className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHead({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div className="panel-head-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2 className="panel-title">{title}</h2>}
        {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="panel-head-actions">{actions}</div>}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "subtle",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className={clsx("btn", `btn-${variant}`, `btn-${size}`, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="spin" size={15} /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={clsx("icon-btn", className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

type BadgeTone = "neutral" | "primary" | "success" | "warn" | "danger" | "info" | "muted";

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={clsx("badge", `badge-${tone}`, className)}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function ScoreBadge({ correctness }: { correctness: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    correct: { tone: "success", label: "Correct" },
    partial: { tone: "warn", label: "Partial" },
    incorrect: { tone: "danger", label: "Incorrect" },
    skipped: { tone: "muted", label: "Skipped" },
  };
  const item = map[correctness] ?? { tone: "neutral" as BadgeTone, label: correctness };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

export function MasteryBadge({
  mastery,
  sufficient,
  compact = false,
}: {
  mastery: number | null;
  sufficient: boolean;
  compact?: boolean;
}) {
  if (!sufficient || mastery === null) {
    return (
      <Badge tone="muted" dot>
        {compact ? "No estimate" : "Insufficient evidence"}
      </Badge>
    );
  }
  return (
    <Badge tone={masteryTone(mastery)} dot>
      {mastery}% mastery
    </Badge>
  );
}

export function MasteryMeter({
  mastery,
  sufficient,
  reason,
  showReason = true,
}: {
  mastery: number | null;
  sufficient: boolean;
  reason?: string | null;
  showReason?: boolean;
}) {
  if (!sufficient || mastery === null) {
    return (
      <div className="mastery-meter insufficient">
        <div className="mastery-meter-head">
          <span className="mastery-value muted">—</span>
          <span className="mastery-caption">Insufficient evidence</span>
        </div>
        <div className="progress-track hatch">
          <span style={{ width: "100%" }} />
        </div>
        {showReason && reason && <p className="hint-text">{reason}</p>}
      </div>
    );
  }
  return (
    <div className={clsx("mastery-meter", `tone-${masteryTone(mastery)}`)}>
      <div className="mastery-meter-head">
        <span className="mastery-value">{mastery}%</span>
        <span className="mastery-caption">Mastery estimate</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${Math.max(2, Math.min(100, mastery))}%` }} />
      </div>
      {showReason && reason && <p className="hint-text">{reason}</p>}
    </div>
  );
}

export function MasteryRing({
  value,
  size = 84,
  label,
}: {
  value: number | null;
  size?: number;
  label?: string;
}) {
  const pct = value ?? 0;
  const tone = value === null ? "muted" : masteryTone(value);
  return (
    <div
      className={clsx("mastery-ring", `tone-${tone}`, value === null && "is-empty")}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--ring-colour) ${pct * 3.6}deg, var(--border) 0deg)`,
      }}
    >
      <div className="mastery-ring-inner">
        <strong>{value === null ? "—" : `${value}%`}</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "success" | "warn" | "danger" | "info";
  className?: string;
}) {
  return (
    <div className={clsx("progress-track", `tone-${tone}`, className)}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warn" | "danger" | "info";
  icon?: ReactNode;
}) {
  return (
    <div className={clsx("metric", `metric-${tone}`)}>
      <div className="metric-top">
        <span className="eyebrow">{label}</span>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("tabs", className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          className={clsx("tab", value === tab.value && "active")}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={clsx("field", className)}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function useFieldId(prefix = "field"): string {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={clsx("modal", `modal-${size}`)} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx("empty-state", compact && "compact")}>
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-row">
      <Loader2 className="spin" size={18} />
      {label && <span>{label}</span>}
    </div>
  );
}

export function LoadingPanel({ label = "Loading recorded data…" }: { label?: string }) {
  return (
    <Panel className="state-panel">
      <Spinner label={label} />
    </Panel>
  );
}

export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Panel className="state-panel error-panel">
      <XCircle size={20} />
      <div>
        <strong>Could not load this view</strong>
        <p>{error instanceof Error ? error.message : String(error)}</p>
      </div>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry}>
          Retry
        </Button>
      )}
    </Panel>
  );
}

export function InlineNotice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={clsx("notice", `notice-${tone}`)}>
      <Icon size={17} />
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

