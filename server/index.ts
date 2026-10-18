import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { apiRouter } from "./api.ts";
import { DATA_DIR, DB_PATH, ROOT_DIR, getPublicSettings, initDb } from "./db.ts";
import { errorHandler } from "./http.ts";
import { getApiToken, requireApiToken, setApiTokenCookie } from "./auth.ts";

const HOST = process.env.STUDY_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.STUDY_HUB_PORT ?? 1737);
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DEV_PORTS = [5173];
const extraHosts = (process.env.STUDY_HUB_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const allowedHosts = new Set(
  [
    `${HOST.toLowerCase()}:${PORT}`,
    `127.0.0.1:${PORT}`,
    `localhost:${PORT}`,
    `[::1]:${PORT}`,
    ...DEV_PORTS.flatMap((port) => [`127.0.0.1:${port}`, `localhost:${port}`]),
    ...extraHosts,
  ],
);
const allowedOrigins = new Set(
  [...allowedHosts].map((host) => `http://${host}`),
);

initDb();
getApiToken();

const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

// Reject cross-site/DNS-rebinding requests before any API or static handler.
app.use((req, res, next) => {
  const host = (req.headers.host ?? "").toLowerCase();
  if (!host || !allowedHosts.has(host)) {
    res.status(403).type("text/plain").send("Forbidden host.");
    return;
  }
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin.toLowerCase())) {
    res.status(403).type("text/plain").send("Forbidden origin.");
    return;
  }
  next();
});

// The page load installs a SameSite=Strict local token cookie. The frontend
// reads it and sends the matching header; the launcher reads the token file.
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) setApiTokenCookie(res);
  next();
});

app.get("/api/health", (_req, res) => {
  setApiTokenCookie(res);
  res.json({
    ok: true,
    app: "study-hub",
    version: "0.1.0",
    now: new Date().toISOString(),
    dataDir: DATA_DIR,
    database: DB_PATH,
    aiConfigured: getPublicSettings().ai.hasApiKey,
  });
});

app.use("/api", (req, res, next) => {
  const fullPath = req.originalUrl.split("?")[0];
  const publicGet =
    req.method === "GET" &&
    (req.path === "/health" ||
      req.path === "/theme" ||
      req.path === "/theme/stream" ||
      fullPath === "/api/health" ||
      fullPath === "/api/theme" ||
      fullPath === "/api/theme/stream");
  if (publicGet) return next();
  requireApiToken(req, res, next);
});
app.use("/api", express.json({ limit: "3mb" }));
app.use("/api", apiRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(200)
      .type("text/plain")
      .send(
        "Study Hub API is running. The frontend has not been built yet.\n\nRun `pnpm build` or use `pnpm dev` and open http://127.0.0.1:5173.\n",
      );
  });
}

app.use(errorHandler);

const server = app.listen(PORT, HOST, () => {
  console.log(`Study Hub listening on http://${HOST}:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
