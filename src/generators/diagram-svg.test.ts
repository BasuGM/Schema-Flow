// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import type { CollapseMode, Schema } from "@/domain/schema/types";
import { NODE_HEADER_HEIGHT, NODE_ROW_HEIGHT } from "@/graph/node-metrics";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { computeDiagramBounds, EXPORT_PADDING } from "./diagram-bounds";
import { renderDiagramSvg } from "./diagram-svg";
import { DEFAULT_DARK_PALETTE, DEFAULT_LIGHT_PALETTE } from "./export-palette";

const schema = createEcommerceSchema();
const positions = Object.fromEntries(
  schema.tableOrder.map((id, i) => [id, { x: (i % 4) * 400, y: Math.floor(i / 4) * 500 }]),
);
const layout = { positions, collapsed: {} };
const render = (s: Schema = schema, l = layout, palette = DEFAULT_LIGHT_PALETTE) =>
  renderDiagramSvg({ schema: s, layout: l, palette });
const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");

describe("renderDiagramSvg", () => {
  it("draws every table and relationship as well-formed XML", () => {
    const { svg } = render();
    const doc = parse(svg);
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelectorAll("[data-table-id]")).toHaveLength(schema.tableOrder.length);
    expect(doc.querySelectorAll("[data-relationship-id]")).toHaveLength(
      Object.keys(schema.relationships).length,
    );
  });

  it("is deterministic", () => {
    expect(render().svg).toBe(render().svg);
  });

  it("ignores layout fields that are not positions, collapse modes or routes", () => {
    const extra = { ...layout, viewport: { x: 5, y: 5, zoom: 0.1 }, version: 9, fingerprint: "x" };
    expect(render(schema, extra).svg).toBe(render().svg);
  });

  it("sizes the image from computeDiagramBounds and pads the content", () => {
    const bounds = computeDiagramBounds(schema, layout);
    const { svg, width, height } = render();
    expect({ width, height }).toEqual({ width: bounds.width, height: bounds.height });
    const root = parse(svg).documentElement;
    expect(root.getAttribute("width")).toBe(String(width));
    expect(root.getAttribute("viewBox")).toBe(
      `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`,
    );
    expect(bounds.minX).toBe(-EXPORT_PADDING);
  });

  it("honours collapse modes: keys keeps PK/FK rows, header none", () => {
    const modes: Record<string, CollapseMode> = {
      "public.orders": "keys",
      "public.users": "header",
    };
    const doc = parse(render(schema, { positions, collapsed: modes }).svg);
    const rows = (id: string) =>
      [...doc.querySelectorAll(`[data-table-id="${id}"] [data-column-id]`)].map((e) =>
        e.getAttribute("data-key"),
      );
    expect(rows("public.users")).toEqual([]);
    expect(rows("public.orders").length).toBeGreaterThan(0);
    expect(rows("public.orders").every((k) => k !== "none")).toBe(true);
    expect(rows("public.products").includes("none")).toBe(true);
    expect(doc.querySelector('[data-table-id="public.users"]')?.getAttribute("data-mode")).toBe(
      "header",
    );
  });

  it("attaches an edge to the header when its column is hidden", () => {
    const rel = Object.values(schema.relationships).find(
      (r) => r.from.tableId === "public.orders" && r.to.tableId === "public.users",
    )!;
    const pathOf = (collapsed: Record<string, CollapseMode>) =>
      parse(render(schema, { positions, collapsed }).svg)
        .querySelector(`[data-relationship-id="${rel.id}"] path`)!
        .getAttribute("d")!;
    const start = (d: string) => Number(d.split(" ")[2]);
    const at = positions["public.orders"]!;
    const header = at.y + NODE_HEADER_HEIGHT / 2;
    expect(start(pathOf({ "public.orders": "header" }))).toBe(header);
    expect(start(pathOf({}))).toBeGreaterThan(at.y + NODE_HEADER_HEIGHT);
    expect((start(pathOf({})) - at.y - NODE_HEADER_HEIGHT - 6) % NODE_ROW_HEIGHT).toBe(
      NODE_ROW_HEIGHT / 2,
    );
  });

  it("uses a stored route only while both ends are where it was computed", () => {
    const rel = Object.values(schema.relationships).find((r) => r.from.tableId !== r.to.tableId)!;
    const from = positions[rel.from.tableId]!;
    const to = positions[rel.to.tableId]!;
    const route = { waypoints: [{ x: 123, y: 456 }], sourceAt: from, targetAt: to };
    const d = (l: typeof layout & { edgeRoutes?: Record<string, typeof route> }) =>
      parse(render(schema, l).svg)
        .querySelector(`[data-relationship-id="${rel.id}"] path`)!
        .getAttribute("d")!;
    expect(d({ ...layout, edgeRoutes: { [rel.id]: route } })).toContain("123 456");
    const stale = { ...route, sourceAt: { x: from.x + 50, y: from.y } };
    expect(d({ ...layout, edgeRoutes: { [rel.id]: stale } })).not.toContain("123 456");
  });

  it("loops a self-reference out of the left side", () => {
    const self = Object.values(schema.relationships).find((r) => r.from.tableId === r.to.tableId)!;
    const d = parse(render().svg)
      .querySelector(`[data-relationship-id="${self.id}"] path`)!
      .getAttribute("d")!;
    const x = positions[self.from.tableId]!.x;
    expect(d).toContain(`M ${x} `);
    expect(d).toContain(`${x - 56} `);
  });

  it("escapes markup and strips characters XML forbids, in names, title and label", () => {
    const nasty = normalizeSchema(
      draft(
        [
          {
            name: 'a<b&"c\u0001\ud800',
            columns: [{ name: "x'y\u0008", type: "int", primaryKey: true }],
          },
        ],
        { name: "My <shop> \u0001" },
      ),
    );
    const l = { positions: { [nasty.tableOrder[0]!]: { x: 0, y: 0 } }, collapsed: {} };
    const { svg } = render(nasty, l);
    const doc = parse(svg);
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(doc.querySelector("title")?.textContent).toBe("My <shop>  database diagram");
    expect(doc.querySelector("text")?.textContent).toBe('a<b&"c');
  });

  it("truncates long names and types with an ellipsis", () => {
    const long = normalizeSchema(
      draft([
        {
          name: "t".repeat(200),
          columns: [{ name: "c".repeat(200), type: "numeric(10, 2)".repeat(10) }],
        },
      ]),
    );
    const l = { positions: { [long.tableOrder[0]!]: { x: 0, y: 0 } }, collapsed: {} };
    const texts = [...parse(render(long, l).svg).querySelectorAll("text")].map(
      (t) => t.textContent!,
    );
    expect(texts.filter((t) => t.endsWith("…")).length).toBeGreaterThanOrEqual(3);
    expect(texts.every((t) => t.length < 100)).toBe(true);
  });

  it("themes: light and dark differ in background, card and text colours", () => {
    const light = render(schema, layout, DEFAULT_LIGHT_PALETTE).svg;
    const dark = render(schema, layout, DEFAULT_DARK_PALETTE).svg;
    for (const key of ["canvas", "card", "cardForeground"] as const) {
      expect(light).toContain(DEFAULT_LIGHT_PALETTE[key]);
      expect(dark).toContain(DEFAULT_DARK_PALETTE[key]);
      expect(DEFAULT_LIGHT_PALETTE[key]).not.toBe(DEFAULT_DARK_PALETTE[key]);
    }
  });

  it("returns a valid empty image for a schema with no tables", () => {
    const empty = normalizeSchema(draft([]));
    const { svg, width, height } = render(empty, { positions: {}, collapsed: {} });
    expect(parse(svg).querySelector("parsererror")).toBeNull();
    expect(width).toBe(2 * EXPORT_PADDING);
    expect(height).toBe(2 * EXPORT_PADDING);
    expect(svg).not.toContain("NaN");
  });
});

describe("computeDiagramBounds", () => {
  it("places tables without a usable position below the others, never NaN", () => {
    const [first, ...rest] = schema.tableOrder;
    const partial = {
      positions: { [first!]: { x: 10, y: 20 }, [rest[0]!]: { x: Number.NaN, y: 0 } },
      collapsed: {},
    };
    const bounds = computeDiagramBounds(schema, partial);
    expect(Object.keys(bounds.positions)).toHaveLength(schema.tableOrder.length);
    for (const p of Object.values(bounds.positions)) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    expect(bounds.positions[rest[0]!]!.y).toBeGreaterThan(20);
    expect(Number.isFinite(bounds.width) && Number.isFinite(bounds.height)).toBe(true);
    expect(computeDiagramBounds(schema, partial)).toEqual(bounds);
    expect(render(schema, partial).svg).not.toContain("NaN");
  });

  it("shrinks when tables collapse", () => {
    const full = computeDiagramBounds(schema, {
      positions: { "public.users": { x: 0, y: 0 } },
      collapsed: {},
    });
    const header = computeDiagramBounds(schema, {
      positions: { "public.users": { x: 0, y: 0 } },
      collapsed: { "public.users": "header" },
    });
    expect(header.height).toBeLessThan(full.height);
  });
});
