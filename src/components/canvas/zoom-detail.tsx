"use client";

import { useStore, useStoreApi } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { nextOverviewState } from "@/graph/overview";
import { useUiStore } from "@/stores/ui-store";

/** Below this zoom a table's 12 px row text is under ~4 px on screen: unreadable anyway. */
export const ROW_DETAIL_MIN_ZOOM = 0.3;

/**
 * Level of detail for large schemas (P2-T10, ADR-022/023): below `ROW_DETAIL_MIN_ZOOM` the canvas
 * root gets `data-zoomed-out` (CSS draws a light bar per row) and `canvasZoomedOut` is set, so table
 * nodes render each row as a skeleton (same height and handles, no text or icons) and edges drop
 * their markers and hover target. Fewer elements to restyle and repaint when a selection dims
 * hundreds of tables (QA-019). Only the boolean is subscribed, so this re-renders when the zoom
 * crosses the threshold, not on every frame.
 */
export function ZoomDetail({
  enabled,
  tables,
  overview,
  onOverviewChange,
}: {
  enabled: boolean;
  tables: number;
  overview: boolean;
  onOverviewChange: (overview: boolean) => void;
}) {
  const flow = useStoreApi();
  const current = useRef(overview);
  useEffect(() => {
    current.current = overview;
  }, [overview]);
  // Zoom-driven overview changes, with hysteresis (nextOverviewState). Only a changed transform
  // counts, so React Flow's initial default viewport never flips the state before the real one.
  useEffect(() => {
    return flow.subscribe((s, prev) => {
      if (s.transform === prev.transform) return;
      const next = nextOverviewState(current.current, s.transform[2], tables);
      if (next === current.current) return;
      current.current = next;
      onOverviewChange(next);
    });
  }, [flow, tables, onOverviewChange]);

  const zoomedOut = useStore((s) => s.transform[2] < ROW_DETAIL_MIN_ZOOM);
  const domNode = useStore((s) => s.domNode);
  const active = enabled && zoomedOut;
  useEffect(() => {
    useUiStore.getState().setCanvasZoomedOut(active);
    const root = domNode?.closest<HTMLElement>('[data-testid="schema-canvas"]');
    if (root) {
      if (active) root.dataset.zoomedOut = "true";
      else delete root.dataset.zoomedOut;
    }
  }, [active, domNode]);
  useEffect(() => () => useUiStore.getState().setCanvasZoomedOut(false), []);
  return null;
}
