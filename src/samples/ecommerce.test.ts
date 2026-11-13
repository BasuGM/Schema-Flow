import { describe, expect, it } from "vitest";
import { getIncomingRelationships, getOutgoingRelationships } from "@/domain/schema/selectors";
import { validateSchema } from "@/domain/schema/validate";
import { createEcommerceSchema } from "./ecommerce";

const schema = createEcommerceSchema();
const tables = Object.values(schema.tables);
const rels = Object.values(schema.relationships);

/** Reference values — mirrored in docs/development/VERIFICATION.md for Cowork. */
const ECOMMERCE_EXPECTED = {
  tables: 12,
  columns: 71,
  relationships: 13,
  oneToOne: 1,
  enums: 2,
};

describe("e-commerce sample", () => {
  it("is valid with no import issues", () => {
    expect(schema.issues).toEqual([]);
    expect(validateSchema(schema)).toEqual([]);
  });

  it("has the documented counts", () => {
    expect(tables).toHaveLength(ECOMMERCE_EXPECTED.tables);
    expect(tables.reduce((n, t) => n + t.columns.length, 0)).toBe(ECOMMERCE_EXPECTED.columns);
    expect(rels).toHaveLength(ECOMMERCE_EXPECTED.relationships);
    expect(rels.filter((r) => r.cardinality === "one-to-one")).toHaveLength(
      ECOMMERCE_EXPECTED.oneToOne,
    );
    expect(Object.keys(schema.enums)).toHaveLength(ECOMMERCE_EXPECTED.enums);
  });

  it("has the documented per-table column counts", () => {
    expect(Object.fromEntries(tables.map((t) => [t.name, t.columns.length]))).toEqual({
      users: 7,
      addresses: 8,
      categories: 4,
      products: 9,
      product_categories: 2,
      coupons: 6,
      orders: 7,
      order_items: 5,
      payments: 6,
      shipments: 6,
      reviews: 6,
      audit_log: 5,
    });
  });

  it("covers the deliberate edge cases", () => {
    const t = schema.tables;
    expect(
      rels.some(
        (r) => r.from.tableId === "public.categories" && r.to.tableId === "public.categories",
      ),
    ).toBe(true);
    expect(t["public.product_categories"]?.primaryKey?.columnIds).toHaveLength(2);
    expect(t["public.order_items"]?.primaryKey?.columnIds).toHaveLength(2);
    expect(rels.find((r) => r.cardinality === "one-to-one")?.from.tableId).toBe("public.payments");
    expect(t["public.audit_log"]?.primaryKey).toBeUndefined();
    expect(rels.some((r) => [r.from.tableId, r.to.tableId].includes("public.audit_log"))).toBe(
      false,
    );
    expect(t["public.orders"]?.columns.find((c) => c.name === "status")?.dataType.enumName).toBe(
      "order_status",
    );
    expect(t["public.products"]?.columns.find((c) => c.name === "tags")?.dataType.isArray).toBe(
      true,
    );
    expect(t["public.reviews"]?.uniqueConstraints[0]?.columnIds).toHaveLength(2);
    expect(tables.flatMap((x) => x.checkConstraints)).toHaveLength(5);
  });

  it("has the documented outgoing/incoming relationship counts per table", () => {
    const counts = Object.fromEntries(
      tables.map((t) => [
        t.name,
        [
          getOutgoingRelationships(schema, t.id).length,
          getIncomingRelationships(schema, t.id).length,
        ],
      ]),
    );
    expect(counts).toEqual({
      users: [0, 3],
      addresses: [1, 1],
      categories: [1, 2],
      products: [0, 3],
      product_categories: [2, 0],
      coupons: [0, 1],
      orders: [3, 3],
      order_items: [2, 0],
      payments: [1, 0],
      shipments: [1, 0],
      reviews: [2, 0],
      audit_log: [0, 0],
    });
  });
});
