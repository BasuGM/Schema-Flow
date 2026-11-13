import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { columnHandleId, headerHandleId } from "./handles";
import { schemaToFlow } from "./schema-to-flow";

const schema = createEcommerceSchema();
const empty = { positions: {}, collapsed: {} };

describe("schemaToFlow", () => {
  it("creates one node per table in declaration order and one edge per relationship", () => {
    const { nodes, edges } = schemaToFlow(schema, empty);
    expect(nodes.map((n) => n.id)).toEqual(schema.tableOrder);
    expect(edges).toHaveLength(Object.keys(schema.relationships).length);
    expect(nodes[0]).toMatchObject({
      type: "table",
      data: { tableId: "public.users", mode: "full" },
      ariaLabel: "Table users, 7 columns",
      selectable: false,
    });
  });

  it("uses stable ids so repeated calls produce equal output", () => {
    expect(schemaToFlow(schema, empty)).toEqual(schemaToFlow(schema, empty));
  });

  it("anchors edges on the exact FK and referenced column handles", () => {
    const { edges } = schemaToFlow(schema, empty);
    const allColumnIds = new Set(
      Object.values(schema.tables).flatMap((t) => t.columns.map((c) => c.id)),
    );
    for (const edge of edges) {
      const rel = schema.relationships[edge.id]!;
      expect(edge.source).toBe(rel.from.tableId);
      expect(edge.target).toBe(rel.to.tableId);
      expect(edge.sourceHandle).toBe(columnHandleId(rel.from.columnIds[0]!, "source"));
      expect(edge.targetHandle).toBe(columnHandleId(rel.to.columnIds[0]!, "target"));
      expect(allColumnIds.has(rel.from.columnIds[0]!)).toBe(true);
    }
    const orders = edges.find((e) => e.sourceHandle === "source:public.orders.user_id");
    expect(orders?.targetHandle).toBe("target:public.users.id");
  });

  it("marks the self-referencing edge", () => {
    const self = schemaToFlow(schema, empty).edges.filter((e) => e.data?.selfReference);
    expect(self).toHaveLength(1);
    expect(self[0]).toMatchObject({ source: "public.categories", target: "public.categories" });
  });

  it("applies stored positions and falls back to the origin", () => {
    const { nodes } = schemaToFlow(schema, {
      positions: { "public.users": { x: 10, y: 20 } },
      collapsed: {},
    });
    expect(nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(nodes[1]?.position).toEqual({ x: 0, y: 0 });
  });

  it("falls back to header handles for columns hidden by collapse modes", () => {
    const { nodes, edges } = schemaToFlow(schema, {
      positions: {},
      collapsed: { "public.users": "header", "public.orders": "keys" },
    });
    expect(nodes.find((n) => n.id === "public.users")?.data.mode).toBe("header");
    const ordersToUsers = edges.find(
      (e) => e.source === "public.orders" && e.target === "public.users",
    );
    expect(ordersToUsers?.targetHandle).toBe(headerHandleId("public.users", "target"));
    expect(ordersToUsers?.sourceHandle).toBe(columnHandleId("public.orders.user_id", "source"));
  });
});
