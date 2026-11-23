import type { Schema, TableId } from "@/domain/schema/types";
import { getSubjectAreas } from "@/analysis/subject-areas";
import type { RelationshipFlowEdge, TableFlowNode } from "@/graph/types";

/** The tables in hidden subject areas (P4-T03); empty when nothing is hidden or no areas exist. */
export function hiddenTableIds(
  schema: Schema | null,
  hiddenAreas: ReadonlySet<string>,
): ReadonlySet<TableId> {
  const areas = schema && hiddenAreas.size > 0 ? getSubjectAreas(schema) : null;
  const ids = new Set<TableId>();
  if (areas)
    for (const a of areas.areas) if (hiddenAreas.has(a.id)) for (const t of a.tableIds) ids.add(t);
  return ids;
}

/**
 * Sets `hidden` on nodes in hidden areas and on every edge touching one. Unchanged elements keep
 * their object identity (memoed nodes, drag and selection state stay untouched), and the same
 * array comes back when nothing changed.
 */
export function applyAreaVisibility(
  nodes: TableFlowNode[],
  edges: RelationshipFlowEdge[],
  hidden: ReadonlySet<TableId>,
): { nodes: TableFlowNode[]; edges: RelationshipFlowEdge[] } {
  let nodesChanged = false;
  const outNodes = nodes.map((n) => {
    const want = hidden.has(n.id);
    if (!!n.hidden === want) return n;
    nodesChanged = true;
    return { ...n, hidden: want };
  });
  let edgesChanged = false;
  const outEdges = edges.map((e) => {
    const want = hidden.has(e.source) || hidden.has(e.target);
    if (!!e.hidden === want) return e;
    edgesChanged = true;
    return { ...e, hidden: want };
  });
  return {
    nodes: nodesChanged ? outNodes : nodes,
    edges: edgesChanged ? outEdges : edges,
  };
}

/** Unpins a clicked edge whose end just became hidden; unchanged edges keep identity. */
export function deselectHiddenEdges(
  edges: RelationshipFlowEdge[],
  hidden: ReadonlySet<TableId>,
): RelationshipFlowEdge[] {
  const stale = (e: RelationshipFlowEdge) =>
    e.selected && (hidden.has(e.source) || hidden.has(e.target));
  return edges.some(stale) ? edges.map((e) => (stale(e) ? { ...e, selected: false } : e)) : edges;
}
