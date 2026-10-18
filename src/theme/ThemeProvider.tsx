import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ThemePayload } from "../../shared/types.ts";
import { api } from "../api/client.ts";

const FALLBACK_THEME: Record<string, string> = {
  background: "101415",
  surface: "050505",
  surfaceContainerLowest: "080b0b",
  surfaceContainerLow: "0b0f0f",
  surfaceContainer: "0e1312",
  surfaceContainerHigh: "121816",
  surfaceContainerHighest: "171f1c",
  onSurface: "e8efec",
  onSurfaceVariant: "a5b3ac",
  outline: "6a756f",
  outlineVariant: "26302c",
  primary: "42d17a",
  onPrimary: "06170d",
  primaryContainer: "123a24",
  secondary: "7bd6a5",
  tertiary: "9ed8c0",
  error: "e07a80",
  success: "74d6a1",
  blue: "78b8e0",
  mauve: "b9a0e8",
  peach: "e8b47e",
  sky: "8fd4e8",
  text: "e8efec",
  subtext0: "9aa8a1",
  overlay1: "6d7a74",
};

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (cleaned.length === 6 || cleaned.length === 8) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return null;
}

function colour(colours: Record<string, string>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = colours[key];
    if (value) return `#${value.replace(/^#/, "")}`;
  }
  return fallback;
}

function applyTheme(theme: ThemePayload): void {
  const colours = theme.available && theme.colours ? { ...FALLBACK_THEME, ...theme.colours } : FALLBACK_THEME;
  const root = document.documentElement;
  const pick = (keys: string[], fallback: string) => colour(colours, keys, fallback);
  const vars: Record<string, string> = {
    "--bg": pick(["background", "base", "crust"], "#101415"),
    "--bg-deep": pick(["surfaceContainerLowest", "mantle", "base"], "#080b0b"),
    "--panel": pick(["surfaceContainerLow", "surfaceContainer", "surface"], "#0b0f0f"),
    "--panel-strong": pick(["surfaceContainerHigh", "surfaceContainerHighest", "surfaceBright"], "#121816"),
    "--panel-raised": pick(["surfaceContainerHighest", "surfaceContainerHigh", "surfaceBright"], "#171f1c"),
    "--surface": pick(["surface"], "#050505"),
    "--surface-2": pick(["surfaceContainerHigh"], "#121816"),
    "--text": pick(["onSurface", "text", "foreground"], "#e8efec"),
    "--text-dim": pick(["onSurfaceVariant", "subtext0", "subtext1"], "#a5b3ac"),
    "--text-faint": pick(["overlay1", "overlay0", "subtext0"], "#6d7a74"),
    "--text-ghost": pick(["overlay0", "overlay1"], "#525e58"),
    "--border": pick(["outlineVariant", "surfaceVariant"], "#26302c"),
    "--border-strong": pick(["outline"], "#6a756f"),
    "--accent": pick(["primary", "blue"], "#42d17a"),
    "--on-accent": pick(["onPrimary", "base"], "#06170d"),
    "--accent-soft": pick(["primaryContainer", "surfaceContainerHighest"], "#123a24"),
    "--accent-2": pick(["tertiary", "secondary"], "#9ed8c0"),
    "--accent-3": pick(["secondary", "sky"], "#7bd6a5"),
    "--success": pick(["success", "term2", "green", "primary"], "#74d6a1"),
    "--danger": pick(["error", "red", "term1"], "#e07a80"),
    "--warning": pick(["tertiary", "peach", "yellow"], "#e8b47e"),
    "--info": pick(["blue", "sky", "term4"], "#78b8e0"),
    "--chart-1": pick(["primary", "green"], "#42d17a"),
    "--chart-2": pick(["tertiary", "teal"], "#9ed8c0"),
    "--chart-3": pick(["blue", "sky"], "#78b8e0"),
    "--chart-4": pick(["mauve", "lavender"], "#b9a0e8"),
    "--chart-5": pick(["peach", "yellow"], "#e8b47e"),
    "--chart-6": pick(["pink", "red"], "#e08aa0"),
  };

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
    const rgb = hexToRgb(value);
    if (rgb) root.style.setProperty(`${key}-rgb`, `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);
  }
  root.dataset.themeMode = theme.mode ?? "dark";
  root.dataset.themeAvailable = theme.available ? "true" : "false";
  root.dataset.themeName = theme.name ?? "fallback";
  root.style.colorScheme = theme.mode === "light" ? "light" : "dark";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", vars["--bg"]);
}

interface ThemeContextValue {
  theme: ThemePayload | null;
  connected: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  connected: false,
  refresh: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePayload | null>(null);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api.theme();
      setTheme(next);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const source = new EventSource("/api/theme/stream");
    const onTheme = (event: MessageEvent<string>) => {
      try {
        setTheme(JSON.parse(event.data) as ThemePayload);
        setConnected(true);
      } catch {
        // ignore malformed theme events
      }
    };
    source.addEventListener("theme", onTheme as EventListener);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    return () => {
      source.removeEventListener("theme", onTheme as EventListener);
      source.close();
    };
  }, [refresh]);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, connected, refresh }), [theme, connected, refresh]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
