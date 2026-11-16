import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ImportResult, Schema } from "@/domain/schema/types";
import { detectFormat } from "../detect-format";
import { parsePrisma } from "./parse-prisma";

const FIXTURES = new URL("../../../tests/fixtures/prisma/", import.meta.url);
const NOW = () => "2026-01-01T00:00:00.000Z";

function load(name: string): string {
  return readFileSync(new URL(name, FIXTURES), "utf8");
}

function parse(name: string): { result: ImportResult; schema: Schema } {
  const result = parsePrisma(load(name), { now: NOW });
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
const column = (s: Schema, id: string) => {
  const [table, name] = [id.slice(0, id.lastIndexOf(".")), id.slice(id.lastIndexOf(".") + 1)];
  return s.tables[table]?.columns.find((c) => c.name === name);
};

describe("blog.prisma (PostgreSQL)", () => {
  const { result, schema } = parse("blog.prisma");

  it("is detected as Prisma and imports with the documented counts", () => {
    expect(detectFormat(load("blog.prisma")).format).toBe("prisma");
    expect(result.ok).toBe(true);
    expect(schema.source).toEqual({ format: "prisma", dialect: "postgresql", importedAt: NOW() });
    expect(schema.tableOrder).toEqual([
      "public.users",
      "public.profiles",
      "public.posts",
      "public.categories",
      "public.Tag",
      "public.post_tags",
      "public.Comment",
      "public._Follows",
      "public._CategoryToPost",
    ]);
    expect(columnCount(schema)).toBe(31);
    expect(issueList(result)).toEqual([
      'warning@98: Skipped view "PostStats": views are not part of the diagram.',
    ]);
  });

  it("maps relations (incl. one-to-one, self and implicit many-to-many) to the @map columns", () => {
    expect(rels(schema)).toEqual([
      "public.Comment.authorId -> public.users.id (many-to-one)",
      "public.Comment.parentId -> public.Comment.id (many-to-one)",
      "public.Comment.postId -> public.posts.id (many-to-one)",
      "public._CategoryToPost.A -> public.categories.id (many-to-one)",
      "public._CategoryToPost.B -> public.posts.id (many-to-one)",
      "public._Follows.A -> public.users.id (many-to-one)",
      "public._Follows.B -> public.users.id (many-to-one)",
      "public.post_tags.post_id -> public.posts.id (many-to-one)",
      "public.post_tags.tag_id -> public.Tag.id (many-to-one)",
      "public.posts.author_id -> public.users.id (many-to-one)",
      "public.profiles.user_id -> public.users.id (one-to-one)",
    ]);
    const implicit = Object.values(schema.relationships).filter(
      (r) => r.origin === "prisma-implicit",
    );
    expect(implicit).toHaveLength(4);
    expect(implicit.every((r) => r.onDelete === "cascade")).toBe(true);
    expect(schema.tables["public._CategoryToPost"]).toMatchObject({ origin: "implicit" });
    expect(schema.tables["public._CategoryToPost"]?.columns.map((c) => c.dataType.raw)).toEqual([
      "Int",
      "uuid",
    ]);
    const postFk = Object.values(schema.relationships).find((r) => r.name === "post_tags_post_fk");
    expect(postFk?.onDelete).toBe("cascade");
  });

  it("maps types, nullability, defaults, keys, enums and doc comments", () => {
    expect(column(schema, "public.users.email")).toMatchObject({
      dataType: { raw: "varchar(255)" },
      nullable: false,
      isUnique: true,
    });
    expect(column(schema, "public.users.name")?.nullable).toBe(true);
    expect(column(schema, "public.users.role")).toMatchObject({
      dataType: { enumName: "role" },
      default: { kind: "literal", value: "READER" },
    });
    expect(column(schema, "public.users.created_at")).toMatchObject({
      dataType: { raw: "timestamptz(6)" },
      default: { kind: "function", value: "now()" },
    });
    expect(column(schema, "public.users.id")?.default?.kind).toBe("autoincrement");
    expect(column(schema, "public.posts.tags")?.dataType.isArray).toBe(true);
    expect(column(schema, "public.posts.location")?.dataType.raw).toBe("point");
    expect(column(schema, "public.profiles.bio")?.comment).toBe("Shown on the author page.");
    expect(schema.tables["public.users"]?.comment).toBe("Application users.");
    expect(schema.tables["public.post_tags"]?.primaryKey?.columnIds).toEqual([
      "public.post_tags.post_id",
      "public.post_tags.tag_id",
    ]);
    expect(schema.tables["public.posts"]?.indexes[0]?.columnIds).toEqual([
      "public.posts.author_id",
      "public.posts.published",
    ]);
    expect(schema.enums).toEqual({
      role: { name: "role", values: ["ADMIN", "author", "READER"] },
    });
  });
});

describe("shop.mysql.prisma (MySQL)", () => {
  const { result, schema } = parse("shop.mysql.prisma");

  it("imports 4 tables, 14 columns and 3 relationships with no issues", () => {
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(schema.source.dialect).toBe("mysql");
    expect(schema.tableOrder).toEqual(["customers", "orders", "order_lines", "shipments"]);
    expect(columnCount(schema)).toBe(14);
    expect(rels(schema)).toEqual([
      "order_lines.order_id -> orders.id (many-to-one)",
      "orders.customer_id -> customers.id (many-to-one)",
      "shipments.order_id+shipments.line_no -> order_lines.order_id+order_lines.line_no (one-to-one)",
    ]);
  });

  it("maps native MySQL types, referential actions and named keys", () => {
    expect(column(schema, "customers.id")?.dataType.raw).toBe("int unsigned");
    expect(column(schema, "orders.total")?.dataType).toMatchObject({
      base: "decimal",
      params: ["10", "2"],
    });
    expect(column(schema, "orders.status")?.dataType.enumName).toBe("OrderStatus");
    const customerFk = Object.values(schema.relationships).find((r) => r.from.tableId === "orders");
    expect(customerFk).toMatchObject({ onDelete: "restrict", onUpdate: "cascade" });
    expect(schema.tables["order_lines"]?.uniqueConstraints).toEqual([
      { name: "order_sku", columnIds: ["order_lines.order_id", "order_lines.sku"] },
    ]);
    expect(schema.tables["orders"]?.indexes.map((i) => i.name)).toEqual([
      "idx_order_customer",
      undefined,
    ]);
  });
});

describe("edge-cases.prisma — bad lines and blocks don't block good ones", () => {
  const { result, schema } = parse("edge-cases.prisma");

  it("imports the good models and fails ok only because of the duplicate table", () => {
    expect(result.ok).toBe(false);
    expect(schema.tableOrder).toEqual(["public.Account", "public.Person", "public.Wallet"]);
    expect(columnCount(schema)).toBe(8);
    expect(rels(schema)).toEqual(["public.Account.ownerId -> public.Person.id (many-to-one)"]);
    expect(schema.tables["public.Account"]?.indexes[0]?.columnIds).toHaveLength(2);
    expect(column(schema, "public.Person.name")?.comment).toBe("The person's display name.");
  });

  it("reports every problem with its line", () => {
    expect(issueList(result)).toEqual([
      "warning@45: Unterminated string.",
      'warning@11: Could not parse a line in model "Account": Expected a value. The line was skipped.',
      'warning@29: Unknown block "modle Typo" was skipped.',
      'warning@43: Block "Wallet" is missing a closing "}".',
      'warning@45: Could not parse a line in model "Wallet": Expected the end of the line, found ""oops". The line was skipped.',
      'warning@39: Skipped view "Summary": views are not part of the diagram.',
      'warning@15: Unknown type "Ghost" on "Account.ghost"; kept as written.',
      'warning@13: Relation "Account.wallet" references unknown field(s) Wallet.uuid; skipped.',
      'error@33: Duplicate table "public.Account" (names are matched case-insensitively) was skipped.',
    ]);
  });
});

describe("empty and model-less input", () => {
  it("returns ok: false with an error, never throwing", () => {
    expect(issueList(parsePrisma("  \n"))).toEqual(["error@-: The input is empty."]);
    const noModels = parsePrisma('datasource db {\n  provider = "sqlite"\n}\nenum E {\n  A\n}');
    expect(noModels.ok).toBe(false);
    expect(issueList(noModels)).toEqual(["error@-: No models were found."]);
  });
});
