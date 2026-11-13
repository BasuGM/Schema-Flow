import { Graph, layout } from "@dagrejs/dagre";
import type {
  CollapseMode,
  EdgeRoute,
  LayoutDirection,
  Position,
  RelationshipId,
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

export interface DagreLayoutResult {
  positions: Record<TableId, Position>;
  /** Routes for edges that span more than one rank (LR only); other edges use smoothstep. */
  edgeRoutes: Record<RelationshipId, EdgeRoute>;
}

type NodeLabel = { width: number; height: number; x?: number; y?: number };
type EdgeLabel = { points?: { x: number; y: number }[] };

/**
 * Computes top-left positions for every table with Dagre. Pure: same schema + options → same output.
 * Edges run parent → child so referenced tables sit before (left of / above) the tables that
 * reference them. Self-references are ignored for ranking. Each relationship is its own edge
 * (multigraph) so long edges get their own obstacle-avoiding route.
 */
export function layoutWithDagre(
  schema: Schema,
  options: DagreLayoutOptions = {},
): DagreLayoutResult {
  const { direction = "LR", collapsed = {}, nodeSep = 48, rankSep = 120 } = options;
  const g = new Graph<Record<string, unknown>, NodeLabel, EdgeLabel>({ multigraph: true });
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep, marginx: 24, marginy: 24 });

  for (const id of schema.tableOrder) {
    const table = schema.tables[id];
    if (!table) continue;
    const rows = visibleColumns(table, collapsed[id] ?? "full").length;
    g.setNode(id, { width: NODE_WIDTH, height: estimateNodeHeight(rows) });
  }
  const routed: { id: RelationshipId; from: TableId; to: TableId }[] = [];
  for (const rel of Object.values(schema.relationships)) {
    const { tableId: from } = rel.from;
    const { tableId: to } = rel.to;
    if (from === to || !g.hasNode(from) || !g.hasNode(to)) continue;
    g.setEdge(to, from, {}, rel.id);
    routed.push({ id: rel.id, from, to });
  }

  layout(g);

  const positions: Record<TableId, Position> = {};
  for (const id of schema.tableOrder) {
    const n = g.node(id);
    if (!n || n.x === undefined || n.y === undefined) continue;
    positions[id] = { x: Math.round(n.x - n.width / 2), y: Math.round(n.y - n.height / 2) };
  }

  const edgeRoutes: Record<RelationshipId, EdgeRoute> = {};
  if (direction === "LR") {
    for (const { id, from, to } of routed) {
      const points = g.edge(to, from, id)?.points ?? [];
      // Dagre splits every rank gap in two, so an adjacent-rank edge has one interior point.
      // Only longer edges (≥ 2 interior points) can pass through a rank and need routing.
      const interior = points.slice(1, -1);
      const sourceAt = positions[from];
      const targetAt = positions[to];
      if (interior.length < 2 || !sourceAt || !targetAt) continue;
      edgeRoutes[id] = {
        waypoints: interior.reverse().map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        sourceAt,
        targetAt,
      };
    }
  }
  return { positions, edgeRoutes };
}
