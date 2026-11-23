import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSchemaText } from "./parse-schema-text";

const text = readFileSync(
  new URL("../../tests/fixtures/synthetic/saas-300.postgres.sql", import.meta.url),
  "utf8",
);

describe("saas-300 synthetic fixture (BB-P3)", () => {
  const { result } = parseSchemaText(text, { now: () => "t" });
  const schema = result.schema!;
  const tables = Object.values(schema.tables);

  it("has 300 tables in 3 schemas and no import errors", () => {
    expect(tables).toHaveLength(300);
    expect(new Set(tables.map((t) => t.schemaName)).size).toBe(3);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("has four wide tables of 60–150 columns", () => {
    const wide = tables.filter((t) => t.columns.length >= 60);
    expect(wide.map((t) => t.columns.length).sort((a, b) => a - b)).toEqual([60, 90, 120, 150]);
  });

  it("has about 15% isolated tables, a composite key and a self-reference", () => {
    const linked = new Set<string>();
    for (const r of Object.values(schema.relationships)) {
      linked.add(r.from.tableId);
      linked.add(r.to.tableId);
    }
    const isolated = tables.filter((t) => !linked.has(t.id)).length;
    expect(isolated / tables.length).toBeGreaterThan(0.1);
    expect(isolated / tables.length).toBeLessThan(0.25);
    expect(tables.some((t) => (t.primaryKey?.columnIds.length ?? 0) > 1)).toBe(true);
    expect(Object.values(schema.relationships).some((r) => r.from.tableId === r.to.tableId)).toBe(
      true,
    );
  });
});
