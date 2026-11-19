import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type * as NodeSqlite from "node:sqlite";
import { describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import type { DraftSchema, DraftTable } from "@/domain/schema/draft";
import { draft } from "@/domain/schema/test-helpers";
import type { Schema, SqlDialect } from "@/domain/schema/types";
import { parsePrisma } from "@/parsers/prisma/parse-prisma";
import { parseSql } from "@/parsers/sql/parse-sql";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { HOSTILE, hostileSchema } from "@/test/hostile-schema";
import { generateSql } from "./generate-sql";

const ROOT = new URL("../../../tests/fixtures/", import.meta.url);
const load = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const NOW = () => "2026-01-01T00:00:00.000Z";
const DIALECTS: SqlDialect[] = ["postgresql", "mysql", "sqlite"];

const build = (tables: DraftTable[], extra: Partial<DraftSchema> = {}): Schema =>
  normalizeSchema(
    draft(tables, {
      defaultSchemaName: "public",
      ...extra,
      source: { format: "sql", dialect: "postgresql", importedAt: NOW() },
    }),
  );
const sql = (s: Schema, dialect: SqlDialect) => generateSql(s, { dialect });

/**
 * Removes `--` comments, string literals and quoted identifiers in one left-to-right pass (so a
 * quote inside a comment, or `--` inside a literal, is consumed by whatever started first).
 * What is left is the SQL skeleton: it must contain no quote, backtick or `--` at all.
 */
function skeleton(text: string, dialect: SqlDialect): string {
  const literal =
    dialect === "mysql" ? String.raw`'(?:[^'\\]|''|\\[\s\S])*'` : String.raw`'(?:[^']|'')*'`;
  const quoted =
    dialect === "mysql" ? String.raw`\x60(?:[^\x60]|\x60\x60)*\x60` : String.raw`"(?:[^"]|"")*"`;
  return text.replace(new RegExp(`--[^\\n]*|${literal}|${quoted}`, "g"), "");
}

describe("hostile strings are escaped everywhere", () => {
  for (const dialect of DIALECTS) {
    it(`${dialect}: nothing leaks out of a literal, an identifier or a comment`, () => {
      const rest = skeleton(sql(hostileSchema(), dialect).text, dialect);
      expect(rest).not.toMatch(/['"`]|--|\*\//);
    });
  }

  it("doubles single quotes, and backslashes on MySQL only", () => {
    const pg = sql(hostileSchema(), "postgresql").text;
    const my = sql(hostileSchema(), "mysql").text;
    expect(pg).toContain("COMMENT ON COLUMN");
    expect(pg).toContain("q''u\"o`t\\e");
    expect(my).toContain("COMMENT 'column q''u\"o`t\\\\e");
  });

  it("keeps a multi-line comment on SQLite inside `--` lines", () => {
    const { text } = sql(hostileSchema(), "sqlite");
    const lines = text.split("\n").filter((l) => l.includes("column q'u"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.startsWith("--")).toBe(true);
    // The part of the comment after its newline is on its own `--` line.
    expect(text).toContain("\n-- n--l*/e\n");
  });
});

describe("SQLite executes the generated DDL (node:sqlite)", () => {
  const sqlite = (() => {
    try {
      return createRequire(import.meta.url)("node:sqlite") as typeof NodeSqlite;
    } catch {
      return null;
    }
  })();
  const run = it.skipIf(!sqlite);
  const exec = (text: string) => {
    const db = new sqlite!.DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(text);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => String(r.name));
    const fkProblems = db.prepare("PRAGMA foreign_key_check").all();
    db.close();
    return { tables, fkProblems };
  };

  run("ecommerce (from PostgreSQL) creates every table with consistent foreign keys", () => {
    const schema = createEcommerceSchema();
    const { tables, fkProblems } = exec(sql(schema, "sqlite").text);
    expect(tables).toHaveLength(schema.tableOrder.length);
    expect(fkProblems).toEqual([]);
  });

  run("blog.sqlite round-trips into a database with the same tables", () => {
    const original = parseSql(load("sql/blog.sqlite.sql"), { dialect: "sqlite", now: NOW }).schema!;
    const { tables } = exec(sql(original, "sqlite").text);
    expect(tables).toHaveLength(original.tableOrder.length);
  });

  run("a Prisma schema becomes a working SQLite database", () => {
    const prisma = parsePrisma(load("prisma/blog.prisma"), { now: NOW }).schema!;
    const { tables } = exec(sql(prisma, "sqlite").text);
    expect(tables).toHaveLength(prisma.tableOrder.length);
  });

  run("hostile names, comments, defaults and enum values execute", () => {
    const { tables } = exec(sql(hostileSchema(), "sqlite").text);
    expect(tables).toEqual([`t${HOSTILE}`]);
  });

  run("an empty schema and a table without a key execute", () => {
    expect(exec(sql(build([]), "sqlite").text).tables).toEqual([]);
    const noPk = build([{ name: "logs", columns: [{ name: "message", type: "text" }] }]);
    expect(exec(sql(noPk, "sqlite").text).tables).toEqual(["logs"]);
  });
});

describe("cross-dialect traps", () => {
  const keyed = build([
    {
      name: "docs",
      columns: [
        { name: "id", type: "text", nullable: false, primaryKey: true },
        { name: "slug", type: "text", unique: true },
        { name: "digest", type: "bytea" },
        { name: "body", type: "text" },
        { name: "owner_id", type: "text", references: { table: "owners", columns: ["id"] } },
      ],
      indexes: [{ columns: ["digest"] }],
    },
    { name: "owners", columns: [{ name: "id", type: "text", nullable: false, primaryKey: true }] },
  ]);

  it("MySQL: TEXT / BLOB columns used in keys become VARCHAR(255) / VARBINARY(255)", () => {
    const { text, warnings } = sql(keyed, "mysql");
    expect(text).toMatch(/id varchar\(255\) NOT NULL/);
    expect(text).toMatch(/slug varchar\(255\)/);
    expect(text).toMatch(/digest varbinary\(255\)/);
    expect(text).toMatch(/owner_id varchar\(255\)/);
    expect(text).toMatch(/body text/);
    expect(warnings.some((w) => w.includes("VARCHAR(255)/VARBINARY(255)"))).toBe(true);
    // Referenced side too: owners.id is a key.
    expect(text).toMatch(/CREATE TABLE owners \(\n {2}id varchar\(255\)/);
  });

  it("other targets keep TEXT in keys", () => {
    expect(sql(keyed, "postgresql").text).toMatch(/id text NOT NULL/);
    expect(sql(keyed, "sqlite").text).toMatch(/id text NOT NULL/);
  });

  const checked = build([
    {
      name: "items",
      columns: [
        { name: "id", type: "int", nullable: false, primaryKey: true },
        { name: "qty", type: "int", default: { kind: "literal", value: "0" } },
        {
          name: "label",
          type: "text",
          default: { kind: "expression", value: "lower('A') || 'b'" },
        },
      ],
      checkConstraints: [{ name: "qty_ok", expression: "qty >= 0" }],
    },
    { name: "plain", columns: [{ name: "id", type: "int", nullable: false, primaryKey: true }] },
  ]);

  it("warns once per table that CHECKs and expression defaults are copied as written", () => {
    for (const dialect of ["mysql", "sqlite"] as const) {
      const { warnings } = sql(checked, dialect);
      const copy = warnings.filter((w) => w.includes("copied as written"));
      expect(copy).toEqual([
        'Table "items": CHECK constraints and expression defaults are copied as written and may need editing.',
      ]);
    }
    expect(sql(checked, "postgresql").warnings).toEqual([]);
  });

  it("wraps expression defaults in parentheses where the target needs them", () => {
    expect(sql(checked, "mysql").text).toContain("DEFAULT (lower('A') || 'b')");
    expect(sql(checked, "sqlite").text).toContain("DEFAULT (lower('A') || 'b')");
  });

  it("SQLite: schema prefixes are dropped, clashing tables and index names stay unique", () => {
    const s = build(
      [
        {
          name: "t",
          schemaName: "a",
          columns: [
            { name: "id", type: "int", nullable: false, primaryKey: true },
            { name: "x", type: "int" },
          ],
          indexes: [{ name: "idx_x", columns: ["x"] }],
        },
        {
          name: "t",
          schemaName: "b",
          columns: [
            { name: "id", type: "int", nullable: false, primaryKey: true },
            { name: "x", type: "int" },
          ],
          indexes: [{ name: "idx_x", columns: ["x"] }],
        },
      ],
      { defaultSchemaName: undefined },
    );
    const { text, warnings } = sql(s, "sqlite");
    expect(text).toMatch(/CREATE TABLE t \(/);
    expect(text).toMatch(/CREATE TABLE b_t \(/);
    expect(text).toContain("CREATE INDEX idx_x ON t (x);");
    expect(text).toContain("CREATE INDEX idx_x_2 ON b_t (x);");
    expect(warnings.some((w) => w.includes("lost their schema prefix"))).toBe(true);
    expect(warnings.some((w) => w.includes('renamed to "idx_x_2"'))).toBe(true);
    // PostgreSQL keeps the schemas apart, so the same index name is fine there.
    const pg = sql(s, "postgresql");
    expect(pg.text).toContain("CREATE SCHEMA IF NOT EXISTS a;");
    expect(pg.text).not.toContain("idx_x_2");
  });

  it("warns about identifiers longer than the target allows", () => {
    const s = build([
      {
        name: "t",
        columns: [
          { name: "a".repeat(64), type: "int" },
          { name: "b".repeat(65), type: "int" },
        ],
      },
    ]);
    const pg = sql(s, "postgresql").warnings.join("\n");
    expect(pg).toContain("allows 63");
    expect(pg).toContain(`"${"a".repeat(64)}"`);
    const my = sql(s, "mysql").warnings.join("\n");
    expect(my).toContain("allows 64");
    expect(my).not.toContain(`"${"a".repeat(64)}" is`);
    expect(sql(s, "sqlite").warnings.filter((w) => w.startsWith("Identifier"))).toEqual([]);
  });
});

describe("types, defaults and keys", () => {
  it("keeps serial as written on PostgreSQL and maps it to AUTO_INCREMENT elsewhere", () => {
    const s = parseSql("CREATE TABLE t (id serial PRIMARY KEY, n bigserial);", {
      dialect: "postgresql",
      now: NOW,
    }).schema!;
    const pg = sql(s, "postgresql").text;
    expect(pg).toMatch(/id serial NOT NULL,/);
    expect(pg).not.toContain("IDENTITY");
    expect(sql(s, "mysql").text).toMatch(/id int NOT NULL AUTO_INCREMENT/);
  });

  it("SQLite drops AUTOINCREMENT unless it is a single-column primary key", () => {
    const s = parseSql("CREATE TABLE t (a int AUTO_INCREMENT, b int, PRIMARY KEY (a, b));", {
      dialect: "mysql",
      now: NOW,
    }).schema!;
    const { text, warnings } = sql(s, "sqlite");
    expect(text).not.toContain("AUTOINCREMENT");
    expect(text).toContain("PRIMARY KEY (a, b)");
    expect(warnings.some((w) => w.includes("AUTOINCREMENT"))).toBe(true);
  });

  it("maps now() and uuid defaults, and drops Prisma cuid()", () => {
    const s = build([
      {
        name: "t",
        columns: [
          { name: "a", type: "timestamptz", default: { kind: "function", value: "now()" } },
          { name: "b", type: "uuid", default: { kind: "function", value: "gen_random_uuid()" } },
          { name: "c", type: "text", default: { kind: "function", value: "cuid()" } },
        ],
      },
    ]);
    const my = sql(s, "mysql");
    expect(my.text).toContain("a datetime DEFAULT CURRENT_TIMESTAMP");
    expect(my.text).toContain("b char(36) DEFAULT (uuid())");
    expect(my.text).not.toMatch(/c text DEFAULT/);
    expect(my.warnings.some((w) => w.includes("cuid()"))).toBe(true);
    expect(sql(s, "postgresql").text).toContain("DEFAULT gen_random_uuid()");
  });

  it("maps enums: CREATE TYPE, inline ENUM, or TEXT + CHECK", () => {
    const s = createEcommerceSchema();
    const pg = sql(s, "postgresql").text;
    expect(pg).toContain("CREATE TYPE order_status AS ENUM ('pending', 'paid'");
    expect(pg).toMatch(/status order_status NOT NULL DEFAULT 'pending'/);
    expect(sql(s, "mysql").text).toMatch(
      /status ENUM\('pending', 'paid', 'shipped', 'delivered', 'cancelled'\) NOT NULL/,
    );
    const lite = sql(s, "sqlite");
    expect(lite.text).toMatch(/CHECK \(status IN \('pending'/);
    expect(lite.warnings.some((w) => w.startsWith("Enum columns are approximated"))).toBe(true);
  });

  it("emits comments natively: COMMENT ON, inline COMMENT, or -- lines", () => {
    const s = build([
      {
        name: "t",
        comment: "the table",
        columns: [
          { name: "id", type: "int", nullable: false, primaryKey: true, comment: "the id" },
        ],
      },
    ]);
    expect(sql(s, "postgresql").text).toContain("COMMENT ON COLUMN t.id IS 'the id';");
    expect(sql(s, "postgresql").text).toContain("COMMENT ON TABLE t IS 'the table';");
    expect(sql(s, "mysql").text).toContain("id int NOT NULL COMMENT 'the id'");
    expect(sql(s, "mysql").text).toContain(") COMMENT='the table';");
    expect(sql(s, "sqlite").text).toContain("-- t.id: the id");
  });

  it("emits foreign keys after all tables (cycles and self-references), inline on SQLite", () => {
    const s = build([
      {
        name: "a",
        columns: [
          { name: "id", type: "int", nullable: false, primaryKey: true },
          { name: "b_id", type: "int", references: { table: "b", columns: ["id"] } },
        ],
      },
      {
        name: "b",
        columns: [
          { name: "id", type: "int", nullable: false, primaryKey: true },
          {
            name: "a_id",
            type: "int",
            references: { table: "a", columns: ["id"], onDelete: "set default" },
          },
          { name: "parent", type: "int", references: { table: "b", columns: ["id"] } },
        ],
      },
    ]);
    const pg = sql(s, "postgresql").text;
    expect(pg.lastIndexOf("CREATE TABLE")).toBeLessThan(pg.indexOf("ALTER TABLE"));
    expect(pg).toContain("ON DELETE SET DEFAULT");
    const my = sql(s, "mysql");
    expect(my.text).not.toContain("SET DEFAULT");
    expect(my.warnings.some((w) => w.includes("InnoDB"))).toBe(true);
    const lite = sql(s, "sqlite").text;
    expect(lite).not.toContain("ALTER TABLE");
    expect(lite).toContain("FOREIGN KEY (a_id) REFERENCES a (id) ON DELETE SET DEFAULT");
  });
});

describe("degenerate inputs", () => {
  const empty = build([]);
  const noPk = build([{ name: "logs", columns: [{ name: "message", type: "text" }] }]);
  for (const dialect of DIALECTS) {
    it(`${dialect}: an empty schema is just a header; a table without a key is valid`, () => {
      const e = sql(empty, dialect);
      expect(e.text).toMatch(/^-- SchemaFlow export: test \(\w+\)\n$/);
      expect(e.warnings).toEqual([]);
      const n = sql(noPk, dialect);
      expect(n.text).toContain("CREATE TABLE logs (\n  message text\n);");
      expect(n.warnings).toEqual([]);
    });
  }

  it("is deterministic and never throws on a large synthetic schema", async () => {
    const { generateSyntheticSchema } = await import("@/samples/synthetic");
    const s = generateSyntheticSchema({ tables: 120, seed: 5 });
    for (const dialect of DIALECTS) {
      const a = sql(s, dialect);
      expect(sql(s, dialect)).toEqual(a);
      expect(a.text.endsWith(";\n")).toBe(true);
    }
  });
});
