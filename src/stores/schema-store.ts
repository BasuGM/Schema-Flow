import { create } from "zustand";
import { fingerprintSchema } from "@/domain/schema/fingerprint";
import type { ImportIssue, Schema } from "@/domain/schema/types";
import { validateSchema } from "@/domain/schema/validate";

export type SchemaStatus = "empty" | "ready";

interface SchemaState {
  status: SchemaStatus;
  schema: Schema | null;
  fingerprint: string | null;
  /** Import issues plus any validation issues found on load. */
  issues: ImportIssue[];
  /**
   * The imported text (≤ 5 MB), kept for the session so issues can show source excerpts. Not part
   * of the schema or its fingerprint; null for samples. Read it only with a narrow selector.
   */
  sourceText: string | null;
  loadSchema: (schema: Schema, sourceText?: string) => void;
  clear: () => void;
}

export const useSchemaStore = create<SchemaState>()((set) => ({
  status: "empty",
  schema: null,
  fingerprint: null,
  issues: [],
  sourceText: null,
  loadSchema: (schema, sourceText) =>
    set({
      status: "ready",
      schema,
      fingerprint: fingerprintSchema(schema),
      issues: withValidation(schema),
      sourceText: sourceText ?? null,
    }),
  clear: () =>
    set({ status: "empty", schema: null, fingerprint: null, issues: [], sourceText: null }),
}));

const issueKey = (i: ImportIssue) => `${i.severity}|${i.line ?? ""}|${i.message}`;

/**
 * Import issues plus validation issues. Importers already append `validateSchema()` results, so
 * only issues not already present are added (no duplicates).
 */
function withValidation(schema: Schema): ImportIssue[] {
  const seen = new Set(schema.issues.map(issueKey));
  return [...schema.issues, ...validateSchema(schema).filter((i) => !seen.has(issueKey(i)))];
}
