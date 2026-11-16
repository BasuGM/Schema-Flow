"use client";

import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import { NODE_WIDTH } from "@/graph/node-metrics";
import type { FlowElements } from "@/graph/schema-to-flow";
import type { TableFlowNode } from "@/graph/types";
import { useUiStore } from "@/stores/ui-store";

/** After a new layout, canvas size changes within this window re-fit (see below). */
const FIT_WINDOW_MS = 600;

export function motionDuration(ms: number): number {
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
  const fitWindowEnd = useRef(0);
  useEffect(() => {
    if (firstBase.current) {
      firstBase.current = false;
      return;
    }
    fitWindowEnd.current = performance.now() + FIT_WINDOW_MS;
    const frame = requestAnimationFrame(() => resetView());
    return () => cancelAnimationFrame(frame);
  }, [base, resetView]);

  // An import can open the issues panel in the same update, shrinking the canvas a few frames
  // later. Size changes shortly after a new layout re-fit to the final size; any other resize
  // (the user opening, closing or dragging the panel) keeps the viewport. Subscribing to the store
  // (not `useStore`) avoids re-rendering the canvas on every resize frame.
  const store = useStoreApi();
  useEffect(() => {
    let frame = 0;
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.width === prev.width && s.height === prev.height) return;
      if (performance.now() > fitWindowEnd.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => resetView());
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [store, resetView]);

  return { resetView };
}
