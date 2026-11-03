import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractText } from "unpdf";
import type { ExtractionResult } from "../../shared/types.ts";
import { AIError } from "./ai.ts";
import { getAIConfig } from "../db.ts";
import {
  extractQuestionsFromImages,
  extractQuestionsFromText,
} from "./questionAI.ts";

const execFileAsync = promisify(execFile);
const MAX_VISION_PAGES = 40;
const VISION_BATCH_HINT =
  "AI vision was used to read the page images. Review any flagged question before approving it.";

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",
  jfif: "image/jpeg",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
};

function extensionOf(filename: string): string {
  return path.extname(filename).slice(1).toLowerCase();
}

function appendWarnings(result: ExtractionResult, warnings: string[]): ExtractionResult {
  return {
    ...result,
    warnings: [...new Set([...warnings, ...result.warnings])].slice(0, 100),
  };
}

async function tempDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "study-hub-worksheet-"));
}

async function pageCountForPdf(pdfPath: string, buffer: Buffer): Promise<number> {
  try {
    const { stdout } = await execFileAsync("pdfinfo", [pdfPath], { maxBuffer: 5 * 1024 * 1024 });
    const match = stdout.match(/^Pages:\s+(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    // Fall through to unpdf.
  }
  try {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    return result.totalPages;
  } catch {
    return 0;
  }
}

async function renderPdfPages(
  pdfPath: string,
  directory: string,
  pageCount: number,
  warnings: string[],
): Promise<string[]> {
  const lastPage = Math.min(pageCount, MAX_VISION_PAGES);
  if (pageCount > MAX_VISION_PAGES) {
    warnings.push(
      `Only the first ${MAX_VISION_PAGES} of ${pageCount} pages were sent to AI vision. Split the worksheet if you need the remaining pages.`,
    );
  }
  const prefix = path.join(directory, "page");
  try {
    await execFileAsync(
      "pdftoppm",
      [
        "-jpeg",
        "-jpegopt",
        "quality=92",
        "-r",
        "200",
        "-f",
        "1",
        "-l",
        String(lastPage),
        pdfPath,
        prefix,
      ],
      { maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (error) {
    throw new AIError(
      `Could not render PDF pages for AI vision. Install Poppler (pdftoppm) or upload a text PDF: ${
        error instanceof Error ? error.message : String(error)
      }`,
      422,
    );
  }
  const files = (await fsp.readdir(directory))
    .filter((name) => /^page-\d+\.jpg$/i.test(name))
    .sort(
      (a, b) =>
        Number(a.match(/-(\d+)\.jpg$/i)?.[1] ?? 0) - Number(b.match(/-(\d+)\.jpg$/i)?.[1] ?? 0),
    );
  if (files.length === 0) throw new AIError("PDF rendering produced no page images.", 422);
  const images: string[] = [];
  for (const file of files) {
    const data = await fsp.readFile(path.join(directory, file));
    images.push(`data:image/jpeg;base64,${data.toString("base64")}`);
  }
  return images;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    return result.text;
  } catch {
    return "";
  }
}

export async function extractQuestionsFromPdf(
  buffer: Buffer,
  sourceName: string | null,
): Promise<ExtractionResult> {
  const directory = await tempDir();
  const warnings: string[] = [];
  try {
    const pdfPath = path.join(directory, "source.pdf");
    await fsp.writeFile(pdfPath, buffer, { mode: 0o600 });
    const pageCount = await pageCountForPdf(pdfPath, buffer);
    if (!pageCount || pageCount < 1) {
      throw new AIError("The PDF contains no readable pages.", 422);
    }
    let visionResult: ExtractionResult | null = null;
    let visionError: unknown = null;
    try {
      const images = await renderPdfPages(pdfPath, directory, pageCount, warnings);
      visionResult = await extractQuestionsFromImages(images, sourceName);
      if (visionResult.questions.length > 0) {
        return appendWarnings(visionResult, [VISION_BATCH_HINT, ...warnings]);
      }
      warnings.push("AI vision returned no questions from the rendered pages.");
    } catch (error) {
      visionError = error;
      warnings.push(
        `AI vision could not process the PDF: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const text = await extractPdfText(buffer);
    if (text.trim().length >= 30) {
      try {
        const textResult = await extractQuestionsFromText(text, sourceName);
        return appendWarnings(textResult, [
          ...warnings,
          "Fell back to the PDF's embedded text. Mathematical symbols may be less reliable than vision extraction; review flagged questions.",
        ]);
      } catch (error) {
        if (visionError instanceof AIError && visionResult === null) throw visionError;
        throw error;
      }
    }

    if (visionResult) return appendWarnings(visionResult, [VISION_BATCH_HINT, ...warnings]);
    if (visionError instanceof AIError) throw visionError;
    throw new AIError(
      `The PDF could not be read by AI vision and has no selectable text. Configure a multimodal vision model in Settings.${
        visionError ? ` ${visionError instanceof Error ? visionError.message : String(visionError)}` : ""
      }`,
      422,
    );
  } finally {
    await fsp.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

async function convertWithImageMagick(
  buffer: Buffer,
  extension: string,
  directory: string,
): Promise<{ dataUrl: string; warning?: string } | null> {
  const input = path.join(directory, `input.${extension}`);
  const output = path.join(directory, "normalized.jpg");
  const commands = [
    ["magick", [input, "-auto-orient", "-resize", "3000x3000>", "-background", "white", "-alpha", "remove", "-alpha", "off", "-quality", "90", output]],
    ["convert", [input, "-auto-orient", "-resize", "3000x3000>", "-background", "white", "-alpha", "remove", "-alpha", "off", "-quality", "90", output]],
  ] as const;
  for (const [command, args] of commands) {
    try {
      await fsp.writeFile(input, buffer, { mode: 0o600 });
      await execFileAsync(command, [...args], { maxBuffer: 30 * 1024 * 1024 });
      const data = await fsp.readFile(output);
      return { dataUrl: `data:image/jpeg;base64,${data.toString("base64")}` };
    } catch {
      // Try the next ImageMagick entry point; if none works, fall back to the original.
    }
  }
  return null;
}

export async function extractQuestionsFromImage(
  buffer: Buffer,
  filename: string,
  sourceName: string | null,
): Promise<ExtractionResult> {
  const extension = extensionOf(filename);
  const mime = IMAGE_MIME[extension];
  if (!mime) {
    throw new AIError(
      "Unsupported image type. Use PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF, HEIC or SVG.",
      415,
    );
  }
  const directory = await tempDir();
  const warnings: string[] = [VISION_BATCH_HINT];
  try {
    const converted = await convertWithImageMagick(buffer, extension, directory);
    let dataUrl: string;
    if (converted) {
      dataUrl = converted.dataUrl;
    } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) {
      dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      warnings.push(
        "ImageMagick was unavailable; the original image was sent without orientation/resize normalization.",
      );
    } else {
      throw new AIError(
        "This image format needs ImageMagick to normalize it. Install ImageMagick or upload PNG/JPEG.",
        415,
      );
    }
    let result: ExtractionResult;
    try {
      result = await extractQuestionsFromImages([dataUrl], sourceName);
    } catch (error) {
      if (error instanceof AIError) {
        throw new AIError(
          `AI vision could not read this image. Check that "${getAIConfig().visionModel}" is a multimodal model in Settings. ${error.message}`,
          error.status,
        );
      }
      throw error;
    }
    if (result.questions.length === 0) {
      warnings.push("AI vision found no questions in the image. Check that the worksheet is readable.");
    }
    return appendWarnings(result, warnings);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

export function isImageFile(filename: string): boolean {
  return Boolean(IMAGE_MIME[extensionOf(filename)]);
}

export function isPdfFile(filename: string): boolean {
  return extensionOf(filename) === "pdf";
}

export function isTextFile(filename: string): boolean {
  return /^(txt|md|markdown|csv|tex)$/i.test(extensionOf(filename));
}
