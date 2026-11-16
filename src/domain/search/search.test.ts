import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import type { Schema } from "@/domain/schema/types";
import { parseSchemaText } from "@/parsers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { matchTerm, prepareField, prepareTerm, Tier } from "./field";
import { buildSearchIndex, getSearchIndex } from "./search-index";
import { search } from "./search";

const fixture = (path: string): Schema => {
  const text = readFileSync(join(process.cwd(), "tests/fixtures", path), "utf8");
  return parseSchemaText(text, { format: path.endsWith(".prisma") ? "prisma" : "auto" }).result
    .schema!;
};

const ecommerce = createEcommerceSchema();
const run = (schema: Schema, q: string) => search(buildSearchIndex(schema), q);
const tableNames = (schema: Schema, q: string) =>
  run(schema, q).tables.map((h) => h.entry.name.raw);
const columnNames = (schema: Schema, q: string) =>
  run(schema, q).columns.map((h) => `${h.entry.table.name.raw}.${h.entry.name.raw}`);
const match = (name: string, term: string) => matchTerm(prepareField(name), prepareTerm(term));

describe("matchTerm tiers", () => {
  it("ranks exact, prefix, segment prefix, substring, then fuzzy", () => {
    expect(match("users", "users")?.tier).toBe(Tier.exact);
    expect(match("users", "use")?.tier).toBe(Tier.prefix);
    expect(match("order_user_id", "user")?.tier).toBe(Tier.segment);
    expect(match("paid_at", "id")?.tier).toBe(Tier.substring);
    expect(match("order_items", "ordit")?.tier).toBe(Tier.fuzzy);
    expect(match("users", "zzz")).toBeNull();
  });

  it("is case-insensitive and compares a separator-free form (camelCase finds snake_case)", () => {
    expect(match("USERS", "users")?.tier).toBe(Tier.exact);
    expect(match("created_at", "createdAt")).toEqual({
      tier: Tier.exact,
      ranges: [
        [0, 7],
        [8, 10],
      ],
    });
    expect(match("authorId", "author_id")?.tier).toBe(Tier.exact);
    expect(match("PostTag", "tag")?.tier).toBe(Tier.segment); // camelCase hump
  });

  it("fuzzy runs must start at segment starts, and only for 3+ characters (amendment 1)", () => {
    expect(match("user_id", "uid")).toEqual({
      tier: Tier.fuzzy,
      ranges: [
        [0, 1],
        [5, 7],
      ],
    });
    expect(match("order_user_id", "uid")?.tier).toBe(Tier.fuzzy);
    expect(match("unit_price_cents", "uid")).toBeNull(); // no segment starts with "i"
    expect(match("quantity", "qty")).toBeNull(); // "t" and "y" are not segment starts
    expect(match("user_id", "ui")).toBeNull(); // 2 characters: no fuzzy
    expect(match("order_items", "ordit")?.ranges).toEqual([
      [0, 3],
      [6, 8],
    ]);
  });

  it("reports ranges in the original name for quoted and spaced names", () => {
    expect(match('weird "quoted" col', "quoted")).toEqual({
      tier: Tier.segment,
      ranges: [[7, 13]],
    });
    expect(match("Order Lines", "orderlines")?.tier).toBe(Tier.exact);
    expect(match("Straße", "straße")?.tier).toBe(Tier.exact);
  });
});

describe("search", () => {
  it("one term matches the primary field only (user)", () => {
    const r = run(ecommerce, "user");
    expect(r.tables.map((h) => h.entry.name.raw)).toEqual(["users"]);
    expect(columnNames(ecommerce, "user")).toEqual([
      "addresses.user_id",
      "orders.user_id",
      "reviews.user_id",
    ]);
    expect(r.totalColumns).toBe(3); // not every column of "users"
  });

  it("dotted queries are positional from the right (ord.user, billing.inv, orders.)", () => {
    expect(run(ecommerce, "ord.user").tables).toEqual([]);
    expect(columnNames(ecommerce, "ord.user")).toEqual(["orders.user_id"]);
    expect(columnNames(ecommerce, "orders.")).toEqual([
      "orders.id",
      "orders.user_id",
      "orders.shipping_address_id",
      "orders.coupon_id",
      "orders.status",
      "orders.total_cents",
      "orders.placed_at",
    ]);
    const edge = fixture("sql/edge-cases.postgres.sql");
    expect(run(edge, "billing.inv").tables.map((h) => h.entry.id)).toEqual(["billing.invoices"]);
    expect(columnNames(edge, "Order Lines.note")).toEqual(["Order Lines.note"]);
    expect(run(ecommerce, "a.b.c.d").columns).toEqual([]);
  });

  it("space-separated terms are ANDed, with one on the primary field (order user)", () => {
    expect(columnNames(ecommerce, "order user")).toEqual(["orders.user_id"]);
    expect(columnNames(ecommerce, "orders")).toEqual([]); // table term alone isn't a column hit
    expect(tableNames(fixture("sql/edge-cases.postgres.sql"), "order lines")).toEqual([
      "Order Lines",
    ]);
  });

  it("uid uses segment-anchored fuzzy matching", () => {
    expect(columnNames(ecommerce, "uid")).toEqual([
      "addresses.user_id",
      "orders.user_id",
      "reviews.user_id",
    ]);
    expect(run(ecommerce, "uid").columns.every((h) => h.tier === Tier.fuzzy)).toBe(true);
  });

  it("orders by tier, then name length, then declaration order", () => {
    const names = columnNames(ecommerce, "id");
    expect(names.slice(0, 2)).toEqual(["users.id", "addresses.id"]); // exact, declaration order
    const tiers = run(ecommerce, "id").columns.map((h) => h.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it("finds Prisma mapped names with camelCase queries", () => {
    const blog = fixture("prisma/blog.prisma");
    expect(columnNames(blog, "createdAt")).toEqual(["users.created_at"]);
    expect(columnNames(blog, "authorId")).toEqual(["Comment.authorId", "posts.author_id"]);
  });

  it("caps each group and reports totals; an empty query lists tables in order", () => {
    const r = search(buildSearchIndex(ecommerce), "id", 5);
    expect(r.columns).toHaveLength(5);
    expect(r.totalColumns).toBeGreaterThan(5);
    const empty = search(buildSearchIndex(ecommerce), "  ", 3);
    expect(empty.tables.map((h) => h.entry.id)).toEqual(ecommerce.tableOrder.slice(0, 3));
    expect(empty.totalTables).toBe(ecommerce.tableOrder.length);
    expect(empty.columns).toEqual([]);
  });

  it("returns nothing for no match", () => {
    const r = run(ecommerce, "zzzz");
    expect(r.totalTables + r.totalColumns).toBe(0);
  });

  it("highlights per field", () => {
    const [hit] = run(ecommerce, "ord.user").columns;
    expect(hit?.marks).toEqual({ schema: [], table: [[0, 3]], column: [[0, 4]] });
  });
});

describe("search index", () => {
  it("shows the schema name only when it isn't the source default (amendment 3)", () => {
    const edge = buildSearchIndex(fixture("sql/edge-cases.postgres.sql"));
    const shown = Object.fromEntries(edge.tables.map((t) => [t.id, t.showSchema]));
    expect(shown).toMatchObject({ "public.users": false, "billing.invoices": true });
    for (const path of ["sql/shop.mysql.sql", "sql/blog.sqlite.sql", "prisma/blog.prisma"]) {
      expect(
        buildSearchIndex(fixture(path)).tables.some((t) => t.showSchema),
        path,
      ).toBe(false);
    }
  });

  it("is built once per schema object", () => {
    const a = createEcommerceSchema();
    expect(getSearchIndex(a)).toBe(getSearchIndex(a));
    expect(getSearchIndex(createEcommerceSchema())).not.toBe(getSearchIndex(a));
  });

  it("includes tables without columns", () => {
    const schema = normalizeSchema({
      name: "t",
      source: { format: "sample", importedAt: "2026-01-01T00:00:00.000Z" },
      tables: [{ name: "empty", columns: [] }],
    });
    expect(tableNames(schema, "emp")).toEqual(["empty"]);
  });
});
