import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { DashboardData, DifficultyStats, Difficulty } from "../../shared/types.ts";
import { DIFFICULTY_LABELS, } from "../../shared/types.ts";
import { fmtMinutes } from "../lib/format.ts";

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number | string, name?: string) => string;
}

function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && (
        <div className="chart-tooltip-label">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      {payload.map((entry) => (
        <div className="chart-tooltip-row" key={String(entry.dataKey ?? entry.name)}>
          <span className="chart-tooltip-key" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <strong>{valueFormatter ? valueFormatter(entry.value ?? 0, entry.name) : String(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

const axis = {
  stroke: "var(--text-faint)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  fontFamily: "var(--font-mono)",
};

export function WeeklyActivityChart({ data }: { data: DashboardData["weeklyActivity"] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
          <XAxis
            dataKey="date"
            {...axis}
            tickFormatter={(value: string) => format(new Date(`${value}T12:00:00`), "EEE")}
          />
          <YAxis {...axis} allowDecimals width={44} />
          <YAxis yAxisId="right" orientation="right" {...axis} allowDecimals={false} width={28} />
          <Tooltip
            cursor={{ fill: "rgba(var(--accent-rgb), 0.06)" }}
            content={(props) => (
              <ChartTooltip
                {...(props as unknown as ChartTooltipProps)}
                labelFormatter={(value) => format(new Date(`${String(value)}T12:00:00`), "EEEE, d MMM")}
                valueFormatter={(value, name) =>
                  name === "Focus" ? fmtMinutes(Number(value)) : String(value)
                }
              />
            )}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}
          />
          <Bar dataKey="focusMinutes" name="Focus" fill="var(--chart-1)" radius={[2, 2, 0, 0]} barSize={22} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="attempts"
            name="Attempts"
            stroke="var(--chart-3)"
            strokeWidth={1.6}
            dot={{ r: 2.5, fill: "var(--chart-3)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChapterHistoryChart({
  data,
}: {
  data: { date: string; mastery: number | null; coverage: number; evidence: number }[];
}) {
  if (data.length < 2) {
    return (
      <div className="chart-empty">
        <span>Not enough recorded history yet.</span>
        <small>Mastery snapshots appear after each question attempt.</small>
      </div>
    );
  }
  const chartData = data.map((point) => ({
    ...point,
    coveragePct: Math.round(point.coverage * 1000) / 10,
  }));
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="masteryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
          <XAxis
            dataKey="date"
            {...axis}
            tickFormatter={(value: string) => format(new Date(`${value}T12:00:00`), "d MMM")}
            minTickGap={18}
          />
          <YAxis domain={[0, 100]} {...axis} width={40} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                {...(props as unknown as ChartTooltipProps)}
                labelFormatter={(value) => format(new Date(`${String(value)}T12:00:00`), "d MMM yyyy")}
                valueFormatter={(value) => `${value}%`}
              />
            )}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}
          />
          <Area
            type="monotone"
            dataKey="mastery"
            name="Evidence-backed mastery"
            stroke="var(--chart-1)"
            strokeWidth={1.8}
            fill="url(#masteryFill)"
            connectNulls={false}
            dot={{ r: 2, fill: "var(--chart-1)" }}
          />
          <Line
            type="monotone"
            dataKey="coveragePct"
            name="Subtopic coverage"
            stroke="var(--chart-4)"
            strokeDasharray="4 4"
            strokeWidth={1.2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DifficultyChart({ data }: { data: Record<Difficulty, DifficultyStats> }) {
  const chartData = (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((difficulty) => ({
    difficulty: DIFFICULTY_LABELS[difficulty],
    Correct: data[difficulty]?.correct ?? 0,
    Partial: data[difficulty]?.partial ?? 0,
    Incorrect: data[difficulty]?.incorrect ?? 0,
    accuracy: data[difficulty]?.accuracy,
    attempts: data[difficulty]?.attempts ?? 0,
  }));
  const totalAttempts = chartData.reduce((sum, item) => sum + item.attempts, 0);
  if (totalAttempts === 0) {
    return (
      <div className="chart-empty">
        <span>No recorded attempts yet.</span>
        <small>Difficulty breakdown appears once you attempt questions.</small>
      </div>
    );
  }
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="difficulty" {...axis} />
          <YAxis {...axis} allowDecimals={false} width={40} />
          <Tooltip
            cursor={{ fill: "rgba(var(--accent-rgb), 0.06)" }}
            content={(props) => <ChartTooltip {...(props as unknown as ChartTooltipProps)} valueFormatter={(value) => String(value)} />}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}
          />
          <Bar dataKey="Correct" stackId="a" fill="var(--chart-1)" barSize={32} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Partial" stackId="a" fill="var(--chart-5)" barSize={32} />
          <Bar dataKey="Incorrect" stackId="a" fill="var(--chart-6)" barSize={32} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


export function AttemptAccuracyBars({
  correct,
  partial,
  incorrect,
}: {
  correct: number;
  partial: number;
  incorrect: number;
}) {
  const total = correct + partial + incorrect;
  if (total === 0) return null;
  const segments = [
    { label: "Correct", value: correct, colour: "var(--chart-1)" },
    { label: "Partial", value: partial, colour: "var(--chart-5)" },
    { label: "Incorrect", value: incorrect, colour: "var(--chart-6)" },
  ].filter((segment) => segment.value > 0);
  return (
    <div className="accuracy-bars">
      <div className="accuracy-bar">
        {segments.map((segment) => (
          <span
            key={segment.label}
            title={`${segment.label}: ${segment.value}`}
            style={{ width: `${(segment.value / total) * 100}%`, background: segment.colour }}
          />
        ))}
      </div>
      <div className="accuracy-legend">
        {segments.map((segment) => (
          <span key={segment.label}>
            <i style={{ background: segment.colour }} /> {segment.label} {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}




export function SubjectBars({ subjects }: { subjects: DashboardData["subjects"] }) {
  return (
    <div className="subject-bars">
      {subjects.map((subject, index) => (
        <div className="subject-bar" key={subject.id}>
          <div className="subject-bar-top">
            <span>
              <i style={{ background: `var(--chart-${index + 1})` }} />
              {subject.name}
            </span>
            <strong>{subject.mastery === null ? "No estimate" : `${subject.mastery}%`}</strong>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${subject.mastery ?? 0}%`,
                background: `var(--chart-${index + 1})`,
                opacity: subject.mastery === null ? 0.2 : 1,
              }}
            />
          </div>
          <div className="subject-bar-sub">
            {subject.measuredSubtopics}/{subject.subtopicCount} subtopics measured · {Math.round(subject.coverage * 100)}% coverage
          </div>
        </div>
      ))}
    </div>
  );
}

export function MistakeDonut({
  mistakes,
}: {
  mistakes: { type: string; count: number }[];
}) {
  if (mistakes.length === 0) {
    return <div className="chart-empty"><span>No mistake patterns recorded.</span></div>;
  }
  const total = mistakes.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="mistake-list">
      {mistakes.map((item, index) => (
        <div className="mistake-row" key={item.type}>
          <span className="mistake-label">
            <i style={{ background: `var(--chart-${(index % 6) + 1})` }} />
            {item.type}
          </span>
          <div className="progress-track">
            <span
              style={{
                width: `${(item.count / total) * 100}%`,
                background: `var(--chart-${(index % 6) + 1})`,
              }}
            />
          </div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}


