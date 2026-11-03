import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { AIStatus } from "../../shared/types.ts";
import { getPublicSettings } from "../db.ts";
import { asyncRoute, HttpError } from "../http.ts";
import { generateQuestions, extractQuestionsFromText } from "../services/questionAI.ts";
import {
  extractQuestionsFromImage,
  extractQuestionsFromPdf,
  isImageFile,
  isPdfFile,
  isTextFile,
} from "../services/worksheetExtraction.ts";
import {
  clearChatMessages,
  listChatMessages,
  resolvePendingAction,
  runAssistant,
} from "../services/assistant.ts";
import { isAIConfigured } from "../services/ai.ts";
import {
  findWorksheetUpload,
  recordWorksheetUpload,
} from "../services/worksheetUploads.ts";

export const aiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
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
    if (!sourceName && file) sourceName = file.originalname;
    let fingerprintSource: Buffer | string;
    let kind: "file" | "text" = file ? "file" : "text";
    if (file) {
      fingerprintSource = file.buffer;
      if (!isPdfFile(file.originalname) && !isImageFile(file.originalname) && !isTextFile(file.originalname)) {
        throw new HttpError(
          "Unsupported file type. Use PDF, PNG/JPEG/WebP/GIF/BMP/TIFF/AVIF/HEIC/SVG, TXT, Markdown, CSV or TeX.",
          415,
        );
      }
      if (isTextFile(file.originalname)) {
        text = file.buffer.toString("utf8");
      }
    } else {
      fingerprintSource = text;
    }
    if (!file && !text.trim()) {
      throw new HttpError("Provide a file or paste worksheet text to extract.", 400);
    }
    const fingerprint = crypto.createHash("sha256").update(fingerprintSource).digest("hex");
    const force = String(req.body?.force ?? "").toLowerCase() === "true" || req.body?.force === "1";
    const duplicate = findWorksheetUpload({
      fingerprint,
      fileName: file?.originalname ?? null,
      kind,
    });
    if (duplicate && !force) {
      const duplicateResult: import("../../shared/types.ts").ExtractionResult = {
        questions: [],
        warnings: [
          `This worksheet matches an earlier upload (${duplicate.sourceName ?? duplicate.fileName ?? "unknown source"}) from ${duplicate.lastUploadedAt}. Uploading it again will create duplicate questions.`,
        ],
        sourceName,
        storedQuestionIds: [],
        duplicate: {
          uploadId: duplicate.id,
          sourceName: duplicate.sourceName,
          fileName: duplicate.fileName,
          uploadedAt: duplicate.lastUploadedAt,
          questionCount: duplicate.questionCount,
        },
      };
      res.json(duplicateResult);
      return;
    }

    let result: import("../../shared/types.ts").ExtractionResult;
    if (file && isPdfFile(file.originalname)) {
      result = await extractQuestionsFromPdf(file.buffer, sourceName);
    } else if (file && isImageFile(file.originalname)) {
      result = await extractQuestionsFromImage(file.buffer, file.originalname, sourceName);
    } else {
      if (!text.trim()) throw new HttpError("The text file is empty.", 400);
      result = await extractQuestionsFromText(text, sourceName);
    }
    recordWorksheetUpload({
      fingerprint,
      fileName: file?.originalname ?? null,
      sourceName,
      kind,
      byteSize: file?.size ?? Buffer.byteLength(text),
      questionCount: result.storedQuestionIds.length,
    });
    res.json(result);
  }),
);

export type { AIStatus };
