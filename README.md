# Study Hub

A local-first, AI-assisted academic command center for JEE (Mains + Advanced) preparation, built for **Arch Linux + Hyprland + Caelestia Shell**.

The app tracks Physics, Chemistry and Mathematics by **subject → chapter → subtopic**, records real question attempts and study sessions, and derives mastery with a deterministic, explainable model. It does not ship with sample progress or invented statistics.

---

## Features

- **Command center dashboard** — active session, evidence-based briefing, today's plan, deadlines, weak topics, mastery coverage, weekly focus/attempt charts, recent attempts, recent sessions.
- **JEE syllabus** — 71 chapters and 363 subtopics seeded for Physics, Chemistry and Mathematics, with a dedicated page per chapter.
- **Deterministic mastery** — calculated from recorded attempts with correctness, difficulty, recency, hints/solutions, repetition damping and evidence thresholds. No LLM-invented percentages.
- **Question system** — manual questions, AI-generated sets, worksheet upload + AI extraction, review queue for untrusted extracted content, attempt recording, mistake types, confidence, hints and solution views.
- **Planner** — tasks, assignments, projects, tests, exams and revision; week strip and month calendar; deadline/priority/weakness-based urgency ordering.
- **Sessions and timers** — session records, explicit focus/break start, pause, resume, end, configurable targets, notes and evidence-based summaries. No lockouts or quiz gates.
- **AI assistant** — DeepSeek-compatible chat with explicit tools, server-side validation, approval for consequential actions, no shell access, and a deliberately restrained personality.
- **Caelestia theme integration** — reads the live Caelestia scheme and updates CSS colours through a server-sent event stream. Safe fallback palette when unavailable.
- **`study` launcher** — starts the server/session and arranges Lecture Station (workspace 1), ChatGPT (2), Study Hub (3) and NotebookLM (4), with configurable overflow.
- **Local data + backup** — SQLite on `/mnt/Data` (default), consistent backups via `VACUUM INTO`, pre-migration snapshots.

---

## Requirements

- Node.js **22.5+** (uses built-in `node:sqlite`; tested on Node 26)
- `pnpm` (preferred) or `npm`
- For the launcher: Hyprland, `hyprctl`, `jq`, `curl`, `notify-send` (optional), `zen-browser` or Firefox
- Caelestia Shell for live theme colours (optional; fallback palette is used otherwise)

---

## Quick start

```bash
cd /mnt/Data/app/study-hub
pnpm install
pnpm build
pnpm start
# open http://127.0.0.1:1737
```

Development:

```bash
pnpm dev        # backend :1737 + Vite :5173
```

Install the desktop/terminal command:

```bash
pnpm install-command
study --dry-run
study
```

`study` creates a **session record but does not start a timer**. Opening the dashboard also never starts a timer.

---

## AI configuration

Default provider is DeepSeek's OpenAI-compatible API:

- Base URL: `https://api.deepseek.com`
- Model: `deepseek-chat`
- Extraction/generation model: `deepseek-chat`

Configure the provider and API key in **Settings**, or via environment variables:

```bash
export DEEPSEEK_API_KEY=sk-...
# optional overrides
export STUDY_HUB_AI_BASE_URL=https://api.deepseek.com
export STUDY_HUB_AI_MODEL=deepseek-chat
export STUDY_HUB_AI_API_KEY=sk-...
```

Environment values override values stored in the local database. Any OpenAI-compatible chat-completions endpoint can be used; the application is not tied to DeepSeek.

The AI can read app data through tools (`get_study_overview`, `get_weak_topics`, `get_tasks`, `get_chapter_detail`, etc.), start/pause/resume timers, and propose task or question changes. Writes that change data require approval in the chat UI. It has no shell, filesystem or arbitrary network access.

---

## The `study` launcher

Installed to `~/.local/bin/study` by `pnpm install-command`. Config lives at:

```
~/.config/study-hub/launcher.json
```

Default behaviour:

| Workspace | App | Default URL |
|---|---|---|
| 1 | Lecture Station | `about:blank` (configurable) |
| 2 | ChatGPT | `https://chatgpt.com` |
| 3 | Study Hub | `{{BASE_URL}}` → local app |
| 4 | NotebookLM | `https://notebooklm.google.com` |

- If a target workspace already contains unrelated windows, the new/reused study window overflows to workspace **5, 6, 7, 8** (configurable `occupiedStrategy`: `overflow`, `relocate` or `use`).
- Existing windows are reused by saved window address and then by title match (`ChatGPT`, `Study Hub`, `NotebookLM`, …), preventing duplicate instances.
- If the server is down, the launcher starts it (and builds the frontend on first run). It waits for `/api/health`.
- If a browser is missing, configured fallbacks are tried. Failures are logged and reported without breaking the rest of the session.
- Window addresses are stored in `~/.local/state/study-hub/windows.json`; logs in `~/.local/state/study-hub/study.log`.
- `study --dry-run` shows detected windows/workspaces, reuse plans and overflow destinations **without launching anything or creating a session**.
- `focusWorkspace: "auto"` focuses the first study destination (important when everything overflows).

Recommended config for the lecture station: set `workspaces[0].url` to your lesson site and add a title fragment to `match` so the launcher can reuse the window on subsequent runs.

The dashboard uses `{{BASE_URL}}` substitution so changing `server.port` keeps workspace 3 correct.

---

## Data and persistence

Default data directory (already on `/mnt/Data`):

```
/mnt/Data/app/study-hub/data/          (0700)
  study-hub.db                         (0600)
  .api-token                           (0600, local API token)
  backups/study-hub-<timestamp>-<reason>.db   (0600)
```

Override with `STUDY_HUB_DATA_DIR`, for example:

```bash
STUDY_HUB_DATA_DIR=/mnt/Vault/study-hub-data pnpm start
```

The schema is versioned in the `meta` table. Before a schema migration the app creates a consistent backup and aborts startup if that backup fails. Manual backups are available in **Settings → Data / Recovery**. Existing data/backup files are re-secured to owner-only permissions at startup.

Tables include: `subjects`, `chapters`, `subtopics`, `questions`, `attempts`, `tasks`, `sessions`, `progress_snapshots`, `chat_messages`, `pending_actions`, `settings`, `meta`.

The app never creates invented attempts, sessions or mastery values. Empty views remain empty until you record real activity.

---

## Mastery model

Mastery is computed per subtopic from recorded attempts only:

- **Correctness** — correct `1.0`, partial `0.5`, incorrect `0`, skipped excluded from mastery evidence.
- **Difficulty weight** — easy `0.75×`, medium `1.0×`, hard `1.3×`.
- **Recency** — exponential decay with a 90-day half-life.
- **Independence** — hints reduce weight (`1/(1+0.4·hints)`); viewing the solution applies `0.25×`.
- **Repetition damping** — the first attempt of a question counts fully; repeated attempts on the same question decay (`0.4^(n-1)`, floor `0.12`).
- **Evidence threshold** — a subtopic needs ≥5 attempts, ≥4 distinct questions, ≥3.5 effective evidence, and ≥1.5 challenging evidence from medium/hard questions before a percentage is shown.
- **Uncertainty** — otherwise the UI shows “insufficient evidence” and the exact reasons.
- **Chapter/subject aggregation** — weighted average of measured subtopics only; withheld below 50% coverage of subtopic weight.
- **History** — snapshots are written after each attempt for trajectory charts.

The raw attempts remain the source of truth; the mastery implementation can be replaced without losing historical data.

---

## Local API security

The server binds to `127.0.0.1`, rejects requests whose `Host`/`Origin` does not match the configured local origins, and requires an API token for every sensitive `/api` route. The token is generated into `data/.api-token` with `0600` permissions. The page load installs it as a `SameSite=Strict` cookie; the frontend sends it as `X-Study-Hub-Token`.

The `study` launcher reads the same token file automatically. Public endpoints are limited to `/api/health` and the read-only theme endpoints. If you write external scripts, send:

```bash
curl -H "X-Study-Hub-Token: $(cat /mnt/Data/app/study-hub/data/.api-token)" \
  http://127.0.0.1:1737/api/dashboard
```

Changing `server.dataDir` while another Study Hub server is running on the same port is rejected by the launcher instead of silently recording into the wrong database.

## Caelestia theme integration

The server reads:

```
~/.local/state/caelestia/scheme.json
```

and polls it every second, broadcasting changes over `GET /api/theme/stream` (SSE). The frontend maps Caelestia colours (`background`, `surfaceContainer*`, `primary`, `onSurface`, `outline`, `error`, terminal/accent colours, etc.) to CSS variables. No palette is hardcoded when the scheme is available; a dark fallback keeps the UI usable if the file is missing or malformed.

Override the scheme path with `CAELESTIA_SCHEME_PATH`.

---

## Architecture

```
server/
  index.ts              Express entry, static serving, health, errors
  db.ts                 schema, seeding, settings, backups, row mapping
  seed.ts               JEE Mains + Advanced syllabus seed
  mastery.ts            deterministic mastery model (pure, tested)
  api.ts                route mounting
  routes/               dashboard, syllabus, questions, attempts, tasks,
                        sessions, settings, theme, AI
  services/
    masteryService.ts   evidence aggregation and snapshots
    questionAI.ts       generation + worksheet extraction
    assistant.ts        tool definitions, confirmation flow, chat storage
    ai.ts               OpenAI-compatible client
    sessions.ts         timers and summaries
    tasks.ts            task CRUD + urgency ordering
    theme.ts            Caelestia scheme reader/watcher
shared/types.ts         cross-layer types
src/                    React + TypeScript frontend
  theme/                Caelestia CSS-variable provider + SSE
  api/                  typed client and React Query hooks
  components/           layout, charts, timer, attempt/editor modals, UI kit
  pages/                dashboard, syllabus, chapter, questions, planner,
                        sessions, assistant, settings
  styles.css            command-center design system
scripts/
  study                 Hyprland launcher
  install-command.sh    symlink + desktop entry + first build
config/
  launcher.example.json
tests/
  mastery.test.ts       deterministic model tests
```

---

## Verification

```bash
pnpm typecheck   # frontend + server
pnpm test        # mastery engine (12 tests)
pnpm build       # production frontend
```

Manual smoke tests used during development covered: session start → focus timer, task creation, manual question creation, attempt recording, mastery evidence, planning, ending a session, session summaries, and assistant tool approval against a mock OpenAI-compatible server.

The `study` launcher supports `--dry-run`; it was verified against a live Hyprland session with all four target workspaces occupied, correctly overflowing to 5–8.

---

## Known limitations / intentional choices

- Scanned image PDFs are **not OCRed**; text-based PDF/TXT/Markdown/CSV/TeX are supported and image files are rejected rather than guessed. Scanned worksheets need OCR converted to text first.
- The focus/break timers are stopwatch-style with configurable **targets** shown in the UI; they do not auto-end or lock you out. Ending is always explicit.
- Session focus minutes are attributed to the session start date. The dashboard labels this limitation.
- One seeded syllabus is active (JEE). The data model is subject/chapter/subtopic based, so alternate syllabi can be introduced later without migrating attempts.
- AI request streaming is not implemented; assistant replies arrive as complete messages with tool events.
- Chat history is stored locally (SQLite). API keys are stored in the local database in plain text; the data directory and database are owner-only, but OS keyring storage is not implemented.
- The API token is a local convenience boundary, not a multi-user authentication system. Do not expose the server on `0.0.0.0`.
- No telemetry, analytics or remote sync.

---

## License

Personal project. No license specified yet.
