import type { DiagramLayout, Schema, Table } from "@/domain/schema/types";
import { columnHandleId, headerHandleId } from "./handles";
import { visibleColumns } from "./node-metrics";
import type { RelationshipFlowEdge, TableFlowNode } from "./types";

export interface FlowElements {
  nodes: TableFlowNode[];
  edges: RelationshipFlowEdge[];
}

/**
 * Derives React Flow nodes/edges from the normalized schema and layout. Pure and deterministic.
 * Selection/highlight state is intentionally NOT included: nodes read it from the UI store so that
 * selecting a table never rebuilds this array.
 *
 * Composite foreign keys render as one edge anchored on the first column pair; the edge label
 * lists every column pair.
 */
export function schemaToFlow(
  schema: Schema,
  layout: Pick<DiagramLayout, "positions" | "collapsed" | "edgeRoutes">,
): FlowElements {
  const visible = new Map<string, Set<string>>();
  const nodes: TableFlowNode[] = schema.tableOrder.flatMap((id) => {
    const table = schema.tables[id];
    if (!table) return [];
    const mode = layout.collapsed[id] ?? "full";
    visible.set(id, new Set(visibleColumns(table, mode).map((c) => c.id)));
    return [
      {
        id,
        type: "table",
        position: layout.positions[id] ?? { x: 0, y: 0 },
        data: { tableId: id, mode },
        ariaLabel: tableAriaLabel(table),
        selectable: false,
      },
    ];
  });

  const handleFor = (tableId: string, columnId: string | undefined, kind: "source" | "target") =>
    columnId && visible.get(tableId)?.has(columnId)
      ? columnHandleId(columnId, kind)
      : headerHandleId(tableId, kind);

  const edges: RelationshipFlowEdge[] = Object.values(schema.relationships).flatMap((rel) => {
    if (!visible.has(rel.from.tableId) || !visible.has(rel.to.tableId)) return [];
    return [
      {
        id: rel.id,
        type: "relationship",
        source: rel.from.tableId,
        target: rel.to.tableId,
        sourceHandle: handleFor(rel.from.tableId, rel.from.columnIds[0], "source"),
        targetHandle: handleFor(rel.to.tableId, rel.to.columnIds[0], "target"),
        data: {
          relationshipId: rel.id,
          selfReference: rel.from.tableId === rel.to.tableId,
          ...(layout.edgeRoutes?.[rel.id] ? { route: layout.edgeRoutes[rel.id] } : {}),
        },
        ariaLabel: `Relationship from ${rel.from.tableId} to ${rel.to.tableId}`,
      },
    ];
  });

  return { nodes, edges };
}

function tableAriaLabel(table: Table): string {
  return `Table ${table.name}, ${table.columns.length} column${table.columns.length === 1 ? "" : "s"}`;
}
