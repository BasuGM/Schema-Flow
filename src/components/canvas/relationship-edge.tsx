"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";
import type { Relationship, Schema } from "@/domain/schema/types";
import { labelAnchor, routeSegments, samePosition, segmentsToPath } from "@/graph/edge-path";
import type { RelationshipFlowEdge } from "@/graph/types";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

const MARKER_OFFSET = 10;
/** Above nodes (React Flow nodes use z-index 0, or 1000 when elevated). */
const LABEL_Z_INDEX = 1001;

function RelationshipEdgeComponent(props: EdgeProps<RelationshipFlowEdge>) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;
  const schema = useSchemaStore((s) => s.schema);
  const rel = data ? schema?.relationships[data.relationshipId] : undefined;
  const connectedToSelection = useUiStore(
    (s) =>
      s.selectedTableId !== null && (s.selectedTableId === source || s.selectedTableId === target),
  );
  const emphasized = Boolean(selected) || connectedToSelection;
  // Subscribing to the end nodes re-renders this edge only when one of them changes (e.g. drag).
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const route = data?.route;
  const routeValid =
    !!route &&
    samePosition(sourceNode?.internals.positionAbsolute, route.sourceAt) &&
    samePosition(targetNode?.internals.positionAbsolute, route.targetAt);

  let path: string;
  let endX = targetX;
  let endPosition = targetPosition;
  if (data?.selfReference) {
    // Loop out of the left side and back into the referenced row on the same side.
    const loop = 56;
    endX = sourceX;
    endPosition = Position.Left;
    path = `M ${sourceX} ${sourceY} C ${sourceX - loop} ${sourceY}, ${sourceX - loop} ${targetY}, ${sourceX} ${targetY}`;
  } else if (route && routeValid) {
    // Auto-layout route around intermediate tables (QA-001); dropped once either end is moved.
    path = segmentsToPath(
      routeSegments([{ x: sourceX, y: sourceY }, ...route.waypoints, { x: targetX, y: targetY }]),
    );
  } else {
    [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 10,
      offset: 24,
    });
  }

  const description = rel && schema ? describeRelationship(rel, schema) : id;
  const shortLabel = rel && schema ? shortRelationshipLabel(rel, schema) : id;
  const anchor = labelAnchor(
    { x: sourceX, y: sourceY },
    sourcePosition === Position.Right ? "right" : "left",
    data?.selfReference ? 64 : 18,
  );
  const many = rel?.cardinality !== "one-to-one";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={0}
        style={{
          stroke: emphasized ? "var(--brand)" : "var(--edge)",
          strokeWidth: emphasized ? 2 : 1.25,
        }}
      />
      <path d={path} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke">
        <title>{description}</title>
      </path>
      <CardinalityMarker
        x={sourceX}
        y={sourceY}
        position={sourcePosition}
        text={many ? "N" : "1"}
        emphasized={emphasized}
      />
      <CardinalityMarker
        x={endX}
        y={targetY}
        position={endPosition}
        text="1"
        emphasized={emphasized}
      />
      {emphasized && (
        <EdgeLabelRenderer>
          <div
            data-testid={`edge-label-${id}`}
            style={{
              transform: `translate(${anchor.x}px, ${anchor.y}px) translate(${anchor.translateX}, -50%)`,
              zIndex: LABEL_Z_INDEX,
            }}
            className="nodrag nopan pointer-events-none absolute top-0 left-0 rounded border bg-popover px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-popover-foreground shadow-sm"
          >
            {shortLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function CardinalityMarker({
  x,
  y,
  position,
  text,
  emphasized,
}: {
  x: number;
  y: number;
  position: Position;
  text: string;
  emphasized: boolean;
}) {
  const dx =
    position === Position.Left ? -MARKER_OFFSET : position === Position.Right ? MARKER_OFFSET : 0;
  const dy =
    position === Position.Top ? -MARKER_OFFSET : position === Position.Bottom ? MARKER_OFFSET : -6;
  return (
    <text
      x={x + dx}
      y={y + dy}
      textAnchor="middle"
      aria-hidden
      className={cn(
        "pointer-events-none text-[10px] font-semibold select-none",
        emphasized ? "fill-brand" : "fill-muted-foreground",
      )}
    >
      {text}
    </text>
  );
}

/** e.g. `orders_user_fk · orders.user_id → users.id` */
export function describeRelationship(rel: Relationship, schema: Schema): string {
  const col = (id: string, tableId: string) => {
    const table = schema.tables[tableId];
    const column = table?.columns.find((c) => c.id === id);
    return `${table?.name ?? tableId}.${column?.name ?? id}`;
  };
  const pairs = rel.from.columnIds.map(
    (fromId, i) =>
      `${col(fromId, rel.from.tableId)} → ${col(rel.to.columnIds[i] ?? "", rel.to.tableId)}`,
  );
  return [rel.name, pairs.join(", ")].filter(Boolean).join(" · ");
}

/** Compact on-canvas label anchored at the FK row, e.g. `user_id → users.id`. */
export function shortRelationshipLabel(rel: Relationship, schema: Schema): string {
  const names = (tableId: string, ids: string[]) => {
    const table = schema.tables[tableId];
    return ids.map((id) => table?.columns.find((c) => c.id === id)?.name ?? id).join(", ");
  };
  const target = schema.tables[rel.to.tableId]?.name ?? rel.to.tableId;
  return `${names(rel.from.tableId, rel.from.columnIds)} → ${target}.${names(rel.to.tableId, rel.to.columnIds)}`;
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
