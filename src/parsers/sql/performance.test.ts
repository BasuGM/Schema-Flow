import { describe, expect, it } from "vitest";
import { parseSql } from "./parse-sql";

/** ~1 MB of DDL: 500 tables × 30 columns, each table referencing the previous one. */
function generateLargeDdl(tables = 500): string {
  const out: string[] = [];
  for (let t = 0; t < tables; t++) {
    const cols = [`  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`];
    if (t > 0) cols.push(`  parent_id bigint REFERENCES table_${t - 1} (id) ON DELETE CASCADE`);
    for (let c = 0; c < 28; c++)
      cols.push(`  column_number_${c} varchar(255) NOT NULL DEFAULT 'value_${t}_${c}'`);
    out.push(`CREATE TABLE table_${t} (\n${cols.join(",\n")}\n);`);
    out.push(`CREATE INDEX table_${t}_idx ON table_${t} (column_number_0, column_number_1);`);
  }
  return out.join("\n");
}

describe("parseSql performance", () => {
  it("parses ~1 MB of DDL (500 tables) in under 1.5 s", () => {
    const ddl = generateLargeDdl();
    expect(ddl.length).toBeGreaterThan(1_000_000);
    const start = performance.now();
    const result = parseSql(ddl, { now: () => "t" });
    const elapsed = performance.now() - start;
    expect(result.ok).toBe(true);
    expect(result.schema?.tableOrder).toHaveLength(500);
    expect(Object.keys(result.schema?.relationships ?? {})).toHaveLength(499);
    expect(elapsed).toBeLessThan(1500);
  });
});
