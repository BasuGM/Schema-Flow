"use client";

import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import { NODE_WIDTH } from "@/graph/node-metrics";
import type { FlowElements } from "@/graph/schema-to-flow";
import type { TableFlowNode } from "@/graph/types";
import { useUiStore } from "@/stores/ui-store";

function motionDuration(ms: number): number {
  if (typeof window === "undefined" || !window.matchMedia) return ms;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

/**
 * Bridges UI-store focus requests (center on table) and layout changes to the React Flow
 * viewport. Only imperative viewport calls happen here; no React state is set.
 */
export function useCanvasCommands(base: FlowElements) {
  const { fitView, setCenter, getZoom, getInternalNode } = useReactFlow<TableFlowNode>();
  const focusRequest = useUiStore((s) => s.focusRequest);

  const resetView = useCallback(() => {
    void fitView({ padding: 0.15, maxZoom: 1, duration: motionDuration(250) });
  }, [fitView]);

  useEffect(() => {
    if (!focusRequest) return;
    const node = getInternalNode(focusRequest.tableId);
    if (!node) return;
    const { x, y } = node.internals.positionAbsolute;
    const width = node.measured.width ?? NODE_WIDTH;
    const height = node.measured.height ?? 0;
    void setCenter(x + width / 2, y + Math.min(height / 2, 200), {
      zoom: Math.max(getZoom(), 0.9),
      duration: motionDuration(300),
    });
  }, [focusRequest, getInternalNode, setCenter, getZoom]);

  // Re-fit whenever the node set is rebuilt from a new layout (initial load, re-layout, new schema).
  const firstBase = useRef(true);
  useEffect(() => {
    if (firstBase.current) {
      firstBase.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => resetView());
    return () => cancelAnimationFrame(frame);
  }, [base, resetView]);

  return { resetView };
}
