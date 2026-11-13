"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";
import type { Relationship, Schema } from "@/domain/schema/types";
import type { RelationshipFlowEdge } from "@/graph/types";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

const MARKER_OFFSET = 10;

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

  let path: string;
  let labelX: number;
  let labelY: number;
  let endX = targetX;
  let endPosition = targetPosition;
  if (data?.selfReference) {
    // Loop out of the left side and back into the referenced row on the same side.
    const loop = 56;
    endX = sourceX;
    endPosition = Position.Left;
    path = `M ${sourceX} ${sourceY} C ${sourceX - loop} ${sourceY}, ${sourceX - loop} ${targetY}, ${sourceX} ${targetY}`;
    labelX = sourceX - loop * 0.75;
    labelY = (sourceY + targetY) / 2;
  } else {
    [path, labelX, labelY] = getSmoothStepPath({
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
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="nodrag nopan pointer-events-none absolute rounded border bg-popover px-1.5 py-0.5 font-mono text-[10px] text-popover-foreground shadow-sm"
          >
            {description}
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

export const RelationshipEdge = memo(RelationshipEdgeComponent);
