import { Graph, layout } from "@dagrejs/dagre";
import type {
  CollapseMode,
  LayoutDirection,
  Position,
  Schema,
  TableId,
} from "@/domain/schema/types";
import { NODE_WIDTH, estimateNodeHeight, visibleColumns } from "./node-metrics";

export interface DagreLayoutOptions {
  direction?: LayoutDirection;
  collapsed?: Record<TableId, CollapseMode>;
  nodeSep?: number;
  rankSep?: number;
}

/**
 * Computes top-left positions for every table with Dagre. Pure: same schema + options → same output.
 * Edges run parent → child so referenced tables sit before (left of / above) the tables that
 * reference them. Self-references are ignored for ranking.
 */
export function layoutWithDagre(
  schema: Schema,
  options: DagreLayoutOptions = {},
): Record<TableId, Position> {
  const { direction = "LR", collapsed = {}, nodeSep = 48, rankSep = 120 } = options;
  const g = new Graph<
    Record<string, unknown>,
    { width: number; height: number; x?: number; y?: number }
  >({
    multigraph: false,
  });
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of schema.tableOrder) {
    const table = schema.tables[id];
    if (!table) continue;
    const rows = visibleColumns(table, collapsed[id] ?? "full").length;
    g.setNode(id, { width: NODE_WIDTH, height: estimateNodeHeight(rows) });
  }
  for (const rel of Object.values(schema.relationships)) {
    if (rel.from.tableId === rel.to.tableId) continue;
    if (g.hasNode(rel.to.tableId) && g.hasNode(rel.from.tableId))
      g.setEdge(rel.to.tableId, rel.from.tableId);
  }

  layout(g);

  const positions: Record<TableId, Position> = {};
  for (const id of schema.tableOrder) {
    const n = g.node(id);
    if (!n || n.x === undefined || n.y === undefined) continue;
    positions[id] = { x: Math.round(n.x - n.width / 2), y: Math.round(n.y - n.height / 2) };
  }
  return positions;
}
