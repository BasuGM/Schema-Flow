import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { describeRelationship } from "./describe";

const schema = createEcommerceSchema();

describe("describeRelationship", () => {
  it("includes the constraint name and column pairs", () => {
    const rel = Object.values(schema.relationships).find((r) => r.name === "orders_user_fk")!;
    expect(describeRelationship(rel, schema)).toBe("orders_user_fk · orders.user_id → users.id");
  });

  it("omits the name when the constraint is unnamed", () => {
    const rel = Object.values(schema.relationships).find(
      (r) => r.from.tableId === "public.shipments",
    )!;
    expect(describeRelationship(rel, schema)).toBe("shipments.order_id → orders.id");
  });

  it("lists every column pair of a composite key", () => {
    const rel = Object.values(schema.relationships)[0]!;
    const composite = {
      ...rel,
      name: undefined,
      from: {
        tableId: "public.order_items",
        columnIds: ["public.order_items.order_id", "public.order_items.line_no"],
      },
      to: {
        tableId: "public.order_items",
        columnIds: ["public.order_items.order_id", "public.order_items.line_no"],
      },
    };
    expect(describeRelationship(composite, schema)).toBe(
      "order_items.order_id → order_items.order_id, order_items.line_no → order_items.line_no",
    );
  });
});
