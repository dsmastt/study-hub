import { getDb, nowIso } from "../db.ts";

export interface WorksheetUploadRecord {
  id: number;
  fingerprint: string;
  fileName: string | null;
  sourceName: string | null;
  kind: "file" | "text";
  byteSize: number | null;
  questionCount: number;
  firstUploadedAt: string;
  lastUploadedAt: string;
}

function rowToUpload(row: Record<string, unknown>): WorksheetUploadRecord {
  return {
    id: Number(row.id),
    fingerprint: String(row.fingerprint),
    fileName: row.file_name === null ? null : String(row.file_name),
    sourceName: row.source_name === null ? null : String(row.source_name),
    kind: String(row.kind) === "text" ? "text" : "file",
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    questionCount: Number(row.question_count),
    firstUploadedAt: String(row.first_uploaded_at),
    lastUploadedAt: String(row.last_uploaded_at),
  };
}

export function findWorksheetUpload(input: {
  fingerprint: string;
  fileName?: string | null;
  kind?: "file" | "text";
}): WorksheetUploadRecord | null {
  const db = getDb();
  const byHash = db
    .prepare("SELECT * FROM worksheet_uploads WHERE fingerprint = ? LIMIT 1")
    .get(input.fingerprint) as Record<string, unknown> | undefined;
  if (byHash) return rowToUpload(byHash);

  if (input.kind === "file" && input.fileName && input.fileName.trim().length > 0) {
    const byName = db
      .prepare(
        `SELECT * FROM worksheet_uploads
         WHERE kind = 'file' AND lower(file_name) = lower(?)
         ORDER BY last_uploaded_at DESC LIMIT 1`,
      )
      .get(input.fileName.trim()) as Record<string, unknown> | undefined;
    if (byName) return rowToUpload(byName);
  }
  return null;
}

export function recordWorksheetUpload(input: {
  fingerprint: string;
  fileName?: string | null;
  sourceName?: string | null;
  kind: "file" | "text";
  byteSize?: number | null;
  questionCount: number;
}): WorksheetUploadRecord {
  const now = nowIso();
  const db = getDb();
  db.prepare(
    `INSERT INTO worksheet_uploads
      (fingerprint, file_name, source_name, kind, byte_size, question_count, first_uploaded_at, last_uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fingerprint) DO UPDATE SET
       file_name = excluded.file_name,
       source_name = excluded.source_name,
       kind = excluded.kind,
       byte_size = excluded.byte_size,
       question_count = excluded.question_count,
       last_uploaded_at = excluded.last_uploaded_at`,
  ).run(
    input.fingerprint,
    input.fileName ?? null,
    input.sourceName ?? null,
    input.kind,
    input.byteSize ?? null,
    input.questionCount,
    now,
    now,
  );
  const row = db
    .prepare("SELECT * FROM worksheet_uploads WHERE fingerprint = ?")
    .get(input.fingerprint) as Record<string, unknown>;
  return rowToUpload(row);
}

export function clearWorksheetUploads(): void {
  getDb().prepare("DELETE FROM worksheet_uploads").run();
}
