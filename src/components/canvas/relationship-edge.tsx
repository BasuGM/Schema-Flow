"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useInternalNode,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { describeRelationship } from "@/graph/describe";
import { edgePath, labelOverflowShift, labelTransform, samePosition } from "@/graph/edge-path";
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
  // Neighbourhood highlighting (P2-T09): dimmed unless both ends are in the focus set.
  const outOfFocus = useUiStore(
    (s) => s.focusSet !== null && !(s.focusSet.has(source) && s.focusSet.has(target)),
  );
  // Overview of a large schema (ADR-023): cardinality markers and the hover target are below a
  // pixel, so only the line is drawn (~2 elements per edge instead of ~8).
  const overview = useUiStore((s) => s.canvasZoomedOut);
  // Labels appear only for the edge being hovered or clicked (QA-004): one at a time, so they never
  // pile up over neighbouring tables. Edges of the selected table are highlighted without labels.
  const [hovered, setHovered] = useState(false);
  const showLabel = hovered || Boolean(selected);
  const emphasized = showLabel || connectedToSelection;
  const state = selected ? "selected" : emphasized ? "highlighted" : "default";
  // A hovered or clicked edge is drawn at full opacity while its label shows.
  const dimmed = outOfFocus && !showLabel;
  // Subscribing to the end nodes re-renders this edge only when one of them changes (e.g. drag).
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const route = data?.route;
  const routeValid =
    !!route &&
    samePosition(sourceNode?.internals.positionAbsolute, route.sourceAt) &&
    samePosition(targetNode?.internals.positionAbsolute, route.targetAt);

  const selfReference = Boolean(data?.selfReference);
  const endX = selfReference ? sourceX : targetX;
  const endPosition = selfReference ? Position.Left : targetPosition;
  // Memoized on geometry: a state flip (select, dim, hover) re-renders the edge without
  // recomputing its route (P2-T10).
  const validRoute = route && routeValid ? route : null;
  const path = useMemo(
    () => edgePath(selfReference, sourceX, sourceY, targetX, targetY, validRoute),
    [selfReference, sourceX, sourceY, targetX, targetY, validRoute],
  );

  const many = rel?.cardinality !== "one-to-one";

  return (
    <g
      className="relationship-edge"
      data-edge-state={state}
      data-dimmed={dimmed || undefined}
      data-testid={`edge-${id}`}
    >
      {state === "selected" && (
        <path d={path} fill="none" stroke="var(--brand)" strokeOpacity={0.25} strokeWidth={8} />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={0}
        style={{
          stroke: state === "default" ? "var(--edge)" : "var(--brand)",
          strokeWidth: STROKE_WIDTH[state],
        }}
      />
      {!overview && (
        <>
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={14}
            pointerEvents="stroke"
            data-testid={`edge-hit-${id}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          />
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
        </>
      )}
      {showLabel && (
        <EdgeLabel
          id={id}
          text={rel && schema ? describeRelationship(rel, schema) : id}
          x={sourceX}
          y={sourceY}
          side={sourcePosition === Position.Right ? "right" : "left"}
          gapPx={data?.selfReference ? 52 : 12}
        />
      )}
    </g>
  );
}

const STROKE_WIDTH = { default: 1.25, highlighted: 2, selected: 3 } as const;
const zoomSelector = (s: { transform: [number, number, number] }) => s.transform[2];
const panXSelector = (s: { transform: [number, number, number] }) => s.transform[0];
const paneWidthSelector = (s: { width: number }) => s.width;

/**
 * Rendered only while a label is visible, so only this component (not every edge) re-renders on
 * zoom or pan. Counter-scaled to a constant screen size (QA-005) and shifted to stay inside the
 * visible pane (QA-006).
 */
function EdgeLabel({
  id,
  text,
  x,
  y,
  side,
  gapPx,
}: {
  id: string;
  text: string;
  x: number;
  y: number;
  side: "left" | "right";
  gapPx: number;
}) {
  const zoom = useStore(zoomSelector);
  const panX = useStore(panXSelector);
  const paneWidth = useStore(paneWidthSelector);
  const ref = useRef<HTMLDivElement>(null);
  // The shift depends on the rendered label width, so it is measured and applied before paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const shift = labelOverflowShift({
      anchorScreenX: panX + x * zoom,
      side,
      gapPx,
      widthPx: el.offsetWidth,
      paneWidth,
    });
    el.style.transform = labelTransform({ x, y }, side, zoom, gapPx, shift);
  }, [x, y, side, gapPx, zoom, panX, paneWidth, text]);
  return (
    <EdgeLabelRenderer>
      <div
        ref={ref}
        data-testid={`edge-label-${id}`}
        style={{
          transform: labelTransform({ x, y }, side, zoom, gapPx),
          transformOrigin: "0 0",
          zIndex: LABEL_Z_INDEX,
        }}
        className="nodrag nopan pointer-events-none absolute top-0 left-0 rounded border bg-popover px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-popover-foreground shadow-sm"
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

const CardinalityMarker = memo(function CardinalityMarker({
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
});

export const RelationshipEdge = memo(RelationshipEdgeComponent);
