import { z } from "zod";
import {
  isWeakMastery,
  type Difficulty,
  type ExtractedQuestion,
  type ExtractionResult,
  type Question,
  type QuestionGenerationRequest,
  type QuestionType,
} from "../../shared/types.ts";
import { getDb, getAIConfig, nowIso, rowToQuestion } from "../db.ts";
import { chatCompletion, parseJsonResponse, AIError } from "./ai.ts";
import { loadMasteryContext } from "./masteryService.ts";

interface CatalogSubtopic {
  id: number;
  name: string;
}

interface CatalogChapter {
  id: number;
  name: string;
  code: string;
  subjectId: number;
  subjectName: string;
  subtopics: CatalogSubtopic[];
}

export interface Catalog {
  subjects: { id: number; name: string; code: string }[];
  chapters: CatalogChapter[];
}

export function loadCatalog(): Catalog {
  const subjects = getDb()
    .prepare("SELECT id, name, code FROM subjects ORDER BY order_index")
    .all() as { id: number; name: string; code: string }[];
  const chapterRows = getDb()
    .prepare(
      "SELECT c.id, c.name, c.code, c.subject_id, s.name AS subject_name FROM chapters c JOIN subjects s ON s.id = c.subject_id ORDER BY s.order_index, c.order_index",
    )
    .all() as { id: number; name: string; code: string; subject_id: number; subject_name: string }[];
  const subtopicRows = getDb()
    .prepare("SELECT id, name, chapter_id FROM subtopics ORDER BY chapter_id, order_index")
    .all() as { id: number; name: string; chapter_id: number }[];
  const subtopicsByChapter = new Map<number, CatalogSubtopic[]>();
  for (const row of subtopicRows) {
    const list = subtopicsByChapter.get(row.chapter_id) ?? [];
    list.push({ id: row.id, name: row.name });
    subtopicsByChapter.set(row.chapter_id, list);
  }
  return {
    subjects,
    chapters: chapterRows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      subtopics: subtopicsByChapter.get(row.id) ?? [],
    })),
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameMatches(candidate: string, target: string): boolean {
  const a = normalize(candidate);
  const b = normalize(target);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function resolveClassification(
  catalog: Catalog,
  input: {
    subjectId?: number | null;
    chapterId?: number | null;
    subtopicId?: number | null;
    subjectName?: string | null;
    chapterName?: string | null;
    subtopicName?: string | null;
  },
  fallback?: { subjectId?: number; chapterId?: number; subtopicId?: number },
): { subjectId: number | null; chapterId: number | null; subtopicId: number | null } {
  let chapter = input.chapterId ? catalog.chapters.find((c) => c.id === input.chapterId) : undefined;
  const subject = input.subjectId
    ? catalog.subjects.find((s) => s.id === input.subjectId)
    : input.subjectName
      ? catalog.subjects.find(
          (s) => nameMatches(s.name, input.subjectName!) || nameMatches(s.code, input.subjectName!),
        )
      : undefined;

  if (!chapter && input.chapterName) {
    const candidates = catalog.chapters.filter(
      (c) =>
        nameMatches(c.name, input.chapterName!) &&
        (!subject || c.subjectId === subject.id),
    );
    chapter = candidates[0] ?? catalog.chapters.find((c) => nameMatches(c.name, input.chapterName!));
  }
  if (!chapter && fallback?.chapterId) {
    chapter = catalog.chapters.find((c) => c.id === fallback.chapterId);
  }

  let subtopic: CatalogSubtopic | undefined;
  let subtopicChapter: CatalogChapter | undefined;
  const findSubtopic = (pool: CatalogChapter[], predicate: (s: CatalogSubtopic) => boolean) => {
    for (const candidateChapter of pool) {
      const match = candidateChapter.subtopics.find(predicate);
      if (match) {
        subtopic = match;
        subtopicChapter = candidateChapter;
        return true;
      }
    }
    return false;
  };
  if (input.subtopicId) {
    findSubtopic(catalog.chapters, (s) => s.id === input.subtopicId);
  }
  if (!subtopic && input.subtopicName) {
    findSubtopic(
      chapter ? [chapter, ...catalog.chapters.filter((c) => c.id !== chapter!.id)] : catalog.chapters,
      (s) => nameMatches(s.name, input.subtopicName!),
    );
  }
  if (!subtopic && fallback?.subtopicId) {
    findSubtopic(catalog.chapters, (s) => s.id === fallback.subtopicId);
  }

  // The subtopic is the most specific classification: its parent chapter and
  // subject are authoritative even when the model supplied a mismatched chapter.
  if (subtopicChapter) chapter = subtopicChapter;
  const resolvedChapter =
    chapter ?? (fallback?.chapterId ? catalog.chapters.find((c) => c.id === fallback.chapterId) : undefined);
  const subjectId =
    resolvedChapter?.subjectId ??
    (subject?.id ?? (fallback?.subjectId ?? null));
  return {
    subjectId,
    chapterId: resolvedChapter?.id ?? null,
    subtopicId: subtopic?.id ?? null,
  };
}

function catalogText(catalog: Catalog, filter?: { subjectId?: number; chapterId?: number; subtopicId?: number }): string {
  const chapters = catalog.chapters.filter((chapter) => {
    if (filter?.chapterId) return chapter.id === filter.chapterId;
    if (filter?.subjectId) return chapter.subjectId === filter.subjectId;
    return true;
  });
  return chapters
    .map((chapter) => {
      const subtopics = chapter.subtopics
        .filter((subtopic) => !filter?.subtopicId || subtopic.id === filter.subtopicId)
        .map((subtopic) => `${subtopic.name} [id ${subtopic.id}]`)
        .join("; ");
      return `- ${chapter.subjectName} / ${chapter.name} [chapter id ${chapter.id}]: ${subtopics}`;
    })
    .join("\n");
}

const aiQuestionSchema = z.object({
  prompt: z.string().trim().min(1),
  options: z.array(z.string()).nullish(),
  answer: z.string().nullish(),
  solution: z.string().nullish(),
  questionType: z.enum(["mcq", "numeric", "short", "long"]).nullish(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullish(),
  marks: z.number().nullish(),
  subjectId: z.number().int().positive().nullish(),
  chapterId: z.number().int().positive().nullish(),
  subtopicId: z.number().int().positive().nullish(),
  subjectName: z.string().nullish(),
  chapterName: z.string().nullish(),
  subtopicName: z.string().nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  flags: z.array(z.string()).nullish(),
});

type AIQuestion = z.infer<typeof aiQuestionSchema>;

const aiResponseSchema = z.object({
  questions: z.array(z.unknown()),
  warnings: z.array(z.string()).nullish(),
});

function insertQuestion(input: {
  subjectId: number;
  chapterId: number | null;
  subtopicId: number | null;
  sourceType: "generated" | "uploaded";
  sourceRef: string;
  prompt: string;
  options: string[] | null;
  answer: string;
  solution: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  marks: number | null;
  status: "approved" | "needs_review";
  flags: string[];
}): number {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO questions (subject_id, chapter_id, subtopic_id, source_type, source_ref, prompt,
        options_json, answer, solution, question_type, difficulty, marks, status, flags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.subjectId,
      input.chapterId,
      input.subtopicId,
      input.sourceType,
      input.sourceRef,
      input.prompt,
      input.options ? JSON.stringify(input.options) : null,
      input.answer,
      input.solution,
      input.questionType,
      input.difficulty,
      input.marks,
      input.status,
      JSON.stringify(input.flags),
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}

export function getQuestionsByIds(ids: number[]): Question[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return (
    getDb()
      .prepare(
        `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, st.name AS subtopic_name
         FROM questions q
         LEFT JOIN subjects s ON s.id = q.subject_id
         LEFT JOIN chapters c ON c.id = q.chapter_id
         LEFT JOIN subtopics st ON st.id = q.subtopic_id
         WHERE q.id IN (${placeholders}) ORDER BY q.id`,
      )
      .all(...ids) as Record<string, unknown>[]
  ).map(rowToQuestion);
}

function weakSubtopicContext(): { text: string; ids: number[] } {
  const context = loadMasteryContext();
  const weak = [...context.bySubtopic.values()]
    .filter((item) => isWeakMastery(item))
    .sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100))
    .slice(0, 6);
  if (weak.length === 0) return { text: "No evidence-backed weak subtopics are available yet.", ids: [] };
  return {
    text: weak
      .map(
        (item) =>
          `- ${item.subtopicName} (${item.chapterName}) — mastery ${item.mastery}% from ${item.attempts} attempts`,
      )
      .join("\n"),
    ids: weak.map((item) => item.subtopicId),
  };
}

export async function generateQuestions(
  request: QuestionGenerationRequest,
): Promise<{ questions: Question[]; warnings: string[] }> {
  const config = getAIConfig();
  const catalog = loadCatalog();
  const count = Math.min(Math.max(Math.round(request.count ?? 5), 1), 20);
  const difficulty = request.difficulty ?? "mixed";
  const questionType = request.questionType ?? "mixed";
  const selectedChapter = request.chapterId
    ? catalog.chapters.find((chapter) => chapter.id === request.chapterId)
    : undefined;
  const selectedSubject = request.subjectId
    ? catalog.subjects.find((subject) => subject.id === request.subjectId)
    : selectedChapter
      ? catalog.subjects.find((subject) => subject.id === selectedChapter.subjectId)
      : undefined;
  const selectedSubtopic = request.subtopicId
    ? catalog.chapters.flatMap((chapter) => chapter.subtopics).find((subtopic) => subtopic.id === request.subtopicId)
    : undefined;
  const weak = request.focusWeakAreas ? weakSubtopicContext() : { text: "", ids: [] };

  const filter = {
    subjectId: selectedSubject?.id,
    chapterId: selectedChapter?.id,
    subtopicId: selectedSubtopic?.id,
  };
  const targetText = [
    selectedSubject ? `Subject: ${selectedSubject.name}` : "Subject: within the JEE Physics/Chemistry/Mathematics syllabus",
    selectedChapter ? `Chapter: ${selectedChapter.name}` : null,
    selectedSubtopic ? `Subtopic: ${selectedSubtopic.name}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Create ${count} practice questions for a JEE (Mains + Advanced) student.

${targetText}
Difficulty: ${difficulty}
Question type: ${questionType}
${request.focusWeakAreas ? `Focus on these evidence-backed weak areas when relevant:\n${weak.text}` : ""}
${request.instructions ? `Additional instructions: ${request.instructions}` : ""}

Use only topics from this syllabus catalog. Match the requested difficulty honestly. For multiple-choice questions provide exactly four options and put the correct option letter (A, B, C or D) in "answer". For numeric questions provide the final numeric answer. Include a concise but complete worked solution.
For "short"/"long", answer may be a model answer.
Return JSON only with this exact shape:
{"questions":[{"prompt":"...","options":["..."] or null,"answer":"...","solution":"...","questionType":"mcq|numeric|short|long","difficulty":"easy|medium|hard","marks":4,"subjectName":"Physics","chapterName":"Kinematics","subtopicName":"Projectile motion","confidence":0.9,"flags":[]}],"warnings":[]}
Do not include markdown fences. Do not invent chapters outside the catalog.

Syllabus catalog:
${catalogText(catalog, filter)}`;

  const result = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are an expert JEE question setter. You produce accurate, syllabus-aligned questions with correct answers. Return valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.65,
    maxTokens: 8_000,
    jsonMode: true,
    model: config.extractionModel || config.model,
  });

  let parsed: z.infer<typeof aiResponseSchema>;
  try {
    parsed = aiResponseSchema.parse(parseJsonResponse(result.content));
  } catch (error) {
    throw new AIError(
      `The AI did not return usable questions (${error instanceof Error ? error.message : String(error)}). Try again.`,
      502,
    );
  }

  const warnings: string[] = [...(parsed.warnings ?? [])];
  const ids: number[] = [];
  for (const raw of parsed.questions.slice(0, count)) {
    const check = aiQuestionSchema.safeParse(raw);
    if (!check.success) {
      warnings.push(`Skipped a malformed generated question: ${check.error.issues[0]?.message ?? "invalid shape"}.`);
      continue;
    }
    const question: AIQuestion = check.data;
    const resolved = resolveClassification(
      catalog,
      {
        subjectId: question.subjectId,
        chapterId: question.chapterId,
        subtopicId: question.subtopicId,
        subjectName: question.subjectName,
        chapterName: question.chapterName,
        subtopicName: question.subtopicName,
      },
      {
        subjectId: selectedSubject?.id,
        chapterId: selectedChapter?.id,
        subtopicId: selectedSubtopic?.id,
      },
    );
    if (!resolved.subjectId) {
      warnings.push(`Skipped a generated question that could not be classified: ${question.prompt.slice(0, 80)}`);
      continue;
    }
    const flags = [...(question.flags ?? [])];
    const answer = (question.answer ?? "").trim();
    if (!answer) flags.push("missing answer");
    if (!question.solution?.trim()) flags.push("missing solution");
    if (!resolved.chapterId) flags.push("unmapped chapter");
    if (!resolved.subtopicId) flags.push("unmapped subtopic");
    const type = question.questionType ?? "mcq";
    const options =
      type === "mcq"
        ? (question.options ?? []).filter((option) => option.trim().length > 0)
        : null;
    if (type === "mcq" && options && options.length !== 4) flags.push("MCQ does not have exactly four options");
    const status = answer && flags.length === 0 ? "approved" : "needs_review";
    ids.push(
      insertQuestion({
        subjectId: resolved.subjectId,
        chapterId: resolved.chapterId,
        subtopicId: resolved.subtopicId,
        sourceType: "generated",
        sourceRef: `AI generated (${result.model})`,
        prompt: question.prompt,
        options,
        answer,
        solution: question.solution ?? "",
        questionType: type,
        difficulty: question.difficulty ?? "medium",
        marks: question.marks ?? null,
        status,
        flags,
      }),
    );
  }
  if (ids.length < count) {
    warnings.push(`Requested ${count} questions; stored ${ids.length}.`);
  }
  return { questions: getQuestionsByIds(ids), warnings };
}

export async function extractQuestionsFromText(
  text: string,
  sourceName: string | null,
): Promise<ExtractionResult> {
  const config = getAIConfig();
  const catalog = loadCatalog();
  const cleaned = text.trim();
  if (!cleaned) throw new AIError("The uploaded file contains no extractable text.", 400);
  const clipped = cleaned.slice(0, 60_000);
  const warnings: string[] = [];
  if (cleaned.length > clipped.length) {
    warnings.push("Text was truncated to 60,000 characters before extraction.");
  }

  const prompt = `Extract every question from the worksheet below for a JEE (Mains + Advanced) student.

Rules:
- Preserve the original question text and LaTeX/maths notation as faithfully as possible.
- Identify the correct subject, chapter and subtopic from the syllabus catalog. Use the exact catalog names.
- Extract answer keys and marking schemes when present; otherwise use "" and add "missing answer" to flags.
- Flag unclear OCR/text, missing diagrams, ambiguous answers, unreliable answer keys, or anything a human must review.
- Set confidence between 0 and 1 for each question.
- For MCQ questions, preserve exactly four options and put the key (A/B/C/D) in "answer".
- Return JSON only:
{"questions":[{"prompt":"...","options":["..."] or null,"answer":"...","solution":"...","questionType":"mcq|numeric|short|long","difficulty":"easy|medium|hard","marks":null,"subjectName":"...","chapterName":"...","subtopicName":"...","confidence":0.8,"flags":[]}],"warnings":[]}

Syllabus catalog:
${catalogText(catalog)}

Worksheet (${sourceName ?? "pasted text"}):
---
${clipped}
---`;

  const result = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are a careful worksheet parser for JEE study material. Never invent answer keys or silently guess unclear content. Return valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 8_000,
    jsonMode: true,
    model: config.extractionModel || config.model,
  });

  let parsed: { questions: unknown[]; warnings?: string[] | null };
  try {
    parsed = aiResponseSchema.parse(parseJsonResponse(result.content));
  } catch (error) {
    throw new AIError(
      `Could not parse the extracted questions (${error instanceof Error ? error.message : String(error)}).`,
      502,
    );
  }
  const extracted: ExtractedQuestion[] = [];
  const storedIds: number[] = [];
  warnings.push(...(parsed.warnings ?? []));

  for (const raw of parsed.questions) {
    const check = aiQuestionSchema.safeParse(raw);
    if (!check.success) {
      warnings.push(`Skipped a malformed extracted question: ${check.error.issues[0]?.message ?? "invalid shape"}.`);
      continue;
    }
    const question: AIQuestion = check.data;
    const resolved = resolveClassification(catalog, {
      subjectId: question.subjectId,
      chapterId: question.chapterId,
      subtopicId: question.subtopicId,
      subjectName: question.subjectName,
      chapterName: question.chapterName,
      subtopicName: question.subtopicName,
    });
    const flags = [...(question.flags ?? [])];
    if (!resolved.subjectId) flags.push("unmapped subject");
    if (!resolved.chapterId) flags.push("unmapped chapter");
    if (!resolved.subtopicId) flags.push("unmapped subtopic");
    if (!(question.answer ?? "").trim()) flags.push("missing answer");
    if ((question.confidence ?? 0) < 0.6) flags.push("low extraction confidence");
    if (flags.length > 0) warnings.push(`Review: ${question.prompt.slice(0, 70)}… — ${flags.join(", ")}`);
    const extractedQuestion: ExtractedQuestion = {
      prompt: question.prompt,
      options: question.options ?? null,
      answer: question.answer ?? "",
      solution: question.solution ?? "",
      questionType: question.questionType ?? "short",
      difficulty: question.difficulty ?? "medium",
      marks: question.marks ?? null,
      subjectId: resolved.subjectId,
      chapterId: resolved.chapterId,
      subtopicId: resolved.subtopicId,
      subjectName: question.subjectName ?? null,
      chapterName: question.chapterName ?? null,
      subtopicName: question.subtopicName ?? null,
      confidence: question.confidence ?? 0.5,
      flags,
    };
    extracted.push(extractedQuestion);
    if (resolved.subjectId) {
      storedIds.push(
        insertQuestion({
          subjectId: resolved.subjectId,
          chapterId: resolved.chapterId,
          subtopicId: resolved.subtopicId,
          sourceType: "uploaded",
          sourceRef: sourceName ?? "Uploaded worksheet",
          prompt: question.prompt,
          options: question.options ?? null,
          answer: question.answer ?? "",
          solution: question.solution ?? "",
          questionType: question.questionType ?? "short",
          difficulty: question.difficulty ?? "medium",
          marks: question.marks ?? null,
          status: "needs_review",
          flags,
        }),
      );
    }
  }

  return {
    questions: extracted,
    warnings: [...new Set(warnings)].slice(0, 100),
    sourceName,
    storedQuestionIds: storedIds,
  };
}
