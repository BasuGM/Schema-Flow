import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchemaText } from "@/parsers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { defaultLabel, detailCounts, getTableDetails, type TableDetails } from "./table-details";
import type { Schema, SchemaSource } from "./types";

const fixture = (path: string): Schema => {
  const text = readFileSync(join(process.cwd(), "tests/fixtures", path), "utf8");
  return parseSchemaText(text, { format: path.endsWith(".prisma") ? "prisma" : "auto" }).result
    .schema!;
};
const sample = createEcommerceSchema();
const details = (schema: Schema, id: string) => getTableDetails(schema, id)!;
const col = (d: TableDetails, name: string) => d.columns.find((c) => c.column.name === name)!;
const names = (cols: { name: string }[]) => cols.map((c) => c.name);
const rel = (r: TableDetails["outgoing"][number]) =>
  `${r.other.table}: ${r.pairs.map(([a, b]) => `${a.name}→${b.name}`).join(", ")}`;

describe("getTableDetails", () => {
  it("orders: FK targets, enum values, index, outgoing and incoming", () => {
    const d = details(sample, "public.orders");
    expect(detailCounts(d)).toEqual({ columns: 7, keys: 2, relations: 6 });
    expect(d.showSchema).toBe(false);
    expect(col(d, "user_id").references).toEqual([
      { tableId: "public.users", table: "users", column: { id: "public.users.id", name: "id" } },
    ]);
    expect(col(d, "status").enumValues).toEqual([
      "pending",
      "paid",
      "shipped",
      "delivered",
      "cancelled",
    ]);
    expect(d.indexes).toEqual([
      {
        name: "orders_user_status_idx",
        unique: false,
        columns: [
          { id: "public.orders.user_id", name: "user_id" },
          { id: "public.orders.status", name: "status" },
        ],
      },
    ]);
    expect(d.outgoing.map((r) => [rel(r), r.onDelete, r.name])).toEqual([
      ["users: user_id→id", "restrict", "orders_user_fk"],
      ["addresses: shipping_address_id→id", "set null", undefined],
      ["coupons: coupon_id→id", undefined, undefined],
    ]);
    expect(d.incoming.map(rel)).toEqual([
      "order_items: order_id→id",
      "payments: order_id→id",
      "shipments: order_id→id",
    ]);
    expect(d.incoming[1]!.cardinality).toBe("one-to-one");
  });

  it("users: incoming relations in declaration order", () => {
    const d = details(sample, "public.users");
    expect(d.outgoing).toEqual([]);
    expect(d.incoming.map((r) => [rel(r), r.onDelete])).toEqual([
      ["addresses: user_id→id", "cascade"],
      ["orders: user_id→id", "restrict"],
      ["reviews: user_id→id", "cascade"],
    ]);
  });

  it("composite primary keys keep key order; checks, uniques and indexes resolve names", () => {
    expect(names(details(sample, "public.order_items").primaryKey!.columns)).toEqual([
      "order_id",
      "line_no",
    ]);
    const products = details(sample, "public.products");
    expect(detailCounts(products)).toEqual({ columns: 9, keys: 5, relations: 3 });
    expect(products.checks.map((c) => c.name)).toEqual([
      "products_price_check",
      "products_stock_check",
    ]);
    expect(names(products.uniques[0]!.columns)).toEqual(["sku"]);
    expect(products.indexes.map((i) => i.name)).toEqual(["products_name_idx"]);
  });

  it("self-references appear in both lists, marked self; tables without keys are empty", () => {
    const d = details(sample, "public.categories");
    expect(d.outgoing.filter((r) => r.self)).toHaveLength(1);
    expect(d.incoming.filter((r) => r.self)).toHaveLength(1);
    expect(details(sample, "public.audit_log")).toMatchObject({
      primaryKey: undefined,
      uniques: [],
      indexes: [],
      checks: [],
      outgoing: [],
      incoming: [],
    });
  });

  it("composite foreign keys list their column pairs (Prisma, 1:1)", () => {
    const shop = fixture("prisma/shop.mysql.prisma");
    const d = details(shop, "shipments");
    expect(d.outgoing.map((r) => [rel(r), r.cardinality])).toEqual([
      ["order_lines: order_id→order_id, line_no→line_no", "one-to-one"],
    ]);
    expect(details(shop, "order_lines").incoming.map(rel)).toEqual([
      "shipments: order_id→order_id, line_no→line_no",
    ]);
  });

  it("Prisma implicit many-to-many tables and relations", () => {
    const blog = fixture("prisma/blog.prisma");
    const d = details(blog, "public._CategoryToPost");
    expect(d.table.origin).toBe("implicit");
    expect(d.outgoing.every((r) => r.implicit)).toBe(true);
    expect(d.indexes.map((i) => [i.name, i.unique])).toEqual([
      ["_CategoryToPost_AB_unique", true],
      ["_CategoryToPost_B_index", false],
    ]);
  });

  it("shows non-default schemas and unusual names", () => {
    const edge = fixture("sql/edge-cases.postgres.sql");
    expect(details(edge, "billing.invoices").showSchema).toBe(true);
    expect(details(edge, "public.users").incoming.map((r) => r.other.table)).toEqual([
      "Order Lines",
      "billing.invoices",
    ]);
    const lines = details(edge, "public.Order Lines");
    expect(names(lines.columns.map((c) => c.column))).toEqual([
      "LineID",
      "UserID",
      "note",
      'weird "quoted" col',
    ]);
  });

  it("returns null for an unknown table and shows unknown column ids raw", () => {
    expect(getTableDetails(sample, "public.nope")).toBeNull();
    const broken = structuredClone(sample);
    broken.tables["public.orders"]!.indexes[0]!.columnIds = ["public.orders.gone"];
    expect(details(broken, "public.orders").indexes[0]!.columns).toEqual([
      { id: "public.orders.gone", name: "public.orders.gone" },
    ]);
  });
});

describe("default labels (amendment 5)", () => {
  const prisma: SchemaSource = { format: "prisma", importedAt: "" };
  const sql: SchemaSource = { format: "sql", dialect: "mysql", importedAt: "" };

  it("Prisma: autoincrement() → auto-increment; functions as is; dbgenerated with a db hint", () => {
    const blog = fixture("prisma/blog.prisma");
    expect(col(details(blog, "public.users"), "id").default).toEqual({
      text: "auto-increment",
      auto: true,
      db: false,
    });
    expect(col(details(blog, "public.users"), "created_at").default?.text).toBe("now()");
    expect(col(details(blog, "public.posts"), "id").default?.text).toBe("uuid()");
    for (const fn of ["cuid()", "nanoid()"]) {
      expect(defaultLabel({ kind: "function", value: fn }, prisma)).toEqual({
        text: fn,
        auto: false,
        db: false,
      });
    }
    expect(defaultLabel({ kind: "expression", value: "gen_random_uuid()" }, prisma)).toEqual({
      text: "gen_random_uuid()",
      auto: false,
      db: true,
    });
  });

  it("SQL: identity, serial and AUTO_INCREMENT → auto-increment; literals keep their quotes", () => {
    expect(col(details(sample, "public.users"), "id").default?.text).toBe("auto-increment");
    const edge = fixture("sql/edge-cases.postgres.sql");
    expect(col(details(edge, "public.Order Lines"), "LineID").default?.auto).toBe(true);
    expect(col(details(edge, "public.Order Lines"), "note").default?.text).toBe("'it''s; fine'");
    const shop = fixture("sql/shop.mysql.sql");
    expect(col(details(shop, "customers"), "id").default?.text).toBe("auto-increment");
    expect(col(details(sample, "public.addresses"), "country").default?.text).toBe("'US'");
    expect(defaultLabel({ kind: "expression", value: "a + b" }, sql).db).toBe(false);
  });
});
