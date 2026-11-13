import type { DraftSchema, DraftTable } from "./draft";

export function draft(tables: DraftTable[], extra: Partial<DraftSchema> = {}): DraftSchema {
  return {
    name: "test",
    source: { format: "sample", importedAt: "2026-01-01T00:00:00.000Z" },
    tables,
    ...extra,
  };
}
