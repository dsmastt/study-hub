import { Router } from "express";
import fs from "node:fs";
import { z } from "zod";
import type { AppSettings, LauncherConfig, LauncherSummary } from "../../shared/types.ts";
import {
  backupDatabase,
  getPublicSettings,
  launcherConfigPath,
  setSetting,
} from "../db.ts";
import { testAIConnection } from "../services/ai.ts";
import { getTheme } from "../services/theme.ts";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  res.json(getPublicSettings());
});

const settingsSchema = z
  .object({
    dailyGoalMinutes: z.number().int().min(15).max(1440).optional(),
    defaultFocusMinutes: z.number().int().min(5).max(180).optional(),
    defaultBreakMinutes: z.number().int().min(1).max(60).optional(),
    ai: z
      .object({
        baseUrl: z.string().url().max(500).optional(),
        model: z.string().trim().min(1).max(200).optional(),
        extractionModel: z.string().trim().min(1).max(200).optional(),
        apiKey: z.string().trim().max(500).optional(),
        clearApiKey: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

settingsRouter.patch("/", (req, res) => {
  const input = settingsSchema.parse(req.body);
  if (input.dailyGoalMinutes !== undefined) setSetting("dailyGoalMinutes", String(input.dailyGoalMinutes));
  if (input.defaultFocusMinutes !== undefined)
    setSetting("defaultFocusMinutes", String(input.defaultFocusMinutes));
  if (input.defaultBreakMinutes !== undefined)
    setSetting("defaultBreakMinutes", String(input.defaultBreakMinutes));
  if (input.ai) {
    if (input.ai.baseUrl !== undefined) setSetting("aiBaseUrl", input.ai.baseUrl);
    if (input.ai.model !== undefined) setSetting("aiModel", input.ai.model);
    if (input.ai.extractionModel !== undefined) setSetting("aiExtractionModel", input.ai.extractionModel);
    if (input.ai.clearApiKey) setSetting("aiApiKey", "");
    else if (input.ai.apiKey) setSetting("aiApiKey", input.ai.apiKey);
    setSetting("aiUpdatedAt", new Date().toISOString());
  }
  const settings: AppSettings = getPublicSettings();
  res.json(settings);
});

settingsRouter.post("/backup", (_req, res) => {
  const path = backupDatabase("manual");
  res.json({ ok: true, path });
});

settingsRouter.get("/launcher", (_req, res) => {
  const configPath = launcherConfigPath();
  const summary: LauncherSummary = {
    path: configPath,
    exists: false,
    config: null,
    error: null,
  };
  if (fs.existsSync(configPath)) {
    summary.exists = true;
    try {
      summary.config = JSON.parse(fs.readFileSync(configPath, "utf8")) as LauncherConfig;
    } catch (error) {
      summary.error = error instanceof Error ? error.message : String(error);
    }
  }
  res.json(summary);
});

settingsRouter.post("/test-ai", async (_req, res) => {
  res.json(await testAIConnection());
});

settingsRouter.get("/system", (_req, res) => {
  const theme = getTheme();
  res.json({
    dataDir: getPublicSettings().dataDir,
    launcherConfigPath: launcherConfigPath(),
    theme: {
      available: theme.available,
      source: theme.source,
      name: theme.name,
      mode: theme.mode,
      updatedAt: theme.updatedAt,
    },
    hyprland: Boolean(process.env.HYPRLAND_INSTANCE_SIGNATURE),
    caelestiaScheme: theme.source,
  });
});
