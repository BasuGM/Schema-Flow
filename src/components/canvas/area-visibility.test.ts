import { describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import type { RelationshipFlowEdge, TableFlowNode } from "@/graph/types";
import { applyAreaVisibility, deselectHiddenEdges, hiddenTableIds } from "./area-visibility";

const t = (name: string, schemaName: string, ref?: [string, string]) => ({
  name,
  schemaName,
  columns: [
    { name: "id", type: "int", primaryKey: true },
    ...(ref
      ? [{ name: "r_id", type: "int", references: { table: ref[1], schemaName: ref[0] } }]
      : []),
  ],
});
const schema = normalizeSchema(
  draft([t("a1", "x"), t("a2", "x", ["x", "a1"]), t("b1", "y", ["x", "a1"]), t("b2", "y")]),
);
const ids = schema.tableOrder;
const node = (id: string, hidden?: boolean) =>
  ({ id, position: { x: 0, y: 0 }, data: {}, ...(hidden ? { hidden } : {}) }) as TableFlowNode;
const edge = (id: string, source: string, target: string, selected = false) =>
  ({ id, source, target, selected }) as RelationshipFlowEdge;

describe("hiddenTableIds", () => {
  it("lists the tables of hidden areas", () => {
    expect(hiddenTableIds(schema, new Set(["y"]))).toEqual(new Set(["y.b1", "y.b2"]));
    expect(hiddenTableIds(schema, new Set()).size).toBe(0);
    expect(hiddenTableIds(null, new Set(["y"])).size).toBe(0);
  });
});

describe("applyAreaVisibility", () => {
  const nodes = ids.map((id) => node(id));
  const edges = [edge("e1", "x.a2", "x.a1"), edge("e2", "y.b1", "x.a1")];

  it("hides nodes of hidden areas and every edge touching them, keeping identity of the rest", () => {
    const out = applyAreaVisibility(nodes, edges, hiddenTableIds(schema, new Set(["y"])));
    expect(out.nodes.filter((n) => n.hidden).map((n) => n.id)).toEqual(["y.b1", "y.b2"]);
    expect(out.edges.map((e) => !!e.hidden)).toEqual([false, true]);
    expect(out.nodes[0]).toBe(nodes[0]);
    expect(out.edges[0]).toBe(edges[0]);
  });

  it("returns the same arrays when nothing changes and unhides again", () => {
    expect(applyAreaVisibility(nodes, edges, new Set())).toEqual({ nodes, edges });
    expect(applyAreaVisibility(nodes, edges, new Set()).nodes).toBe(nodes);
    const hiddenOut = applyAreaVisibility(nodes, edges, new Set(["y.b1"]));
    const back = applyAreaVisibility(hiddenOut.nodes, hiddenOut.edges, new Set());
    expect(back.nodes.some((n) => n.hidden)).toBe(false);
    expect(back.edges.some((e) => e.hidden)).toBe(false);
  });
});

describe("deselectHiddenEdges", () => {
  it("unpins only edges that touch a hidden table", () => {
    const edges = [edge("e1", "x.a2", "x.a1", true), edge("e2", "y.b1", "x.a1", true)];
    const out = deselectHiddenEdges(edges, new Set(["y.b1"]));
    expect(out.map((e) => e.selected)).toEqual([true, false]);
    expect(out[0]).toBe(edges[0]);
    expect(deselectHiddenEdges(edges, new Set())).toBe(edges);
  });
});
