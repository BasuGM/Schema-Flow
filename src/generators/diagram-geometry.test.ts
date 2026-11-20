import { describe, expect, it } from "vitest";
import { NODE_HEADER_HEIGHT, estimateNodeHeight, visibleColumns } from "@/graph/node-metrics";
import { layoutWithDagre } from "@/graph/layout-dagre";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { diagramGeometry, hitTable } from "./diagram-geometry";

const schema = createEcommerceSchema();
const { positions, edgeRoutes } = layoutWithDagre(schema);

describe("diagramGeometry", () => {
  it("gives every table a rect that follows its collapse mode", () => {
    const first = schema.tableOrder[0]!;
    const second = schema.tableOrder[1]!;
    const g = diagramGeometry(schema, {
      positions,
      edgeRoutes,
      collapsed: { [first]: "keys", [second]: "header" },
    });
    expect(g.tables).toHaveLength(schema.tableOrder.length);
    const by = Object.fromEntries(g.tables.map((t) => [t.id, t]));
    expect(by[first]!.h).toBe(
      estimateNodeHeight(visibleColumns(schema.tables[first]!, "keys").length),
    );
    expect(by[second]!.h).toBe(estimateNodeHeight(0));
    expect(by[second]!.h).toBeGreaterThanOrEqual(NODE_HEADER_HEIGHT);
    expect(by[first]!.x).toBe(positions[first]!.x);
  });

  it("is deterministic and has one edge per resolvable relationship", () => {
    const layout = { positions, edgeRoutes, collapsed: {} };
    const a = diagramGeometry(schema, layout);
    expect(a).toEqual(diagramGeometry(schema, layout));
    expect(a.edges).toHaveLength(Object.keys(schema.relationships).length);
    expect(a.edges.every((e) => e.d.length > 0)).toBe(true);
  });
});

describe("hitTable", () => {
  const tables = [
    { id: "a", x: 0, y: 0, w: 100, h: 50, mode: "full" as const },
    { id: "b", x: 200, y: 0, w: 100, h: 50, mode: "full" as const },
  ];
  it("returns the table under the point, or null between tables", () => {
    expect(hitTable(tables, { x: 10, y: 10 })).toBe("a");
    expect(hitTable(tables, { x: 250, y: 49 })).toBe("b");
    expect(hitTable(tables, { x: 150, y: 10 })).toBeNull();
    expect(hitTable(tables, { x: 10, y: 60 })).toBeNull();
  });
});
