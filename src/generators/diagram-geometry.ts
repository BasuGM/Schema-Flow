import type {
  CollapseMode,
  Position,
  RelationshipId,
  Schema,
  Table,
  TableId,
} from "@/domain/schema/types";
import { edgePath, samePosition } from "@/graph/edge-path";
import {
  NODE_HEADER_HEIGHT,
  NODE_WIDTH,
  estimateNodeHeight,
  rowCenterOffset,
  visibleColumns,
} from "@/graph/node-metrics";
import { computeDiagramBounds, type DiagramBounds, type ExportLayout } from "./diagram-bounds";

export interface TableRect {
  id: TableId;
  x: number;
  y: number;
  w: number;
  h: number;
  mode: CollapseMode;
}

export interface EdgeGeometry {
  id: RelationshipId;
  selfReference: boolean;
  from: TableId;
  to: TableId;
  /** Where the edge leaves the source table and enters the target table. */
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** SVG path data, shared by the export and the canvas overview. */
  d: string;
  many: boolean;
}

export interface DiagramGeometry {
  bounds: DiagramBounds;
  /** In declaration order. */
  tables: TableRect[];
  edges: EdgeGeometry[];
}

/**
 * Where every table and relationship of the diagram is, in diagram coordinates. The single source
 * for the SVG export and the canvas overview, so both agree with the DOM canvas: heights follow the
 * per-table collapse state. Pure and deterministic.
 */
export function diagramGeometry(schema: Schema, layout: ExportLayout): DiagramGeometry {
  const bounds = computeDiagramBounds(schema, layout);
  const { positions } = bounds;
  const modeOf = (id: TableId): CollapseMode => layout.collapsed[id] ?? "full";

  const tables: TableRect[] = [];
  for (const id of schema.tableOrder) {
    const table = schema.tables[id];
    const at = positions[id];
    if (!table || !at) continue;
    tables.push({
      id,
      x: at.x,
      y: at.y,
      w: NODE_WIDTH,
      h: estimateNodeHeight(visibleColumns(table, modeOf(id)).length),
      mode: modeOf(id),
    });
  }

  const edges: EdgeGeometry[] = [];
  for (const rel of Object.values(schema.relationships)) {
    const fromTable = schema.tables[rel.from.tableId];
    const toTable = schema.tables[rel.to.tableId];
    const fromAt: Position | undefined = positions[rel.from.tableId];
    const toAt: Position | undefined = positions[rel.to.tableId];
    if (!fromTable || !toTable || !fromAt || !toAt) continue;
    const offset = (table: Table, columnId: string | undefined) =>
      (columnId ? rowCenterOffset(visibleColumns(table, modeOf(table.id)), columnId) : null) ??
      NODE_HEADER_HEIGHT / 2;
    const selfReference = rel.from.tableId === rel.to.tableId;
    const sourceX = fromAt.x;
    const sourceY = fromAt.y + offset(fromTable, rel.from.columnIds[0]);
    const targetX = selfReference ? sourceX : toAt.x + NODE_WIDTH;
    const targetY = toAt.y + offset(toTable, rel.to.columnIds[0]);
    const stored = layout.edgeRoutes?.[rel.id];
    const route =
      stored && samePosition(fromAt, stored.sourceAt) && samePosition(toAt, stored.targetAt)
        ? stored
        : null;
    edges.push({
      id: rel.id,
      selfReference,
      from: rel.from.tableId,
      to: rel.to.tableId,
      sourceX,
      sourceY,
      targetX,
      targetY,
      d: edgePath(selfReference, sourceX, sourceY, targetX, targetY, route),
      many: rel.cardinality !== "one-to-one",
    });
  }
  return { bounds, tables, edges };
}

/** The table under a point in diagram coordinates (topmost = last declared wins), or null. */
export function hitTable(tables: readonly TableRect[], point: Position): TableId | null {
  for (let i = tables.length - 1; i >= 0; i--) {
    const t = tables[i]!;
    if (point.x >= t.x && point.x <= t.x + t.w && point.y >= t.y && point.y <= t.y + t.h) {
      return t.id;
    }
  }
  return null;
}

/** The box around the tables only (no export padding), as React Flow's fit-to-view sees it. */
export function tablesBox(tables: readonly TableRect[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (tables.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tables) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.w);
    maxY = Math.max(maxY, t.y + t.h);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
