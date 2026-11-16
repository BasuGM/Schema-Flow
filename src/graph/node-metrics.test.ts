import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import {
  NODE_HEADER_HEIGHT,
  NODE_PADDING_Y,
  NODE_ROW_HEIGHT,
  renderedColumns,
  rowCenterOffset,
} from "./node-metrics";

const orders = createEcommerceSchema().tables["public.orders"]!;
const names = (cols: { name: string }[]) => cols.map((c) => c.name);

describe("renderedColumns", () => {
  it("adds a highlighted column that the collapse mode hides, in declaration order", () => {
    expect(renderedColumns(orders, "header", "public.orders.user_id").map((c) => c.name)).toEqual([
      "user_id",
    ]);
    expect(names(renderedColumns(orders, "keys", "public.orders.status"))).toEqual([
      "id",
      "user_id",
      "shipping_address_id",
      "coupon_id",
      "status",
    ]);
    expect(renderedColumns(orders, "full", "public.orders.status")).toBe(orders.columns);
    expect(renderedColumns(orders, "header")).toEqual([]);
  });

  it("gives the centre of a row for centering the canvas on it", () => {
    const rows = renderedColumns(orders, "full");
    expect(rowCenterOffset(rows, "public.orders.id")).toBe(
      NODE_HEADER_HEIGHT + NODE_PADDING_Y + NODE_ROW_HEIGHT / 2,
    );
    expect(rowCenterOffset(rows, "public.orders.placed_at")).toBe(
      NODE_HEADER_HEIGHT + NODE_PADDING_Y + 6 * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2,
    );
    expect(rowCenterOffset([], "public.orders.id")).toBeNull();
  });
});
