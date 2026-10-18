import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  Activity,
  Bot,
  CalendarDays,
  ChevronRight,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Timer,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useActiveSession, useAIStatus, useLiveTimer } from "../api/hooks.ts";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { fmtClock, fmtTime } from "../lib/format.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/syllabus", label: "Syllabus", icon: GraduationCap },
  { to: "/questions", label: "Questions", icon: FileQuestion },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/sessions", label: "Sessions", icon: Timer },
  { to: "/assistant", label: "Assistant", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

const pageNames: Record<string, string> = {
  "": "Dashboard",
  syllabus: "Syllabus",
  questions: "Questions",
  planner: "Planner",
  sessions: "Sessions",
  assistant: "Assistant",
  settings: "Settings",
};

function SystemClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <div className="topbar-clock">
      <span className="topbar-clock-time">{fmtTime(now)}</span>
      <span className="topbar-clock-date">
        {now.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })}
      </span>
    </div>
  );
}

function SessionPill() {
  const { data: session } = useActiveSession();
  const timer = useLiveTimer(session);
  if (!session) {
    return (
      <span className="status-pill muted">
        <span className="status-dot" />
        No session
      </span>
    );
  }
  const running = session.timerState === "running";
  return (
    <NavLink to="/sessions" className={clsx("status-pill", running ? "active" : "paused")}>
      <span className="status-dot" />
      <span>{running ? `${session.timerMode === "break" ? "Break" : "Focus"} ${fmtClock(timer.activeSeconds)}` : session.timerState === "paused" ? "Paused" : "Session idle"}</span>
    </NavLink>
  );
}

function AIStatusPill() {
  const { data } = useAIStatus();
  const configured = data?.configured ?? false;
  return (
    <NavLink to="/settings" className={clsx("topbar-chip", configured ? "online" : "offline")} title={configured ? `${data?.providerLabel} · ${data?.model}` : "AI is not configured"}>
      {configured ? <Wifi size={13} /> : <WifiOff size={13} />}
      <span>AI {configured ? "LINK" : "OFFLINE"}</span>
    </NavLink>
  );
}

export function Layout() {
  const location = useLocation();
  const { theme, connected } = useTheme();
  const segment = location.pathname.split("/")[1] ?? "";
  const pageName = pageNames[segment] ?? "Chapter";
  const now = new Date();

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={18} />
          </div>
          <div className="brand-text">
            <strong>STUDY//HUB</strong>
            <span>ACADEMIC COMMAND</span>
          </div>
        </div>

        <div className="sidebar-section-label">OPERATIONS</div>
        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => clsx("nav-item", isActive && "active")}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                <ChevronRight className="nav-chevron" size={13} />
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-session">
          <div className="sidebar-section-label">SESSION UPLINK</div>
          <SessionPill />
          <div className="sidebar-meta">
            <span>JEE MAIN + ADV</span>
            <span className="meta-sep">/</span>
            <span>{now.getFullYear()}</span>
          </div>
        </div>

        <div className="sidebar-foot">
          <div className="sidebar-theme">
            <span className={clsx("status-dot", connected ? "online" : "offline")} />
            <span>{theme?.name ?? "fallback palette"}</span>
          </div>
          <span className="sidebar-data">DATA / LOCAL</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-root">study-hub</span>
            <span className="breadcrumb-sep">/</span>
            <span>{pageName}</span>
            {segment === "syllabus" && location.pathname.split("/")[2] && (
              <>
                <span className="breadcrumb-sep">/</span>
                <span>chapter {location.pathname.split("/")[2]}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <SessionPill />
            <AIStatusPill />
            <SystemClock />
          </div>
        </header>
        <main className="page">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
