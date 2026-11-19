import type { DiagramLayout, Position, Schema, TableId } from "@/domain/schema/types";
import { NODE_WIDTH, estimateNodeHeight, visibleColumns } from "@/graph/node-metrics";

export type ExportLayout = Pick<DiagramLayout, "positions" | "collapsed" | "edgeRoutes">;

/** Empty margin around the tables; wide enough for self-reference loops (56 px out of the left side). */
export const EXPORT_PADDING = 56;
const FALLBACK_GAP = 40;
const FALLBACK_COLUMNS = 5;

export interface DiagramBounds {
  /** Top-left of the image in diagram coordinates. */
  minX: number;
  minY: number;
  /** Whole pixels: the one size every consumer (SVG, dialog, PNG) derives from. */
  width: number;
  height: number;
  /** Where every table is drawn; tables without a usable stored position are placed below the rest. */
  positions: Record<TableId, Position>;
}

const usable = (p: Position | undefined): p is Position =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * Size and table positions of the exported diagram. Pure and deterministic. Tables with no
 * (or a non-finite) position are laid out in rows of five below the placed tables, so the export
 * never contains NaN. An empty schema gives a padding-only image.
 */
export function computeDiagramBounds(schema: Schema, layout: ExportLayout): DiagramBounds {
  const heightOf = (id: TableId) => {
    const table = schema.tables[id];
    const mode = layout.collapsed[id] ?? "full";
    return estimateNodeHeight(table ? visibleColumns(table, mode).length : 0);
  };
  const positions: Record<TableId, Position> = {};
  const missing: TableId[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const extend = (id: TableId, p: Position) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_WIDTH);
    maxY = Math.max(maxY, p.y + heightOf(id));
  };
  for (const id of schema.tableOrder) {
    if (!schema.tables[id]) continue;
    const p = layout.positions[id];
    if (usable(p)) {
      positions[id] = p;
      extend(id, p);
    } else missing.push(id);
  }
  if (missing.length > 0) {
    const originX = Number.isFinite(minX) ? minX : 0;
    let y = Number.isFinite(maxY) ? maxY + FALLBACK_GAP : 0;
    for (let i = 0; i < missing.length; i += FALLBACK_COLUMNS) {
      const row = missing.slice(i, i + FALLBACK_COLUMNS);
      row.forEach((id, col) => {
        const p = { x: originX + col * (NODE_WIDTH + FALLBACK_GAP), y };
        positions[id] = p;
        extend(id, p);
      });
      y += Math.max(...row.map(heightOf)) + FALLBACK_GAP;
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  return {
    minX: minX - EXPORT_PADDING,
    minY: minY - EXPORT_PADDING,
    width: Math.round(maxX - minX + 2 * EXPORT_PADDING),
    height: Math.round(maxY - minY + 2 * EXPORT_PADDING),
    positions,
  };
}
