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
  loadSchema: (schema: Schema) => void;
  clear: () => void;
}

export const useSchemaStore = create<SchemaState>()((set) => ({
  status: "empty",
  schema: null,
  fingerprint: null,
  issues: [],
  loadSchema: (schema) =>
    set({
      status: "ready",
      schema,
      fingerprint: fingerprintSchema(schema),
      issues: withValidation(schema),
    }),
  clear: () => set({ status: "empty", schema: null, fingerprint: null, issues: [] }),
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
