import type { Edge, Node } from "@xyflow/react";
import type { CollapseMode, RelationshipId, TableId } from "@/domain/schema/types";

/** Minimal node data: components look the table up by id from the schema store. */
export type TableNodeData = { tableId: TableId; mode: CollapseMode };
export type TableFlowNode = Node<TableNodeData, "table">;

export type RelationshipEdgeData = { relationshipId: RelationshipId; selfReference: boolean };
export type RelationshipFlowEdge = Edge<RelationshipEdgeData, "relationship">;
