"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type NodeChange,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import { LocateFixed } from "lucide-react";
import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { schemaToFlow, type FlowElements } from "@/graph/schema-to-flow";
import type { TableFlowNode } from "@/graph/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { RelationshipEdge } from "./relationship-edge";
import { TableNode } from "./table-node";
import { useCanvasCommands } from "./use-canvas-commands";

/** Above this many tables, React Flow only renders nodes/edges inside the viewport. */
export const LARGE_SCHEMA_THRESHOLD = 80;

const nodeTypes = { table: TableNode };
const edgeTypes = { relationship: RelationshipEdge };
const EMPTY: FlowElements = { nodes: [], edges: [] };
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 };

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

  // Rebuild nodes/edges only when the schema, collapse modes or layout version change. Positions are
  // read from the store at that moment; afterwards React Flow owns transient drag state.
  const base = useMemo(() => {
    const layout = fingerprint ? useLayoutStore.getState().layouts[fingerprint] : undefined;
    return schema && layout && collapsed ? schemaToFlow(schema, layout) : EMPTY;
    // `version` is an intentional trigger: it changes whenever stored positions are replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, fingerprint, collapsed, version]);

  const [nodes, setNodes] = useState<TableFlowNode[]>(base.nodes);
  const [syncedBase, setSyncedBase] = useState(base);
  if (syncedBase !== base) {
    setSyncedBase(base);
    setNodes(base.nodes);
  }

  const onNodesChange = useCallback(
    (changes: NodeChange<TableFlowNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
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
      if (event.key === "Escape") selectTable(null);
      if (
        (event.key === "Enter" || event.key === " ") &&
        target.classList.contains("react-flow__node")
      ) {
        event.preventDefault();
        selectTable(target.dataset.id ?? null);
      }
    },
    [selectTable],
  );

  const onNodeClick = useCallback(
    (_e: unknown, node: TableFlowNode) => selectTable(node.id),
    [selectTable],
  );
  const onPaneClick = useCallback(() => selectTable(null), [selectTable]);
  const onMoveEnd = useCallback(
    (_e: unknown, viewport: Viewport) => {
      if (fingerprint) setViewport(fingerprint, viewport);
    },
    [fingerprint, setViewport],
  );

  const { resetView } = useCanvasCommands(base);
  const large = base.nodes.length > LARGE_SCHEMA_THRESHOLD;

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
    <div data-testid="schema-canvas" className="h-full w-full bg-canvas">
      <ReactFlow<TableFlowNode>
        nodes={nodes}
        edges={base.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
