import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ThemePayload } from "../../shared/types.ts";

type ThemeListener = (theme: ThemePayload) => void;

const listeners = new Set<ThemeListener>();
let cached: ThemePayload = {
  available: false,
  fallback: true,
  source: null,
  name: null,
  mode: null,
  flavour: null,
  variant: null,
  colours: null,
  updatedAt: new Date().toISOString(),
  error: "Theme has not been read yet.",
};

function themeCandidates(): string[] {
  const candidates: string[] = [];
  if (process.env.CAELESTIA_SCHEME_PATH) candidates.push(process.env.CAELESTIA_SCHEME_PATH);
  candidates.push(
    path.join(os.homedir(), ".local", "state", "caelestia", "scheme.json"),
    path.join(os.homedir(), ".cache", "caelestia", "scheme.json"),
    path.join(os.homedir(), ".config", "caelestia", "scheme.json"),
  );
  return [...new Set(candidates)];
}

function normalizeColour(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3,8}$/.test(cleaned)) return null;
  return cleaned;
}

function readTheme(): ThemePayload {
  const candidates = themeCandidates();
  for (const candidate of candidates) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(candidate);
    } catch {
      continue;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(candidate, "utf8")) as Record<string, unknown>;
      const colourSource =
        (raw.colours as Record<string, unknown> | undefined) ??
        (raw.colors as Record<string, unknown> | undefined) ??
        (raw.palette as Record<string, unknown> | undefined) ??
        {};
      const colours: Record<string, string> = {};
      for (const [key, value] of Object.entries(colourSource)) {
        const normalized = normalizeColour(value);
        if (normalized) colours[key] = normalized;
      }
      if (Object.keys(colours).length === 0) {
        return {
          available: false,
          fallback: true,
          source: candidate,
          name: raw.name ? String(raw.name) : null,
          mode: raw.mode ? String(raw.mode) : null,
          flavour: raw.flavour ? String(raw.flavour) : null,
          variant: raw.variant ? String(raw.variant) : null,
          colours: null,
          updatedAt: stat.mtime.toISOString(),
          error: "Scheme file was found but contains no usable colour values.",
        };
      }
      return {
        available: true,
        fallback: false,
        source: candidate,
        name: raw.name ? String(raw.name) : null,
        mode: raw.mode ? String(raw.mode) : null,
        flavour: raw.flavour ? String(raw.flavour) : null,
        variant: raw.variant ? String(raw.variant) : null,
        colours,
        updatedAt: stat.mtime.toISOString(),
      };
    } catch (error) {
      return {
        available: false,
        fallback: true,
        source: candidate,
        name: null,
        mode: null,
        flavour: null,
        variant: null,
        colours: null,
        updatedAt: stat.mtime.toISOString(),
        error: `Could not parse Caelestia scheme: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  return {
    available: false,
    fallback: true,
    source: null,
    name: null,
    mode: null,
    flavour: null,
    variant: null,
    colours: null,
    updatedAt: new Date().toISOString(),
    error: "No Caelestia scheme file found. Using built-in fallback palette.",
  };
}

export function getTheme(): ThemePayload {
  cached = readTheme();
  return cached;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitIfChanged(): void {
  const next = readTheme();
  if (JSON.stringify(next) === JSON.stringify(cached)) return;
  cached = next;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch (error) {
      console.error("Theme listener error:", error);
    }
  }
}

const poll = setInterval(emitIfChanged, 1000);
poll.unref();

getTheme();
