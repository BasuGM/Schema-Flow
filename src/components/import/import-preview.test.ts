import { describe, expect, it } from "vitest";
import type { Schema } from "@/domain/schema/types";
import { countsText } from "./import-preview";

/** A schema with `tables` tables of `columns` columns each (only what countsText reads). */
function schemaOf(tables: number, columns: number): Schema {
  const entries = Array.from({ length: tables }, (_, i) => [
    `t${i}`,
    { columns: Array.from({ length: columns }, () => ({})) },
  ]);
  return { tables: Object.fromEntries(entries), relationships: {}, enums: {} } as unknown as Schema;
}

describe("countsText (QA-023)", () => {
  it("puts thousands separators in large counts", () => {
    expect(countsText(schemaOf(1_000, 10))).toBe("1,000 tables · 10,000 columns · 0 relationships");
  });
  it("leaves small counts and singulars alone", () => {
    expect(countsText(schemaOf(1, 9))).toBe("1 table · 9 columns · 0 relationships");
  });
});
