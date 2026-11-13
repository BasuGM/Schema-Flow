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
      issues: [...schema.issues, ...validateSchema(schema)],
    }),
  clear: () => set({ status: "empty", schema: null, fingerprint: null, issues: [] }),
}));
