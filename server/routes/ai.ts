import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { extractText } from "unpdf";
import type { AIStatus } from "../../shared/types.ts";
import { getPublicSettings } from "../db.ts";
import { asyncRoute, HttpError } from "../http.ts";
import { generateQuestions, extractQuestionsFromText } from "../services/questionAI.ts";
import {
  clearChatMessages,
  listChatMessages,
  resolvePendingAction,
  runAssistant,
} from "../services/assistant.ts";
import { isAIConfigured } from "../services/ai.ts";

export const aiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

aiRouter.get("/status", (_req, res) => {
  const ai = getPublicSettings().ai;
  const status: AIStatus = {
    configured: isAIConfigured(),
    providerLabel: ai.providerLabel,
    baseUrl: ai.baseUrl,
    model: ai.model,
    apiKeyHint: ai.apiKeyHint,
    lastError: null,
  };
  res.json(status);
});

aiRouter.get("/messages", (_req, res) => {
  res.json(listChatMessages());
});

aiRouter.delete("/messages", (_req, res) => {
  clearChatMessages();
  res.json({ ok: true });
});

const chatSchema = z.object({ message: z.string().trim().min(1).max(8000) });

aiRouter.post(
  "/chat",
  asyncRoute(async (req, res) => {
    const input = chatSchema.parse(req.body);
    const result = await runAssistant(input.message);
    res.json(result);
  }),
);

aiRouter.post(
  "/pending/:id/approve",
  asyncRoute(async (req, res) => {
    const id = String(req.params.id);
    const result = await resolvePendingAction(id, true);
    res.json(result);
  }),
);

aiRouter.post(
  "/pending/:id/reject",
  asyncRoute(async (req, res) => {
    const id = String(req.params.id);
    const result = await resolvePendingAction(id, false);
    res.json(result);
  }),
);

const generateSchema = z.object({
  subjectId: z.number().int().positive().optional(),
  chapterId: z.number().int().positive().optional(),
  subtopicId: z.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
  questionType: z.enum(["mcq", "numeric", "short", "long", "mixed"]).optional(),
  count: z.number().int().min(1).max(20).optional(),
  focusWeakAreas: z.boolean().optional(),
  instructions: z.string().max(1000).optional(),
});

aiRouter.post(
  "/generate",
  asyncRoute(async (req, res) => {
    const input = generateSchema.parse(req.body ?? {});
    const result = await generateQuestions(input);
    res.json(result);
  }),
);

aiRouter.post(
  "/extract",
  upload.single("file"),
  asyncRoute(async (req, res) => {
    let text = typeof req.body?.text === "string" ? req.body.text : "";
    let sourceName =
      typeof req.body?.sourceName === "string" && req.body.sourceName.trim()
        ? req.body.sourceName.trim()
        : null;
    const file = req.file;
    if (file) {
      sourceName = file.originalname;
      const name = file.originalname.toLowerCase();
      if (name.endsWith(".pdf")) {
        let extracted: string;
        try {
          const result = await extractText(new Uint8Array(file.buffer), { mergePages: true });
          extracted = result.text;
        } catch (error) {
          throw new HttpError(
            `Could not read the PDF: ${error instanceof Error ? error.message : String(error)}`,
            422,
          );
        }
        text = extracted;
        if (text.trim().length < 30) {
          throw new HttpError(
            "This PDF has little or no selectable text (it may be scanned). OCR is not bundled; upload a text-based PDF or paste the worksheet text.",
            422,
          );
        }
      } else if (/\.(txt|md|markdown|csv|tex)$/i.test(name)) {
        text = file.buffer.toString("utf8");
      } else if (/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)) {
        throw new HttpError(
          "Image worksheets are not supported by the configured text model. Convert the image to a text-based PDF or paste the text.",
          415,
        );
      } else {
        throw new HttpError("Unsupported file type. Use PDF, TXT, Markdown, CSV or TeX.", 415);
      }
    }
    if (!text.trim()) {
      throw new HttpError("Provide a file or paste worksheet text to extract.", 400);
    }
    const result = await extractQuestionsFromText(text, sourceName);
    res.json(result);
  }),
);

export type { AIStatus };
