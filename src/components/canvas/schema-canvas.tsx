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
  useStoreApi,
  type OnNodeDrag,
  type ReactFlowInstance,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import { LocateFixed } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { DiagramLayout, Schema, Viewport as SavedViewport } from "@/domain/schema/types";
import { diagramGeometry, hitTable, tablesBox } from "@/generators/diagram-geometry";
import { OVERVIEW_TABLES, fitViewport, nextOverviewState } from "@/graph/overview";
import { schemaToFlow, type FlowElements } from "@/graph/schema-to-flow";
import type { RelationshipFlowEdge, TableFlowNode } from "@/graph/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { OverviewLayer } from "./overview-layer";
import { RelationshipEdge } from "./relationship-edge";
import { TableNode } from "./table-node";
import {
  fitPadding,
  issuesSheetOpen,
  toFitPadding,
  useCanvasCommands,
  type OverviewFit,
} from "./use-canvas-commands";
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

/** Focus must never fall back to BODY when the nodes it sits on are hidden by the overview (R4). */
function moveFocusToPane(root: HTMLElement | null) {
  const active = document.activeElement;
  if (!root || !(active instanceof HTMLElement)) return;
  if (!active.closest(".react-flow__node, .react-flow__edge")) return;
  const pane = root.querySelector<HTMLElement>(".react-flow__pane");
  if (!pane) return;
  pane.tabIndex = -1;
  pane.focus({ preventScroll: true });
}

/** Unpins any clicked edge; returns the same array when nothing was selected (no re-render). */
function deselectEdges(edges: RelationshipFlowEdge[]): RelationshipFlowEdge[] {
  return edges.some((e) => e.selected)
    ? edges.map((e) => (e.selected ? { ...e, selected: false } : e))
    : edges;
}

/**
 * Whether the overview will be active once the view is fitted (or restored), decided before React
 * Flow first receives the nodes, so a large schema never mounts its tables just to hide them (R1).
 */
function initialOverview(
  schema: Schema,
  layout: DiagramLayout,
  pending: SavedViewport | null,
): boolean {
  const tables = schema.tableOrder.length;
  if (tables < OVERVIEW_TABLES) return false;
  const zoom =
    pending?.zoom ??
    fitViewport(
      tablesBox(diagramGeometry(schema, layout).tables),
      { width: window.innerWidth, height: window.innerHeight },
      0.15,
    ).zoom;
  return nextOverviewState(false, zoom, tables);
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
  // `overview`: the zoomed-out view is drawn on one canvas and the DOM nodes are hidden (view-only:
  // it is derived below and never reaches the layout store, the saved layout or exports).
  const [overview, setOverview] = useState(false);
  if (syncedBase !== base) {
    setSyncedBase(base);
    setNodes(base.nodes);
    setEdges(base.edges);
    const layout = fingerprint ? useLayoutStore.getState().layouts[fingerprint] : undefined;
    setOverview(
      schema && layout
        ? initialOverview(schema, layout, useLayoutStore.getState().pendingViewport)
        : false,
    );
  }
  const shownNodes = useMemo(
    () => (overview ? nodes.map((n) => (n.hidden ? n : { ...n, hidden: true })) : nodes),
    [nodes, overview],
  );
  const shownEdges = useMemo(
    () => (overview ? edges.map((e) => (e.hidden ? e : { ...e, hidden: true })) : edges),
    [edges, overview],
  );

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
  // `data-moving` while the viewport actually moves (a plain click emits no move): CSS turns off
  // dimming transitions, so a pan never repaints fading tables and edges (ADR-023, QA-020).
  const rootRef = useRef<HTMLDivElement>(null);
  const flow = useStoreApi();
  const { screenToFlowPosition } = useReactFlow();
  const tableCount = base.nodes.length;
  const eligible = tableCount >= OVERVIEW_TABLES;
  const overviewNow = useRef(overview);
  const changeOverview = useCallback((next: boolean) => {
    if (next) moveFocusToPane(rootRef.current);
    overviewNow.current = next;
    setOverview(next);
  }, []);
  useEffect(() => {
    overviewNow.current = overview;
  }, [overview]);
  // Geometry of the current layout, for fitting and drawing the overview (read when needed:
  // dragging does not change `version`).
  const geometry = useMemo(() => {
    const layout = fingerprint ? useLayoutStore.getState().layouts[fingerprint] : undefined;
    return overview && schema && layout ? diagramGeometry(schema, layout) : null;
    // `collapsed` and `version` are intentional triggers, like for `base`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, schema, fingerprint, collapsed, version]);
  const overviewFit = useMemo<OverviewFit | null>(() => {
    if (!eligible) return null;
    return {
      fit: (padding) => {
        const layout = fingerprint ? useLayoutStore.getState().layouts[fingerprint] : undefined;
        const { width, height } = flow.getState();
        if (!schema || !layout || !width || !height) return null;
        return fitViewport(
          tablesBox(diagramGeometry(schema, layout).tables),
          { width, height },
          padding,
        );
      },
      decide: (zoom) => changeOverview(nextOverviewState(overviewNow.current, zoom, tableCount)),
    };
  }, [eligible, schema, fingerprint, flow, changeOverview, tableCount]);
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (overviewNow.current && geometry) {
        const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const id = hitTable(geometry.tables, at);
        if (id) clearEdgeSelection();
        selectTable(id);
        return;
      }
      selectTable(null);
    },
    [geometry, screenToFlowPosition, selectTable, clearEdgeSelection],
  );
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

  // A restored session opens at its saved pan and zoom instead of fitting the view. Captured once,
  // when the diagram first appears, and applied in `onInit` (the provider above is created before
  // the schema loads, so React Flow's `defaultViewport` prop would be ignored);
  // `useCanvasCommands` consumes the one-shot value.
  const [openingViewport, setOpeningViewport] = useState<Viewport | null | undefined>(undefined);
  if (schema && openingViewport === undefined)
    setOpeningViewport(useLayoutStore.getState().pendingViewport);
  const onInit = useCallback(
    (instance: ReactFlowInstance<TableFlowNode, RelationshipFlowEdge>) => {
      if (openingViewport) {
        void instance.setViewport(openingViewport);
        return;
      }
      const target = overviewFit?.fit(toFitPadding(fitPadding(issuesSheetOpen())));
      if (overviewFit && target) {
        overviewFit.decide(target.zoom);
        void instance.setViewport(target);
      }
    },
    [openingViewport, overviewFit],
  );
  const restoring = useSchemaStore((s) => s.restoring);

  const large = base.nodes.length > LARGE_SCHEMA_THRESHOLD;
  const { resetView } = useCanvasCommands(base, large, overviewFit);

  if (!schema) {
    return (
      <div
        data-testid="canvas-empty"
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
      >
        {restoring ? (
          <p role="status" data-testid="canvas-restoring">
            Restoring {restoring.name}…
          </p>
        ) : (
          "Loading schema…"
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-testid="schema-canvas"
      data-overview={overview ? "true" : "false"}
      data-instant-dim={base.nodes.length + base.edges.length > DIM_TRANSITION_LIMIT || undefined}
      className="h-full w-full bg-canvas"
    >
      <ReactFlow<TableFlowNode, RelationshipFlowEdge>
        nodes={shownNodes}
        edges={shownEdges}
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
        fitView={!openingViewport && !eligible}
        fitViewOptions={FIT_VIEW_OPTIONS}
        onInit={onInit}
        aria-label="Schema diagram"
      >
        <ZoomDetail
          enabled={large}
          tables={tableCount}
          overview={overview}
          onOverviewChange={changeOverview}
        />
        {overview && geometry && <OverviewLayer geometry={geometry} />}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--canvas-dot)" />
        <Controls
          showInteractive={false}
          position="bottom-left"
          fitViewOptions={FIT_VIEW_OPTIONS}
        />
        {showMiniMap && !overview && (
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
