import { format, formatDistanceToNow, isValid } from "date-fns";

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function fmtClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`;
  return `${pad(minutes)}:${pad(rest)}`;
}

export function fmtMinutes(minutes: number): string {
  if (minutes > 0 && minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}


export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return "—";
  return format(date, "d MMM yyyy");
}


export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return "—";
  return format(date, "d MMM yyyy, HH:mm");
}

export function fmtTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return "—";
  return format(date, "HH:mm");
}

export function fmtRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (!isValid(date)) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!isValid(date)) return null;
  return date.toISOString();
}


export function masteryTone(mastery: number | null): "success" | "primary" | "warn" | "danger" | "muted" {
  if (mastery === null) return "muted";
  if (mastery >= 80) return "success";
  if (mastery >= 60) return "primary";
  if (mastery >= 40) return "warn";
  return "danger";
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
