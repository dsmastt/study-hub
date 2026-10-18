import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Database,
  Eye,
  FileJson,
  KeyRound,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { api } from "../api/client.ts";
import { useLauncher, useSettings, useSystemInfo } from "../api/hooks.ts";
import { PageHeader } from "../components/Layout.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import {
  Badge,
  Button,
  Field,
  InlineNotice,
  LoadingPanel,
  Panel,
  PanelHead,
  Spinner,
  useFieldId,
} from "../components/ui.tsx";
import { fmtDate } from "../lib/format.ts";

export default function SettingsPage() {
  const { data: settings, isLoading, error, refetch } = useSettings();
  const launcher = useLauncher();
  const system = useSystemInfo();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [dailyGoal, setDailyGoal] = useState("120");
  const [focus, setFocus] = useState("25");
  const [breakTime, setBreakTime] = useState("5");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [extractionModel, setExtractionModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const baseUrlId = useFieldId("ai-base-url");

  useEffect(() => {
    if (!settings) return;
    setDailyGoal(String(settings.dailyGoalMinutes));
    setFocus(String(settings.defaultFocusMinutes));
    setBreakTime(String(settings.defaultBreakMinutes));
    setBaseUrl(settings.ai.baseUrl);
    setModel(settings.ai.model);
    setExtractionModel(settings.ai.extractionModel);
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      api.updateSettings({
        dailyGoalMinutes: Number(dailyGoal),
        defaultFocusMinutes: Number(focus),
        defaultBreakMinutes: Number(breakTime),
        ai: {
          baseUrl,
          model,
          extractionModel,
          ...(clearKey ? { clearApiKey: true } : apiKey ? { apiKey } : {}),
        },
      }),
    onSuccess: async (next) => {
      setApiKey("");
      setClearKey(false);
      setTestResult(null);
      queryClient.setQueryData(["settings"], next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["ai"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });

  const test = useMutation({
    mutationFn: api.testAI,
    onSuccess: (result) => setTestResult({ ok: result.ok, message: result.message }),
    onError: (mutationError) =>
      setTestResult({
        ok: false,
        message: mutationError instanceof Error ? mutationError.message : String(mutationError),
      }),
  });

  const backup = useMutation({
    mutationFn: api.backup,
    onSuccess: (result) => setBackupPath(result.path),
  });

  if (isLoading) return <LoadingPanel label="Loading settings…" />;
  if (error || !settings) return <InlineNotice tone="danger" title="Could not load settings">{error instanceof Error ? error.message : String(error)}</InlineNotice>;

  const themeColours = theme.theme?.colours ?? {};
  const swatchKeys = ["primary", "secondary", "tertiary", "error", "surface", "background", "onSurface"];
  const launcherConfig = launcher.data?.config ?? null;
  const launcherWorkspaces = Array.isArray(launcherConfig?.workspaces)
    ? launcherConfig.workspaces
    : [];

  return (
    <>
      <PageHeader
        eyebrow="SYSTEM / CONFIGURATION"
        title="Settings"
        description="Provider configuration, study defaults, local data location and Caelestia integration. Data is stored on /mnt/Data; no secrets are sent anywhere except the AI provider you configure."
        actions={
          <Button
            variant="primary"
            icon={<Save size={14} />}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save settings
          </Button>
        }
        meta={
          <>
            <span>data: {settings.dataDir}</span>
            <span>schema: v{settings.schemaVersion}</span>
            <span>provider: {settings.ai.providerLabel}</span>
          </>
        }
      />

      {save.error && (
        <div className="mb-16">
          <InlineNotice tone="danger" title="Could not save settings">
            {save.error instanceof Error ? save.error.message : String(save.error)}
          </InlineNotice>
        </div>
      )}
      {save.isSuccess && (
        <div className="mb-16">
          <InlineNotice tone="success" title="Settings saved">
            Updated at {new Date().toLocaleTimeString()}.
          </InlineNotice>
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-stack">
          <Panel>
            <PanelHead
              eyebrow="AI PROVIDER"
              title="OpenAI-compatible configuration"
              subtitle="DeepSeek by default. Change the base URL and model to use another compatible provider."
              actions={<Badge tone={settings.ai.hasApiKey ? "success" : "danger"} dot>{settings.ai.hasApiKey ? "KEY SET" : "NO KEY"}</Badge>}
            />
            <div className="form-grid">
              <Field label="Base URL" hint="For DeepSeek use https://api.deepseek.com. The app appends /chat/completions." htmlFor={baseUrlId}>
                <input
                  id={baseUrlId}
                  className="input"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://api.deepseek.com"
                />
              </Field>
              <Field label="Chat model">
                <input className="input" value={model} onChange={(event) => setModel(event.target.value)} />
              </Field>
              <Field label="Extraction / generation model" hint="May be the same model for now.">
                <input
                  className="input"
                  value={extractionModel}
                  onChange={(event) => setExtractionModel(event.target.value)}
                />
              </Field>
              <Field
                label="API key"
                hint={
                  settings.ai.hasApiKey
                    ? `Stored key ${settings.ai.apiKeyHint}. Leave blank to keep it unchanged.`
                    : "Required for AI chat, worksheet extraction and question generation."
                }
              >
                <input
                  className="input"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={settings.ai.hasApiKey ? "•••••••• (unchanged)" : "sk-…"}
                  autoComplete="off"
                />
              </Field>
            </div>
            <label className="checkline mt-12">
              <input type="checkbox" checked={clearKey} onChange={(event) => setClearKey(event.target.checked)} />
              Remove the stored API key.
            </label>
            <div className="hint-text row gap-4">
              <ShieldCheck size={12} /> The key is stored in the local SQLite database under the app data
              directory and is masked in API responses. Environment variables take precedence over stored
              values.
            </div>
            <div className="row gap-8 mt-12 wrap">
              <Button
                variant="subtle"
                size="sm"
                icon={<RefreshCw size={13} />}
                loading={test.isPending}
                onClick={() => test.mutate()}
              >
                Test saved connection
              </Button>
              <span className="tiny faint">Tests the currently saved configuration, not unsaved edits.</span>
            </div>
            {testResult && (
              <div className="mt-12">
                <InlineNotice tone={testResult.ok ? "success" : "danger"} title={testResult.ok ? "Connection OK" : "Connection failed"}>
                  {testResult.message}
                </InlineNotice>
              </div>
            )}
            {!settings.ai.hasApiKey && (
              <div className="mt-12">
                <InlineNotice tone="info" title="Environment alternative">
                  You can set <code>DEEPSEEK_API_KEY</code> (or <code>STUDY_HUB_AI_API_KEY</code>) before
                  launching the server. Environment values override stored settings.
                </InlineNotice>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead
              eyebrow="STUDY DEFAULTS"
              title="Timer targets and daily goal"
              subtitle="Targets are guidance. The timer is a stopwatch and never locks you out or ends your session automatically."
            />
            <div className="form-grid">
              <Field label="Daily focus goal (minutes)">
                <input className="input" type="number" min={15} max={1440} value={dailyGoal} onChange={(event) => setDailyGoal(event.target.value)} />
              </Field>
              <Field label="Focus target (minutes)">
                <input className="input" type="number" min={5} max={180} value={focus} onChange={(event) => setFocus(event.target.value)} />
              </Field>
              <Field label="Break target (minutes)">
                <input className="input" type="number" min={1} max={60} value={breakTime} onChange={(event) => setBreakTime(event.target.value)} />
              </Field>
            </div>
            <div className="hint-text">
              Daily goal progress uses recorded focus from sessions started today. A timer running is not
              treated as proof of attention, and a slow session is not automatically a wasted one.
            </div>
          </Panel>

          <Panel>
            <PanelHead
              eyebrow="DATA / RECOVERY"
              title="Local database and backups"
              subtitle="SQLite storage on the mounted data partition. The database is not in your main Arch partition."
            />
            <div className="info-list">
              <div className="info-row">
                <span>Data directory</span>
                <span>{settings.dataDir}</span>
              </div>
              <div className="info-row">
                <span>Database</span>
                <span>{settings.dataDir}/study-hub.db</span>
              </div>
              <div className="info-row">
                <span>Pre-migration backups</span>
                <span>{settings.dataDir}/backups</span>
              </div>
              <div className="info-row">
                <span>Theme source</span>
                <span>{theme.theme?.source ?? "not found"}</span>
              </div>
            </div>
            <div className="row gap-8 mt-12 wrap">
              <Button variant="subtle" size="sm" icon={<Database size={13} />} loading={backup.isPending} onClick={() => backup.mutate()}>
                Create database backup
              </Button>
              {backupPath && <span className="mono tiny faint">{backupPath}</span>}
            </div>
            <div className="hint-text">
              Backups are created with SQLite's VACUUM INTO so they are consistent while the app is
              running. A pre-migration snapshot is also attempted automatically.
            </div>
          </Panel>

          <Panel>
            <PanelHead
              eyebrow="STUDY LAUNCHER"
              title="Hyprland workspace command"
              subtitle="The launcher creates a session record, starts the app if needed, opens browser windows, and moves them to the configured workspaces."
            />
            <div className="info-list">
              <div className="info-row">
                <span>Config path</span>
                <span>{settings.launcherConfigPath}</span>
              </div>
              <div className="info-row">
                <span>Config status</span>
                <span>{launcher.data?.exists ? "present" : "created on first run"}</span>
              </div>
              <div className="info-row">
                <span>Browser</span>
                <span>{launcherConfig?.browser?.command ?? "zen-browser (default)"}</span>
              </div>
              {launcherWorkspaces.map((workspace) => (
                <div className="info-row" key={workspace.key}>
                  <span>{workspace.label ?? workspace.key}</span>
                  <span>
                    workspace {workspace.target ?? "?"} · {workspace.url ?? "no URL"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-12">
              <div className="eyebrow mb-8">COMMAND</div>
              <div className="code-block">study</div>
            </div>
            <div className="hint-text">
              Workspaces, URLs, browser fallback and overflow strategy are editable in the launcher JSON.
              Existing windows are reused when title matching succeeds; occupied study workspaces overflow
              to workspaces 5, 6, 7… by default.
            </div>
            {launcher.data?.error && (
              <div className="mt-12">
                <InlineNotice tone="danger" title="Launcher config could not be parsed">
                  {launcher.data.error}
                </InlineNotice>
              </div>
            )}
          </Panel>
        </div>

        <div className="settings-stack">
          <Panel>
            <PanelHead
              eyebrow="CAELESTIA"
              title="Live theme link"
              actions={<Badge tone={theme.connected ? "success" : "muted"} dot>{theme.connected ? "STREAMING" : "OFFLINE"}</Badge>}
            />
            <div className="info-list">
              <div className="info-row">
                <span>Palette</span>
                <span>{theme.theme?.name ?? "fallback"}</span>
              </div>
              <div className="info-row">
                <span>Mode</span>
                <span>{theme.theme?.mode ?? "dark"}</span>
              </div>
              <div className="info-row">
                <span>Flavour</span>
                <span>{theme.theme?.flavour ?? "—"}</span>
              </div>
              <div className="info-row">
                <span>Last update</span>
                <span>{theme.theme?.updatedAt ? fmtDate(theme.theme.updatedAt) : "—"}</span>
              </div>
            </div>
            <div className="row gap-6 mt-12 wrap">
              {swatchKeys.map((key) => (
                <span
                  key={key}
                  title={`${key}: #${themeColours[key] ?? "missing"}`}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: themeColours[key] ? `#${themeColours[key]}` : "var(--border)",
                    border: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
            <div className="hint-text">
              Reads the active Caelestia scheme from <code>~/.local/state/caelestia/scheme.json</code> and
              watches it for changes. If the file or a colour is missing, a fallback palette keeps the UI
              usable.
            </div>
            <Button variant="subtle" size="sm" className="mt-12" icon={<Palette size={13} />} onClick={() => void theme.refresh()}>
              Re-read theme
            </Button>
          </Panel>

          <Panel>
            <PanelHead eyebrow="ENVIRONMENT" title="System status" />
            <div className="info-list">
              <div className="info-row">
                <span>Hyprland session</span>
                <span className="row gap-4">
                  {system.data?.hyprland ? <CheckCircle2 size={12} className="text-success" /> : <Eye size={12} />}
                  {system.data?.hyprland ? "detected" : "not detected"}
                </span>
              </div>
              <div className="info-row">
                <span>Caelestia scheme</span>
                <span>{theme.theme?.available ? "theme linked" : "fallback palette"}</span>
              </div>
              <div className="info-row">
                <span>AI configured</span>
                <span>{settings.ai.hasApiKey ? "yes" : "no"}</span>
              </div>
            </div>
            <div className="hint-text">
              The app binds to <code>127.0.0.1</code>. The AI assistant cannot access the shell or
              arbitrary files; only explicit app tools are exposed.
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="DOCS" title="Key files" />
            <div className="info-list">
              <div className="info-row">
                <span>Requirements</span>
                <span>instructions.md</span>
              </div>
              <div className="info-row">
                <span>Launcher</span>
                <span>scripts/study</span>
              </div>
              <div className="info-row">
                <span>Config</span>
                <span>~/.config/study-hub/launcher.json</span>
              </div>
              <div className="info-row">
                <span>Logs</span>
                <span>$XDG_STATE_HOME/study-hub/server.log</span>
              </div>
            </div>
            <div className="row gap-6 mt-12">
              <Terminal size={14} className="faint" />
              <span className="mono tiny faint">study --dry-run</span>
            </div>
            <div className="hint-text">
              Dry-run prints the detected workspaces and planned actions without launching windows or
              creating a session.
            </div>
          </Panel>

          <Panel>
            <PanelHead eyebrow="PRIVACY" title="Local-first" />
            <p className="small muted">
              Syllabus, attempts, tasks, sessions and chat history are stored locally. Only AI requests
              leave the machine, and only when you initiate a chat, extraction or generation. No analytics
              or telemetry are included.
            </p>
            <div className="row gap-6 mt-12">
              <KeyRound size={13} className="faint" />
              <FileJson size={13} className="faint" />
              <Bot size={13} className="faint" />
              <span className="tiny faint">Provider-agnostic · tool-bound · no shell</span>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
