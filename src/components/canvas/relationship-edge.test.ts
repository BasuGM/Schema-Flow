import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { describeRelationship } from "./relationship-edge";

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
