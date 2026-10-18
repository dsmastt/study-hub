import { Router } from "express";
import { getTheme, subscribeTheme } from "../services/theme.ts";

export const themeRouter = Router();

themeRouter.get("/", (_req, res) => {
  res.json(getTheme());
});

themeRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: theme\ndata: ${JSON.stringify(getTheme())}\n\n`);
  const unsubscribe = subscribeTheme((theme) => {
    res.write(`event: theme\ndata: ${JSON.stringify(theme)}\n\n`);
  });
  const heartbeat = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25_000);
  heartbeat.unref?.();

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});
