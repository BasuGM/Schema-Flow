import type { ImportFormatChoice } from "@/parsers";

/** Hard cap for imported text or files (ADR-014). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/** Pasted text above this size is shown as a file card instead of living in the textarea. */
export const PASTE_SOFT_LIMIT_BYTES = 1024 * 1024;

/**
 * What the user has provided so far. Large content is never put in the textarea: files (and very
 * large pastes) are shown as a card and kept here as a `File` or a string.
 */
export type ImportDraft =
  | { kind: "empty" }
  | { kind: "paste"; text: string }
  | { kind: "file"; name: string; size: number; source: File | string };

export const EMPTY_DRAFT: ImportDraft = { kind: "empty" };

export function fileDraft(file: File): ImportDraft {
  return { kind: "file", name: file.name, size: file.size, source: file };
}

/** `.prisma` files pre-select Prisma; anything else (`.sql`, `.ddl`, `.txt`, none) is detected. */
export function formatForFileName(name: string): ImportFormatChoice {
  return /\.prisma$/i.test(name) ? "prisma" : "auto";
}

/** Schema name for an imported file: its name without the extension. */
export function schemaNameForFile(name: string): string {
  return name.replace(/\.[^./]+$/, "") || name;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
