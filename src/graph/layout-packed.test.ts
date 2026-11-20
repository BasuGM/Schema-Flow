import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Position, Schema } from "@/domain/schema/types";
import { parseSchemaText } from "@/parsers/parse-schema-text";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { generateSyntheticSchema } from "@/samples/synthetic";
import { layoutWithDagre } from "./layout-dagre";
import { layoutPacked } from "./layout-packed";
import { NODE_WIDTH, estimateNodeHeight, visibleColumns } from "./node-metrics";

/** One hub referenced by `children` tables, plus `loose` tables with no relationships. */
function hubSchema(children: number, loose: number): Schema {
  const base = createEcommerceSchema();
  const template = base.tables[base.tableOrder[0]!]!;
  const schema: Schema = { ...base, tables: {}, tableOrder: [], relationships: {} };
  const add = (id: string) => {
    schema.tables[id] = {
      ...template,
      id,
      name: id,
      columns: template.columns.map((c) => ({ ...c, id: `${id}.${c.name}` })),
    };
    schema.tableOrder.push(id);
  };
  add("hub");
  const hubCol = schema.tables["hub"]!.columns[0]!;
  for (let i = 0; i < children; i++) {
    const id = `child${i}`;
    add(id);
    const col = schema.tables[id]!.columns[1]!;
    schema.relationships[`r${i}`] = {
      id: `r${i}`,
      from: { tableId: id, columnIds: [col.id] },
      to: { tableId: "hub", columnIds: [hubCol.id] },
      cardinality: "many-to-one",
    } as Schema["relationships"][string];
  }
  for (let i = 0; i < loose; i++) add(`loose${i}`);
  return schema;
}

function bounds(s: Schema, positions: Record<string, Position>) {
  let maxX = 0;
  let maxY = 0;
  for (const id of s.tableOrder) {
    const p = positions[id]!;
    maxX = Math.max(maxX, p.x + NODE_WIDTH);
    maxY = Math.max(maxY, p.y + estimateNodeHeight(visibleColumns(s.tables[id]!, "full").length));
  }
  return { width: maxX, height: maxY };
}

function overlaps(s: Schema, positions: Record<string, Position>): number {
  const ids = s.tableOrder;
  let count = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = positions[ids[i]!]!;
      const b = positions[ids[j]!]!;
      const ha = estimateNodeHeight(visibleColumns(s.tables[ids[i]!]!, "full").length);
      const hb = estimateNodeHeight(visibleColumns(s.tables[ids[j]!]!, "full").length);
      if (a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH && a.y < b.y + hb && b.y < a.y + ha) {
        count++;
      }
    }
  }
  return count;
}

describe("layoutPacked", () => {
  it("leaves the 12-table sample identical to Dagre", () => {
    const s = createEcommerceSchema();
    expect(layoutPacked(s)).toEqual(layoutWithDagre(s));
  });

  it("leaves a normally shaped large schema identical to Dagre", () => {
    const s = generateSyntheticSchema({ tables: 120, seed: 2 });
    expect(layoutPacked(s)).toEqual(layoutWithDagre(s));
  });

  it("packs a tall hub schema into a sane shape without overlaps", () => {
    const s = hubSchema(250, 130);
    const dagre = bounds(s, layoutWithDagre(s).positions);
    expect(dagre.height / dagre.width).toBeGreaterThan(4);

    const { positions } = layoutPacked(s);
    expect(Object.keys(positions)).toHaveLength(s.tableOrder.length);
    const b = bounds(s, positions);
    const aspect = Math.max(b.width, b.height) / Math.min(b.width, b.height);
    expect(aspect).toBeLessThan(3);
    expect(overlaps(s, positions)).toBe(0);
  });

  it("is deterministic, also on a re-parsed schema", () => {
    const s = hubSchema(250, 130);
    expect(layoutPacked(s)).toEqual(layoutPacked(s));
    expect(layoutPacked(hubSchema(250, 130))).toEqual(layoutPacked(s));
  });

  it("wraps a tall rank into several columns", () => {
    const s = hubSchema(250, 0);
    const before = bounds(s, layoutWithDagre(s).positions);
    const after = bounds(s, layoutPacked(s).positions);
    expect(after.height).toBeLessThan(before.height / 3);
    expect(after.width).toBeGreaterThan(before.width * 3);
  });

  it("keeps a route only when it still starts and ends at its tables", () => {
    for (const s of [hubSchema(250, 130), generateSyntheticSchema({ tables: 400, seed: 5 })]) {
      const { positions, edgeRoutes } = layoutPacked(s);
      for (const [id, route] of Object.entries(edgeRoutes)) {
        const rel = s.relationships[id]!;
        expect(route.sourceAt).toEqual(positions[rel.from.tableId]);
        expect(route.targetAt).toEqual(positions[rel.to.tableId]);
      }
    }
  });

  it("packs in TB without overlaps", () => {
    const s = hubSchema(250, 130);
    const { positions } = layoutPacked(s, { direction: "TB" });
    expect(Object.keys(positions)).toHaveLength(s.tableOrder.length);
    expect(overlaps(s, positions)).toBe(0);
  });

  it("packs GitLab to a sane shape", () => {
    const text = readFileSync(
      new URL("../../tests/fixtures/real/gitlab-structure.postgres.sql", import.meta.url),
      "utf8",
    );
    const schema = parseSchemaText(text).result.schema!;
    const { positions } = layoutPacked(schema);
    const b = bounds(schema, positions);
    expect(Math.max(b.width, b.height) / Math.min(b.width, b.height)).toBeLessThan(3);
  }, 30_000);
});
