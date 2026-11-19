"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { schemaToFlow, type FlowElements } from "@/graph/schema-to-flow";
import type { RelationshipFlowEdge, TableFlowNode } from "@/graph/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { RelationshipEdge } from "./relationship-edge";
import { TableNode } from "./table-node";
import { useCanvasCommands } from "./use-canvas-commands";
import { useFocusSetSync } from "./use-focus-set-sync";
import { ZoomDetail } from "./zoom-detail";

/** Above this many tables, React Flow only renders nodes/edges inside the viewport. */
export const LARGE_SCHEMA_THRESHOLD = 80;

/**
 * Above this many tables + relationships, dimming switches instantly instead of fading: hundreds of
 * simultaneous opacity transitions cost frames on a zoomed-out large schema (P2-T09).
 */
export const DIM_TRANSITION_LIMIT = 300;

const nodeTypes = { table: TableNode };
const edgeTypes = { relationship: RelationshipEdge };
const EMPTY: FlowElements = { nodes: [], edges: [] };
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 };

/** Unpins any clicked edge; returns the same array when nothing was selected (no re-render). */
function deselectEdges(edges: RelationshipFlowEdge[]): RelationshipFlowEdge[] {
  return edges.some((e) => e.selected)
    ? edges.map((e) => (e.selected ? { ...e, selected: false } : e))
    : edges;
}

export function SchemaCanvas() {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner />
    </ReactFlowProvider>
  );
}

function SchemaCanvasInner() {
  const schema = useSchemaStore((s) => s.schema);
  const fingerprint = useSchemaStore((s) => s.fingerprint);
  const version = useLayoutStore((s) => s.version);
  const collapsed = useLayoutStore((s) =>
    fingerprint ? s.layouts[fingerprint]?.collapsed : undefined,
  );
  const showMiniMap = useUiStore((s) => s.showMiniMap);
  const selectTable = useUiStore((s) => s.selectTable);
  const setPosition = useLayoutStore((s) => s.setPosition);
  const setViewport = useLayoutStore((s) => s.setViewport);
  useFocusSetSync();

  // Rebuild nodes/edges only when the schema, collapse modes or layout version change. Positions are
  // read from the store at that moment; afterwards React Flow owns transient drag state.
  const base = useMemo(() => {
    const layout = fingerprint ? useLayoutStore.getState().layouts[fingerprint] : undefined;
    return schema && layout && collapsed ? schemaToFlow(schema, layout) : EMPTY;
    // `version` is an intentional trigger: it changes whenever stored positions are replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, fingerprint, collapsed, version]);

  const [nodes, setNodes] = useState<TableFlowNode[]>(base.nodes);
  // Edges are local state too so React Flow can apply edge selection (click to pin a label).
  const [edges, setEdges] = useState<RelationshipFlowEdge[]>(base.edges);
  const [syncedBase, setSyncedBase] = useState(base);
  if (syncedBase !== base) {
    setSyncedBase(base);
    setNodes(base.nodes);
    setEdges(base.edges);
  }

  // Selecting a table (canvas, list or keyboard) or pressing Escape clears a clicked edge and its
  // pinned label.
  const clearEdgeSelection = useCallback(() => setEdges(deselectEdges), []);
  useEffect(
    () =>
      useUiStore.subscribe((s, prev) => {
        const changed =
          s.selectedTableId !== prev.selectedTableId || s.focusRequest !== prev.focusRequest;
        if ((changed && s.selectedTableId !== null) || s.clearRequest !== prev.clearRequest)
          clearEdgeSelection();
      }),
    [clearEdgeSelection],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<TableFlowNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<RelationshipFlowEdge>[]) =>
      setEdges((current) => applyEdgeChanges(changes, current)),
    [],
  );

  const onNodeDragStop: OnNodeDrag<TableFlowNode> = useCallback(
    (_event, _node, dragged) => {
      if (!fingerprint) return;
      for (const n of dragged)
        setPosition(fingerprint, n.id, {
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
        });
    },
    [fingerprint, setPosition],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (
        (event.key === "Enter" || event.key === " ") &&
        target.classList.contains("react-flow__node")
      ) {
        event.preventDefault();
        clearEdgeSelection();
        selectTable(target.dataset.id ?? null);
      }
    },
    [selectTable, clearEdgeSelection],
  );

  const onNodeClick = useCallback(
    (_e: unknown, node: TableFlowNode) => {
      clearEdgeSelection();
      selectTable(node.id);
    },
    [selectTable, clearEdgeSelection],
  );
  const onPaneClick = useCallback(() => selectTable(null), [selectTable]);
  // `data-moving` while the viewport actually moves (a plain click emits no move): CSS turns off
  // dimming transitions, so a pan never repaints fading tables and edges (ADR-023, QA-020).
  const rootRef = useRef<HTMLDivElement>(null);
  const onMove = useCallback(() => {
    const root = rootRef.current;
    if (root && !root.dataset.moving) root.dataset.moving = "true";
  }, []);
  const onMoveEnd = useCallback(
    (_e: unknown, viewport: Viewport) => {
      if (rootRef.current) delete rootRef.current.dataset.moving;
      if (fingerprint) setViewport(fingerprint, viewport);
    },
    [fingerprint, setViewport],
  );

  const large = base.nodes.length > LARGE_SCHEMA_THRESHOLD;
  const { resetView } = useCanvasCommands(base, large);

  if (!schema) {
    return (
      <div
        data-testid="canvas-empty"
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
      >
        Loading schema…
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-testid="schema-canvas"
      data-instant-dim={base.nodes.length + base.edges.length > DIM_TRANSITION_LIMIT || undefined}
      className="h-full w-full bg-canvas"
    >
      <ReactFlow<TableFlowNode, RelationshipFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onKeyDown={onKeyDown}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        onlyRenderVisibleElements={large}
        minZoom={0.05}
        maxZoom={2}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        aria-label="Schema diagram"
      >
        <ZoomDetail enabled={large} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--canvas-dot)" />
        <Controls
          showInteractive={false}
          position="bottom-left"
          fitViewOptions={FIT_VIEW_OPTIONS}
        />
        {showMiniMap && (
          <MiniMap
            data-testid="canvas-minimap"
            pannable
            zoomable
            position="bottom-right"
            nodeStrokeWidth={2}
            ariaLabel="Diagram overview"
          />
        )}
        <Panel position="top-right">
          <Button
            variant="outline"
            size="sm"
            className="bg-card shadow-sm"
            onClick={resetView}
            data-testid="canvas-reset-view"
          >
            <LocateFixed aria-hidden />
            Reset view
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
