import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { SqlDialect } from "@/domain/schema/types";
import { decodeSchemaFile, parseSchemaText } from "@/parsers";
import { generateSchemaText } from "../text/generate-text";

// node:sqlite prints an ExperimentalWarning on Node 22; forward every other warning unchanged.
const defaultWarningListeners = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("SQLite")) return;
  for (const listener of defaultWarningListeners) listener(warning);
});
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): { get(): Record<string, number> };
    close(): void;
  };
};

const ROOT = new URL("../../../", import.meta.url);
const FIXTURES = [
  "tests/fixtures/real/gitlab-structure.postgres.sql",
  "tests/fixtures/real/mysqldump-180.mysql.sql",
  "tests/fixtures/real/sakila-schema.mysql.sql",
  "tests/fixtures/sql/ecommerce.postgres.sql",
  "tests/fixtures/sql/pgdump.postgres.sql",
  "tests/fixtures/sql/pg-casts.postgres.sql",
  "tests/fixtures/sql/shop.mysql.sql",
  "tests/fixtures/synthetic/saas-300.postgres.sql",
];
const NOW = () => "2026-01-01T00:00:00.000Z";

function load(path: string) {
  const decoded = decodeSchemaFile(readFileSync(new URL(path, ROOT)));
  if (!decoded.ok) throw new Error(decoded.reason);
  const schema = parseSchemaText(decoded.text, { now: NOW }).result.schema!;
  return schema;
}

/** The text outside `'…'` strings and `"…"` identifiers. */
const outsideLiterals = (sql: string) => sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, "''");

describe("cross-dialect SQL export (QA-031)", () => {
  describe.each(FIXTURES)("%s", (path) => {
    const schema = load(path);
    const tables = Object.keys(schema.tables).length;

    it("SQLite output runs in SQLite", () => {
      const { text } = generateSchemaText(schema, { kind: "sql", dialect: "sqlite" });
      const db = new DatabaseSync(":memory:");
      try {
        db.exec(text);
        const row = db
          .prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name <> 'sqlite_sequence'",
          )
          .get();
        expect(row.n).toBe(tables);
      } finally {
        db.close();
      }
    });

    it.each(["sqlite", "mysql"] as SqlDialect[])(
      "%s output re-imports with the same tables and no errors",
      (dialect) => {
        const { text } = generateSchemaText(schema, { kind: "sql", dialect });
        const again = parseSchemaText(text, { now: NOW }).result;
        expect(again.issues.filter((i) => i.severity === "error")).toEqual([]);
        expect(Object.keys(again.schema!.tables)).toHaveLength(tables);
      },
    );

    it.each(["sqlite", "mysql"] as SqlDialect[])(
      "%s output keeps no PostgreSQL syntax",
      (dialect) => {
        const { text } = generateSchemaText(schema, { kind: "sql", dialect });
        const code = outsideLiterals(text);
        expect(code).not.toContain("::");
        expect(code).not.toMatch(/ ~\*? | !~ /);
      },
    );
  });

  it("states how many CHECKs and defaults were left out, per dialect", () => {
    const schema = load("tests/fixtures/synthetic/saas-300.postgres.sql");
    for (const dialect of ["sqlite", "mysql"] as const) {
      const { warnings } = generateSchemaText(schema, { kind: "sql", dialect });
      expect(warnings).toContain(
        "3 CHECK constraints use PostgreSQL-only syntax and were left out (e.g. t022_entity.t022_entity_status_check).",
      );
    }
  });

  it("PostgreSQL output (faithful) emits no portability warning", () => {
    const schema = load("tests/fixtures/real/gitlab-structure.postgres.sql");
    const { warnings } = generateSchemaText(schema, { kind: "sql", dialect: "postgresql" });
    expect(warnings.filter((w) => w.includes("PostgreSQL-only"))).toEqual([]);
  });
});
