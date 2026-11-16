import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ImportIssue, Schema } from "@/domain/schema/types";
import { parseSchemaText } from "./parse-schema-text";

const ROOT = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

/** Issue messages with names and numbers blanked, counted: `{ "warning: Skipped …": 3 }`. */
export function issueKinds(issues: ImportIssue[]): Record<string, number> {
  const kinds: Record<string, number> = {};
  for (const issue of issues) {
    const kind = `${issue.severity}: ${issue.message
      .replace(/"[^"]*"/g, "…")
      .replace(/: [^:]*$/, (m) => (/^: [A-Z ]+\.$/.test(m) ? m : ": …"))
      .replace(/\d+/g, "N")}`;
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  return kinds;
}

function counts(schema: Schema) {
  const tables = Object.values(schema.tables);
  return {
    tables: tables.length,
    columns: tables.reduce((sum, t) => sum + t.columns.length, 0),
    relationships: Object.keys(schema.relationships).length,
  };
}

function parseFixture(path: string) {
  const parsed = parseSchemaText(read(path), { now: () => "t" });
  const schema = parsed.result.schema!;
  // Every relationship joins two tables that exist (none dangle).
  for (const r of Object.values(schema.relationships)) {
    expect(schema.tables[r.from.tableId], r.id).toBeDefined();
    expect(schema.tables[r.to.tableId], r.id).toBeDefined();
  }
  return { parsed, schema };
}

/** Expected counts come from the source files (SOURCES.md records how each was counted). */
describe("real-world fixtures (tests/fixtures/real)", () => {
  it("GitLab structure.sql (pg_dump): 992 tables after folding 434 partitions into 19 parents", () => {
    const { parsed, schema } = parseFixture("tests/fixtures/real/gitlab-structure.postgres.sql");
    expect(parsed.dialect).toBe("postgresql");
    expect(parsed.result.ok).toBe(true);
    expect(counts(schema)).toEqual({ tables: 992, columns: 9982, relationships: 1720 });
    const partitioned = Object.values(schema.tables).filter((t) => t.partitions);
    expect(partitioned).toHaveLength(19);
    expect(partitioned.reduce((sum, t) => sum + t.partitions!.length, 0)).toBe(434);
    expect(schema.tables["public.issue_search_data"]?.partitions).toHaveLength(64);
    expect(issueKinds(parsed.result.issues)).toEqual({
      "warning: Skipped an index on expressions for ….": 120,
      "warning: Skipped unsupported statement: CREATE VIEW.": 15,
      "warning: Skipped EXCLUDE constraint on ….": 2,
      "warning: Skipped unsupported ALTER TABLE action on …: …": 1,
      "warning: Folded N partitions into N partitioned tables; the inspector lists each table's partitions.": 1,
      "warning: Skipped N statements not needed for the diagram: …": 1,
    });
  });

  it("Sakila (MySQL, DELIMITER blocks and executable comments): 16 tables, 22 relationships", () => {
    const { parsed, schema } = parseFixture("tests/fixtures/real/sakila-schema.mysql.sql");
    expect(parsed.dialect).toBe("mysql");
    expect(counts(schema)).toEqual({ tables: 16, columns: 90, relationships: 22 });
    // `/*!50705 location GEOMETRY */` is code for MySQL 5.7.5+, so address has `location`.
    expect(schema.tables["address"]?.columns.map((c) => c.name)).toContain("location");
    expect(issueKinds(parsed.result.issues)).toEqual({
      "warning: Skipped unsupported statement: CREATE VIEW.": 7,
      "warning: Skipped N statements not needed for the diagram: …": 1,
    });
  });

  it("mysqldump-180 (generated): 180 tables, 306 relationships, one summary warning", () => {
    const { parsed, schema } = parseFixture("tests/fixtures/real/mysqldump-180.mysql.sql");
    expect(parsed.dialect).toBe("mysql");
    expect(counts(schema)).toEqual({ tables: 180, columns: 1625, relationships: 306 });
    const composite = Object.values(schema.relationships).filter(
      (r) => r.from.columnIds.length > 1,
    );
    expect(composite).toHaveLength(9);
    expect(issueKinds(parsed.result.issues)).toEqual({
      "warning: Skipped N statements not needed for the diagram: …": 1,
    });
  });

  it("large-200.prisma (generated): 200 models + 20 implicit join tables, no issues", () => {
    const { parsed, schema } = parseFixture("tests/fixtures/real/large-200.prisma");
    expect(parsed.format).toBe("prisma");
    expect(counts(schema)).toEqual({ tables: 220, columns: 1692, relationships: 354 });
    expect(Object.values(schema.tables).filter((t) => t.origin === "implicit")).toHaveLength(20);
    expect(parsed.result.issues).toEqual([]);
  });
});

describe("generated fixtures are up to date (fixed seeds, byte for byte)", () => {
  it.each([
    ["scripts/fixtures/mysqldump-180.mjs", "tests/fixtures/real/mysqldump-180.mysql.sql"],
    ["scripts/fixtures/prisma-200.mjs", "tests/fixtures/real/large-200.prisma"],
    [
      "scripts/fixtures/neighbourhood-2000.mjs",
      "tests/fixtures/large/neighbourhood-2000.postgres.sql",
    ],
    ["scripts/fixtures/search-2000.mjs", "tests/fixtures/large/search-2000.postgres.sql"],
  ])("%s regenerates %s", (script, fixture) => {
    const output = execFileSync(process.execPath, [new URL(script, ROOT).pathname, "--stdout"], {
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(output.equals(readFileSync(new URL(fixture, ROOT)))).toBe(true);
  });
});
