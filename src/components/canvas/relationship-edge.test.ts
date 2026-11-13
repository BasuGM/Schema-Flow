import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { describeRelationship, shortRelationshipLabel } from "./relationship-edge";

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
});

describe("shortRelationshipLabel (QA-002)", () => {
  it("names only the FK column(s) and the referenced table.column", () => {
    const rel = Object.values(schema.relationships).find((r) => r.name === "orders_user_fk")!;
    expect(shortRelationshipLabel(rel, schema)).toBe("user_id → users.id");
  });

  it("lists every column of a composite key", () => {
    const rel = Object.values(schema.relationships).find(
      (r) => r.from.tableId === "public.payments",
    )!;
    expect(shortRelationshipLabel(rel, schema)).toBe("order_id → orders.id");
    const composite = {
      ...rel,
      from: {
        tableId: "public.order_items",
        columnIds: ["public.order_items.order_id", "public.order_items.line_no"],
      },
      to: {
        tableId: "public.order_items",
        columnIds: ["public.order_items.order_id", "public.order_items.line_no"],
      },
    };
    expect(shortRelationshipLabel(composite, schema)).toBe(
      "order_id, line_no → order_items.order_id, line_no",
    );
  });
});
