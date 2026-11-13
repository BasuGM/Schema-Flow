import { describe, expect, it } from "vitest";
import type { Position, Schema } from "@/domain/schema/types";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { generateSyntheticSchema } from "@/samples/synthetic";
import { routeSegments, type CubicSegment } from "./edge-path";
import { layoutWithDagre } from "./layout-dagre";
import {
  NODE_ROW_HEIGHT,
  NODE_WIDTH,
  NODE_HEADER_HEIGHT,
  NODE_PADDING_Y,
  estimateNodeHeight,
} from "./node-metrics";

const schema = createEcommerceSchema();

type Box = { id: string; x: number; y: number; w: number; h: number };

function boxes(s: Schema, positions: Record<string, Position>): Box[] {
  return s.tableOrder.map((id) => ({
    id,
    ...positions[id]!,
    w: NODE_WIDTH,
    h: estimateNodeHeight(s.tables[id]!.columns.length),
  }));
}

function sample(seg: CubicSegment, t: number): Position {
  const u = 1 - t;
  const f = (a: number, b: number, c: number, d: number) =>
    u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  return {
    x: f(seg.from.x, seg.c1.x, seg.c2.x, seg.to.x),
    y: f(seg.from.y, seg.c1.y, seg.c2.y, seg.to.y),
  };
}

/** Handle positions as rendered: FK row on the source's left edge, referenced row on the target's right edge. */
function handle(
  s: Schema,
  pos: Record<string, Position>,
  columnId: string,
  side: "left" | "right",
): Position {
  const table = Object.values(s.tables).find((t) => t.columns.some((c) => c.id === columnId))!;
  const row = table.columns.findIndex((c) => c.id === columnId);
  const p = pos[table.id]!;
  return {
    x: side === "left" ? p.x : p.x + NODE_WIDTH,
    y: p.y + NODE_HEADER_HEIGHT + NODE_PADDING_Y + row * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2,
  };
}

describe("layoutWithDagre", () => {
  it("positions every table", () => {
    const { positions } = layoutWithDagre(schema);
    expect(Object.keys(positions).sort()).toEqual([...schema.tableOrder].sort());
    for (const p of Object.values(positions))
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it("is deterministic", () => {
    expect(layoutWithDagre(schema)).toEqual(layoutWithDagre(schema));
  });

  it("places referenced tables before referencing tables (LR → left, TB → above)", () => {
    const lr = layoutWithDagre(schema).positions;
    expect(lr["public.users"]!.x).toBeLessThan(lr["public.orders"]!.x);
    expect(lr["public.orders"]!.x).toBeLessThan(lr["public.payments"]!.x);
    const tb = layoutWithDagre(schema, { direction: "TB" }).positions;
    expect(tb["public.users"]!.y).toBeLessThan(tb["public.orders"]!.y);
  });

  it("does not overlap nodes", () => {
    const all = boxes(schema, layoutWithDagre(schema).positions);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(
          false,
        );
      }
    }
  });

  it("estimates node heights from column count and collapse mode", () => {
    expect(estimateNodeHeight(0)).toBeLessThan(estimateNodeHeight(1));
    expect(estimateNodeHeight(10)).toBeGreaterThan(estimateNodeHeight(5));
    const collapsed = layoutWithDagre(schema, {
      collapsed: Object.fromEntries(schema.tableOrder.map((id) => [id, "header" as const])),
    });
    expect(Object.keys(collapsed.positions)).toHaveLength(12);
  });

  it("lays out 200 synthetic tables in reasonable time", () => {
    const big = generateSyntheticSchema({ tables: 200 });
    const start = performance.now();
    const { positions } = layoutWithDagre(big);
    expect(Object.keys(positions)).toHaveLength(200);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe("edge routes (QA-001)", () => {
  const { positions, edgeRoutes } = layoutWithDagre(schema);
  const ordersToUsers = Object.values(schema.relationships).find(
    (r) => r.name === "orders_user_fk",
  )!;

  it("routes edges that span more than one rank, recording end positions", () => {
    const route = edgeRoutes[ordersToUsers.id];
    expect(route).toBeDefined();
    expect(route!.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(route!.sourceAt).toEqual(positions["public.orders"]);
    expect(route!.targetAt).toEqual(positions["public.users"]);
    // Ordered from the FK side (orders, right) towards the referenced side (users, left).
    expect(route!.waypoints[0]!.x).toBeGreaterThan(route!.waypoints.at(-1)!.x);
  });

  it("does not route adjacent-rank edges or self-references", () => {
    const selfRef = Object.values(schema.relationships).find(
      (r) => r.from.tableId === r.to.tableId,
    )!;
    expect(edgeRoutes[selfRef.id]).toBeUndefined();
    expect(Object.keys(edgeRoutes).length).toBeLessThan(Object.keys(schema.relationships).length);
  });

  it("keeps every edge (routed or direct curve) out of unrelated tables", () => {
    const all = boxes(schema, positions);
    for (const rel of Object.values(schema.relationships)) {
      if (rel.from.tableId === rel.to.tableId) continue;
      const id = rel.id;
      const points = [
        handle(schema, positions, rel.from.columnIds[0]!, "left"),
        ...(edgeRoutes[id]?.waypoints ?? []),
        handle(schema, positions, rel.to.columnIds[0]!, "right"),
      ];
      for (const seg of routeSegments(points)) {
        for (let t = 0; t <= 1; t += 0.02) {
          const p = sample(seg, t);
          const hit = all.find(
            (b) =>
              b.id !== rel.from.tableId &&
              b.id !== rel.to.tableId &&
              p.x > b.x &&
              p.x < b.x + b.w &&
              p.y > b.y &&
              p.y < b.y + b.h,
          );
          expect(hit?.id, `${id} passes through ${hit?.id}`).toBeUndefined();
        }
      }
    }
  });

  it("only produces routes for LR layouts", () => {
    expect(layoutWithDagre(schema, { direction: "TB" }).edgeRoutes).toEqual({});
  });
});
