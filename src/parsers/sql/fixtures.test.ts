import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fingerprintSchema } from "@/domain/schema/fingerprint";
import type { ImportResult, Schema } from "@/domain/schema/types";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { parseSql } from "./parse-sql";

const FIXTURES = new URL("../../../tests/fixtures/sql/", import.meta.url);
const NOW = () => "2026-01-01T00:00:00.000Z";

function loadFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURES), "utf8");
}

function parse(name: string): { result: ImportResult; schema: Schema } {
  const result = parseSql(loadFixture(name), { now: NOW });
  expect(result.schema).toBeDefined();
  return { result, schema: result.schema! };
}

const columnCount = (s: Schema) =>
  Object.values(s.tables).reduce((n, t) => n + t.columns.length, 0);
const rels = (s: Schema) =>
  Object.values(s.relationships)
    .map((r) => `${r.from.columnIds.join("+")} -> ${r.to.columnIds.join("+")} (${r.cardinality})`)
    .sort();
const issueList = (r: ImportResult) =>
  r.issues.map((i) => `${i.severity}@${i.line ?? "-"}: ${i.message}`);

describe("ecommerce.postgres.sql — same schema as the built-in sample", () => {
  const { result, schema } = parse("ecommerce.postgres.sql");
  const sample = createEcommerceSchema();

  it("imports cleanly with the documented counts", () => {
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(schema.tableOrder).toHaveLength(12);
    expect(columnCount(schema)).toBe(71);
    expect(Object.keys(schema.relationships)).toHaveLength(13);
    expect(Object.keys(schema.enums).sort()).toEqual(["order_status", "payment_method"]);
    expect(Object.values(schema.tables).flatMap((t) => t.checkConstraints)).toHaveLength(5);
    expect(schema.source).toEqual({ format: "sql", dialect: "postgresql", importedAt: NOW() });
  });

  it("matches the sample's tables, columns, keys and relationships", () => {
    expect(schema.tableOrder).toEqual(sample.tableOrder);
    expect(fingerprintSchema(schema)).toBe(fingerprintSchema(sample));
    expect(rels(schema)).toEqual(rels(sample));
    for (const id of sample.tableOrder) {
      const a = schema.tables[id]!;
      const b = sample.tables[id]!;
      const shape = (t: typeof a) =>
        t.columns.map((c) => ({
          name: c.name,
          base: c.dataType.base,
          params: c.dataType.params,
          isArray: c.dataType.isArray,
          enumName: c.dataType.enumName,
          nullable: c.nullable,
          pk: c.isPrimaryKey,
          fk: c.isForeignKey,
          unique: c.isUnique,
          defaultKind: c.default?.kind,
        }));
      expect(shape(a), id).toEqual(shape(b));
      expect(a.primaryKey?.columnIds, id).toEqual(b.primaryKey?.columnIds);
      expect(
        a.indexes.map((i) => i.columnIds),
        id,
      ).toEqual(b.indexes.map((i) => i.columnIds));
    }
  });

  it("keeps referential actions", () => {
    const byName = Object.fromEntries(
      Object.values(schema.relationships).map((r) => [r.from.columnIds.join(), r]),
    );
    expect(byName["public.orders.user_id"]?.onDelete).toBe("restrict");
    expect(byName["public.categories.parent_id"]).toMatchObject({
      name: "categories_parent_fk",
      onDelete: "set null",
    });
    expect(byName["public.order_items.order_id"]).toMatchObject({
      name: "order_items_order_fk",
      onDelete: "cascade",
    });
  });
});

describe("shop.mysql.sql", () => {
  const { result, schema } = parse("shop.mysql.sql");

  it("imports 5 tables and 4 relationships with no issues", () => {
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(schema.source.dialect).toBe("mysql");
    expect(schema.tableOrder).toEqual([
      "customers",
      "products",
      "orders",
      "order_lines",
      "customer_profiles",
    ]);
    expect(columnCount(schema)).toBe(18);
    expect(rels(schema)).toEqual([
      "customer_profiles.customer_id -> customers.id (one-to-one)",
      "order_lines.order_id -> orders.id (many-to-one)",
      "order_lines.product_id -> products.id (many-to-one)",
      "orders.customer_id -> customers.id (many-to-one)",
    ]);
  });

  it("maps MySQL specifics", () => {
    const customers = schema.tables["customers"]!;
    expect(customers.columns[0]).toMatchObject({
      name: "id",
      isPrimaryKey: true,
      default: { kind: "autoincrement" },
    });
    expect(customers.columns.find((c) => c.name === "email")?.isUnique).toBe(true);
    expect(customers.columns.find((c) => c.name === "name")?.comment).toBe(
      "Display name; may be empty",
    );
    expect(customers.indexes).toEqual([
      { name: "idx_customers_name", columnIds: ["customers.name"], unique: false },
    ]);
    expect(
      schema.tables["products"]?.columns.find((c) => c.name === "status")?.dataType,
    ).toMatchObject({
      base: "enum",
      params: ["'draft'", "'active'", "'archived'"],
    });
    expect(schema.tables["order_lines"]?.primaryKey?.columnIds).toHaveLength(2);
  });
});

describe("blog.sqlite.sql", () => {
  const { result, schema } = parse("blog.sqlite.sql");

  it("imports 4 tables and 3 relationships with one summary warning", () => {
    expect(result.ok).toBe(true);
    expect(schema.source.dialect).toBe("sqlite");
    expect(schema.tableOrder).toEqual(["authors", "posts", "tags", "post_tags"]);
    expect(columnCount(schema)).toBe(12);
    expect(Object.keys(schema.relationships)).toHaveLength(3);
    expect(issueList(result)).toEqual([
      "warning@-: Skipped 1 statement not needed for the diagram: PRAGMA ×1.",
    ]);
  });

  it("maps SQLite specifics", () => {
    expect(schema.tables["authors"]?.columns[0]?.default?.kind).toBe("autoincrement");
    expect(schema.tables["tags"]?.columns.map((c) => c.name)).toEqual(["id", "label"]);
    expect(schema.tables["posts"]?.indexes[0]?.columnIds).toEqual(["posts.author_id"]);
    expect(schema.tables["posts"]?.columns.find((c) => c.name === "published_at")?.default).toEqual(
      {
        kind: "function",
        value: "datetime('now')",
      },
    );
  });
});

describe("pgdump.postgres.sql — real pg_dump style", () => {
  const { result, schema } = parse("pgdump.postgres.sql");

  it("imports 3 tables, 14 columns and 3 relationships", () => {
    expect(result.ok).toBe(true);
    expect(schema.tableOrder).toEqual(["public.accounts", "public.projects", "public.tasks"]);
    expect(columnCount(schema)).toBe(14);
    expect(rels(schema)).toEqual([
      "public.projects.account_id -> public.accounts.id (many-to-one)",
      "public.tasks.assignee_id -> public.accounts.id (many-to-one)",
      "public.tasks.project_id -> public.projects.id (many-to-one)",
    ]);
  });

  it("groups irrelevant statements into ONE summary warning", () => {
    expect(issueList(result)).toEqual([
      'warning@130: Skipped an index on expressions for "projects".',
      "warning@-: Skipped 31 statements not needed for the diagram: SET ×11, SELECT ×1, extensions ×1, COMMENT ON ×2, OWNER TO ×5, functions/triggers ×2, sequences ×6, GRANT/REVOKE ×3.",
    ]);
  });

  it("applies ALTER TABLE ONLY constraints and ALTER COLUMN defaults", () => {
    const accounts = schema.tables["public.accounts"]!;
    expect(accounts.primaryKey).toEqual({
      name: "accounts_pkey",
      columnIds: ["public.accounts.id"],
    });
    expect(accounts.columns.find((c) => c.name === "email")?.isUnique).toBe(true);
    expect(accounts.columns[0]?.default).toEqual({
      kind: "autoincrement",
      value: "nextval('public.accounts_id_seq'::regclass)",
    });
    expect(schema.tables["public.projects"]?.columns[0]?.default?.kind).toBe("autoincrement");
    expect(schema.tables["public.tasks"]?.columns[0]?.default?.kind).toBe("autoincrement");
    expect(accounts.columns.find((c) => c.name === "role")?.dataType.enumName).toBe("account_role");
    expect(accounts.columns.find((c) => c.name === "email")?.dataType.base).toBe("citext");
  });
});

describe("edge-cases.postgres.sql — bad statements don't block good ones", () => {
  const { result, schema } = parse("edge-cases.postgres.sql");

  it("imports the good tables and relationships", () => {
    expect(schema.tableOrder).toEqual(["public.Order Lines", "public.users", "billing.invoices"]);
    expect(columnCount(schema)).toBe(10);
    expect(rels(schema)).toEqual([
      "billing.invoices.user_id -> public.users.id (many-to-one)",
      "public.Order Lines.UserID -> public.users.id (many-to-one)",
    ]);
  });

  it("handles quoting, strings with semicolons and qualified enum types", () => {
    const lines = schema.tables["public.Order Lines"]!;
    expect(lines.columns.map((c) => c.name)).toEqual([
      "LineID",
      "UserID",
      "note",
      'weird "quoted" col',
    ]);
    expect(lines.columns[2]?.default).toEqual({ kind: "literal", value: "'it''s; fine'" });
    expect(lines.columns[0]?.default?.kind).toBe("autoincrement");
    expect(
      schema.tables["billing.invoices"]?.columns.find((c) => c.name === "status")?.dataType.base,
    ).toBe("invoice_status");
  });

  it("reports every problem with its line, and fails ok because of the duplicate table", () => {
    expect(result.ok).toBe(false);
    expect(issueList(result)).toEqual([
      "warning@23: Skipped unsupported statement: CREATE VIEW.",
      'warning@29: Could not parse CREATE TABLE: Expected referenced table near ")". The statement was skipped.',
      'warning@31: Skipped an index on expressions for "users".',
      "warning@-: Skipped 3 statements not needed for the diagram: schemas ×1, functions/triggers ×1, GRANT/REVOKE ×1.",
      'error@27: Duplicate table "public.USERS" (names are matched case-insensitively) was skipped.',
      'warning@14: Foreign key on "invoices" references unknown table "ghosts".',
    ]);
    expect(result.issues[0]?.statement).toBe(
      "CREATE VIEW active_users AS SELECT * FROM users WHERE name <> ';'",
    );
  });
});

describe("empty and non-DDL input", () => {
  it("returns ok: false with an error, never throwing", () => {
    expect(parseSql("", { now: NOW })).toMatchObject({
      ok: false,
      issues: [{ severity: "error", message: "The input is empty." }],
    });
    const r = parseSql("SELECT 1; INSERT INTO t VALUES (1);", { now: NOW });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.message)).toEqual([
      "Skipped 2 statements not needed for the diagram: SELECT ×1, data (INSERT) ×1.",
      "No CREATE TABLE statements were found.",
    ]);
  });
});
