import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { DATA_DIR } from "./db.ts";

export const API_TOKEN_PATH = path.join(DATA_DIR, ".api-token");
let token: string | null = null;

function writeTokenFile(value: string): void {
  try {
    fs.writeFileSync(API_TOKEN_PATH, value, { mode: 0o600 });
    fs.chmodSync(API_TOKEN_PATH, 0o600);
  } catch (error) {
    console.warn(`Could not persist API token to ${API_TOKEN_PATH}:`, error);
  }
}

export function getApiToken(): string {
  if (token) return token;
  const fromEnv = process.env.STUDY_HUB_API_TOKEN?.trim();
  if (fromEnv) {
    token = fromEnv;
    writeTokenFile(token);
    return token;
  }
  try {
    const existing = fs.readFileSync(API_TOKEN_PATH, "utf8").trim();
    if (existing) {
      token = existing;
      try {
        fs.chmodSync(API_TOKEN_PATH, 0o600);
      } catch {
        // Permissions were already handled during data directory setup.
      }
      return token;
    }
  } catch {
    // Generate a new local token below.
  }
  token = crypto.randomBytes(32).toString("hex");
  writeTokenFile(token);
  return token;
}

export function setApiTokenCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    `study_hub_token=${encodeURIComponent(getApiToken())}; Path=/; SameSite=Strict; Max-Age=31536000`,
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireApiToken(req: Request, res: Response, next: NextFunction): void {
  const provided = req.get("x-study-hub-token") ?? "";
  if (!provided || !constantTimeEqual(provided, getApiToken())) {
    res.status(401).json({
      error:
        "Missing or invalid Study Hub API token. Open the dashboard to obtain a local token, or run the study command.",
    });
    return;
  }
  next();
}
