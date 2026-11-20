import { displayTableName } from "@/domain/schema/selectors";
import type { Column, Position, Schema, Table } from "@/domain/schema/types";
import {
  NODE_HEADER_HEIGHT,
  NODE_PADDING_Y,
  NODE_ROW_HEIGHT,
  NODE_WIDTH,
  estimateNodeHeight,
  visibleColumns,
} from "@/graph/node-metrics";
import type { ExportLayout } from "./diagram-bounds";
import { diagramGeometry } from "./diagram-geometry";
import {
  MONO_STACK,
  SANS_STACK,
  approxMeasure,
  type ExportPalette,
  type MeasureText,
  type TextFont,
} from "./export-palette";
import { xmlText } from "./xml";

export interface DiagramSvgInput {
  schema: Schema;
  layout: ExportLayout;
  palette: ExportPalette;
  /** Defaults to a character-width estimate; the browser passes a canvas measurement. */
  measure?: MeasureText;
}

export interface DiagramSvg {
  svg: string;
  width: number;
  height: number;
}

const CARD_RADIUS = 8;
const PAD_X = 12;
const GLYPH_WIDTH = 14;
const MARKER_OFFSET = 10;

const TITLE_FONT: TextFont = { family: "sans", size: 14, weight: 600 };
const COUNT_FONT: TextFont = { family: "sans", size: 11, weight: 400 };
const NAME_FONT: TextFont = { family: "sans", size: 12, weight: 400 };
const PK_NAME_FONT: TextFont = { ...NAME_FONT, weight: 600 };
const TYPE_FONT: TextFont = { family: "mono", size: 11, weight: 400 };
const NULL_FONT: TextFont = { family: "sans", size: 10, weight: 400 };
const GLYPH_FONT: TextFont = { family: "sans", size: 8, weight: 700 };

const attrs = (font: TextFont, fill: string) =>
  `font-family="${xmlText(font.family === "mono" ? MONO_STACK : SANS_STACK)}" font-size="${font.size}"` +
  (font.weight !== 400 ? ` font-weight="${font.weight}"` : "") +
  ` fill="${xmlText(fill)}"`;

const num = (n: number) => String(Math.round(n * 10) / 10);

/** `text` shortened with an ellipsis to fit `maxWidth` (binary search on the measured width). */
function fit(text: string, maxWidth: number, font: TextFont, measure: MeasureText): string {
  if (measure(text, font) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid)}…`, font) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo)}…` : "";
}

function text(
  x: number,
  y: number,
  content: string,
  font: TextFont,
  fill: string,
  anchor: "start" | "middle" | "end" = "start",
): string {
  if (content === "") return "";
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" dominant-baseline="central" ${attrs(font, fill)}>${xmlText(content)}</text>`;
}

function rowSvg(
  column: Column,
  x: number,
  y: number,
  palette: ExportPalette,
  measure: MeasureText,
): string {
  const mid = y + NODE_ROW_HEIGHT / 2;
  const out: string[] = [
    `<g data-column-id="${xmlText(column.id)}" data-key="${column.isPrimaryKey ? "pk" : column.isForeignKey ? "fk" : "none"}">`,
  ];
  if (column.isPrimaryKey) {
    out.push(
      `<rect x="${num(x)}" y="${num(y)}" width="${NODE_WIDTH}" height="${NODE_ROW_HEIGHT}" fill="${xmlText(palette.pk)}" fill-opacity="0.08"/>`,
    );
  }
  if (column.isPrimaryKey || column.isForeignKey) {
    out.push(
      text(
        x + PAD_X + GLYPH_WIDTH / 2,
        mid,
        column.isPrimaryKey ? "PK" : "FK",
        GLYPH_FONT,
        column.isPrimaryKey ? palette.pk : palette.fk,
        "middle",
      ),
    );
  }
  const right = x + NODE_WIDTH - PAD_X;
  const typeText = fit(column.dataType.raw, 110, TYPE_FONT, measure);
  const typeWidth = measure(typeText, TYPE_FONT);
  out.push(text(right, mid, typeText, TYPE_FONT, palette.mutedForeground, "end"));
  let reserved = typeWidth + 8;
  if (column.nullable) {
    const nullWidth = measure("null", NULL_FONT);
    out.push(text(right - reserved, mid, "null", NULL_FONT, palette.mutedForeground, "end"));
    reserved += nullWidth + 4;
  }
  const nameX = x + PAD_X + GLYPH_WIDTH + 8;
  const both = column.isPrimaryKey && column.isForeignKey;
  const fkWidth = both ? measure("FK", GLYPH_FONT) + 6 : 0;
  const font = column.isPrimaryKey ? PK_NAME_FONT : NAME_FONT;
  const name = fit(column.name, right - reserved - 8 - nameX - fkWidth, font, measure);
  out.push(text(nameX, mid, name, font, palette.cardForeground));
  if (both && name !== "") {
    out.push(text(nameX + measure(name, font) + 6, mid, "FK", GLYPH_FONT, palette.fk));
  }
  out.push("</g>");
  return out.join("");
}

function tableSvg(
  table: Table,
  title: string,
  mode: "full" | "keys" | "header",
  at: Position,
  palette: ExportPalette,
  measure: MeasureText,
): string {
  const rows = visibleColumns(table, mode);
  const height = estimateNodeHeight(rows.length);
  const { x, y } = at;
  const total = table.columns.length;
  const count = mode === "full" ? String(total) : `${rows.length} / ${total}`;
  const countWidth = measure(count, COUNT_FONT);
  const out: string[] = [
    `<g data-table-id="${xmlText(table.id)}" data-mode="${mode}">`,
    `<rect x="${num(x)}" y="${num(y)}" width="${NODE_WIDTH}" height="${height}" rx="${CARD_RADIUS}" fill="${xmlText(palette.card)}" stroke="${xmlText(palette.border)}"/>`,
  ];
  const band = xmlText(palette.muted);
  if (rows.length === 0) {
    out.push(
      `<rect x="${num(x)}" y="${num(y)}" width="${NODE_WIDTH}" height="${NODE_HEADER_HEIGHT}" rx="${CARD_RADIUS}" fill="${band}" fill-opacity="0.6"/>`,
    );
  } else {
    const r = CARD_RADIUS;
    out.push(
      `<path d="M ${num(x)} ${num(y + r)} a ${r} ${r} 0 0 1 ${r} ${-r} h ${NODE_WIDTH - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} V ${num(y + NODE_HEADER_HEIGHT)} H ${num(x)} Z" fill="${band}" fill-opacity="0.6"/>`,
      `<line x1="${num(x)}" y1="${num(y + NODE_HEADER_HEIGHT)}" x2="${num(x + NODE_WIDTH)}" y2="${num(y + NODE_HEADER_HEIGHT)}" stroke="${xmlText(palette.border)}"/>`,
    );
  }
  const headerMid = y + NODE_HEADER_HEIGHT / 2;
  out.push(
    text(
      x + PAD_X,
      headerMid,
      fit(title, NODE_WIDTH - 2 * PAD_X - countWidth - 8, TITLE_FONT, measure),
      TITLE_FONT,
      palette.cardForeground,
    ),
    text(x + NODE_WIDTH - PAD_X, headerMid, count, COUNT_FONT, palette.mutedForeground, "end"),
  );
  rows.forEach((column, i) => {
    out.push(
      rowSvg(
        column,
        x,
        y + NODE_HEADER_HEIGHT + NODE_PADDING_Y + i * NODE_ROW_HEIGHT,
        palette,
        measure,
      ),
    );
  });
  out.push("</g>");
  return out.join("");
}

/**
 * The whole diagram as a standalone SVG (P3-T03, ADR-027): every table at its position and collapse
 * mode, every relationship. Pure: no DOM, so it also works for schemas the canvas virtualizes.
 * Edge ends follow `schemaToFlow`: the first column of each side when visible, else the header.
 */
export function renderDiagramSvg({
  schema,
  layout,
  palette,
  measure = approxMeasure,
}: DiagramSvgInput): DiagramSvg {
  const geometry = diagramGeometry(schema, layout);
  const { positions, minX, minY, width, height } = geometry.bounds;
  const modeOf = (id: string) => layout.collapsed[id] ?? "full";

  const edges: string[] = [];
  for (const edge of geometry.edges) {
    const { sourceX, sourceY, targetX, targetY, selfReference, d } = edge;
    const many = edge.many;
    const targetMarkerX = selfReference ? sourceX - MARKER_OFFSET : targetX + MARKER_OFFSET;
    edges.push(
      `<g data-relationship-id="${xmlText(edge.id)}">`,
      `<path d="${d}" fill="none" stroke="${xmlText(palette.edge)}" stroke-width="1.25"/>`,
      text(
        sourceX - MARKER_OFFSET,
        sourceY - 6,
        many ? "N" : "1",
        { family: "sans", size: 10, weight: 600 },
        palette.mutedForeground,
        "middle",
      ),
      text(
        targetMarkerX,
        targetY - 6,
        "1",
        { family: "sans", size: 10, weight: 600 },
        palette.mutedForeground,
        "middle",
      ),
      "</g>",
    );
  }

  const tables = schema.tableOrder.flatMap((id) => {
    const table = schema.tables[id];
    const at = positions[id];
    return table && at
      ? [tableSvg(table, displayTableName(schema, table), modeOf(id), at, palette, measure)]
      : [];
  });

  const label = xmlText(`${schema.name} database diagram`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${num(minX)} ${num(minY)} ${width} ${height}" role="img" aria-label="${label}">` +
    `<title>${label}</title>` +
    `<rect x="${num(minX)}" y="${num(minY)}" width="${width}" height="${height}" fill="${xmlText(palette.canvas)}"/>` +
    edges.join("") +
    tables.join("") +
    "</svg>";
  return { svg, width, height };
}
