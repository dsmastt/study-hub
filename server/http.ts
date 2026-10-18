import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AIError } from "./services/ai.ts";

export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function parseId(value: unknown, name = "id"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(`Invalid ${name}.`, 400);
  return id;
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }
  if (error instanceof AIError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.name === "MulterError") {
    res.status(400).json({
      error:
        (error as Error & { code?: string }).code === "LIMIT_FILE_SIZE"
          ? "File is too large. The limit is 20 MB."
          : `Upload error: ${error.message}`,
    });
    return;
  }
  if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
    res.status(409).json({ error: "That value already exists." });
    return;
  }
  console.error("Unhandled API error:", error);
  res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error.",
  });
}
