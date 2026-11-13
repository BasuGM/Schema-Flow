import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { generateSyntheticSchema } from "@/samples/synthetic";
import { layoutWithDagre } from "./layout-dagre";
import { NODE_WIDTH, estimateNodeHeight } from "./node-metrics";

const schema = createEcommerceSchema();

describe("layoutWithDagre", () => {
  it("positions every table", () => {
    const positions = layoutWithDagre(schema);
    expect(Object.keys(positions).sort()).toEqual([...schema.tableOrder].sort());
    for (const p of Object.values(positions)) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(layoutWithDagre(schema)).toEqual(layoutWithDagre(schema));
  });

  it("places referenced tables before referencing tables (LR → left, TB → above)", () => {
    const lr = layoutWithDagre(schema);
    expect(lr["public.users"]!.x).toBeLessThan(lr["public.orders"]!.x);
    expect(lr["public.orders"]!.x).toBeLessThan(lr["public.payments"]!.x);
    const tb = layoutWithDagre(schema, { direction: "TB" });
    expect(tb["public.users"]!.y).toBeLessThan(tb["public.orders"]!.y);
  });

  it("does not overlap nodes in the same rank", () => {
    const positions = layoutWithDagre(schema);
    const boxes = schema.tableOrder.map((id) => ({
      ...positions[id]!,
      h: estimateNodeHeight(schema.tables[id]!.columns.length),
    }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap =
          a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it("estimates node heights from column count and collapse mode", () => {
    expect(estimateNodeHeight(0)).toBeLessThan(estimateNodeHeight(1));
    expect(estimateNodeHeight(10)).toBeGreaterThan(estimateNodeHeight(5));
    const collapsed = layoutWithDagre(schema, {
      collapsed: Object.fromEntries(schema.tableOrder.map((id) => [id, "header" as const])),
    });
    expect(Object.keys(collapsed)).toHaveLength(12);
  });

  it("lays out 200 synthetic tables in reasonable time", () => {
    const big = generateSyntheticSchema({ tables: 200 });
    const start = performance.now();
    const positions = layoutWithDagre(big);
    expect(Object.keys(positions)).toHaveLength(200);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
