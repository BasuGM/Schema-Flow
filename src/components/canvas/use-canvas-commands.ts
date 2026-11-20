"use client";

import { useReactFlow, useStoreApi, type FitViewOptions } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import { SHEET_HEIGHT_PERCENT, SHEET_QUERY } from "@/components/issues/issues-sheet";
import {
  NODE_ROW_HEIGHT,
  NODE_WIDTH,
  renderedColumns,
  rowCenterOffset,
} from "@/graph/node-metrics";
import type { FlowElements } from "@/graph/schema-to-flow";
import type { TableFlowNode } from "@/graph/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/** After a new layout, canvas size changes within this window re-fit (see below). */
const FIT_WINDOW_MS = 600;

/** True when the issues panel is open as the bottom sheet that overlays the canvas (phones). */
export function issuesSheetOpen(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return useUiStore.getState().issuesPanelOpen && window.matchMedia(SHEET_QUERY).matches;
}

/**
 * Fit padding. The sheet overlays the canvas without resizing it, so with the sheet open the
 * diagram is fitted into the area above it (QA-014); otherwise the usual 15% margin.
 */
export function fitPadding(sheetOpen: boolean): FitViewOptions["padding"] {
  if (!sheetOpen) return 0.15;
  return { top: "5%", bottom: `${SHEET_HEIGHT_PERCENT + 5}%`, x: "6%" };
}

export function motionDuration(ms: number): number {
  if (typeof window === "undefined" || !window.matchMedia) return ms;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

/** A zoom change of more than this factor counts as a "jump" (ADR-022). */
export const JUMP_ZOOM_RATIO = 4;

/**
 * Centring animation. Large schemas (`onlyRenderVisibleElements`) skip it when the zoom changes by
 * more than `JUMP_ZOOM_RATIO` (e.g. 0.05 → 1 after picking a table in a 2,000-table list): every
 * animation frame would mount and unmount a different set of tables, which cost frames of 230–350
 * ms. Normal-sized schemas, and small zoom changes, keep the 300 ms animation.
 */
export function centerDuration(fromZoom: number, toZoom: number, large: boolean): number {
  const ratio = Math.max(toZoom / fromZoom, fromZoom / toZoom);
  return large && ratio > JUMP_ZOOM_RATIO ? 0 : motionDuration(300);
}

/**
 * Bridges UI-store focus requests (center on table) and layout changes to the React Flow
 * viewport. Only imperative viewport calls happen here; no React state is set.
 */
export function useCanvasCommands(base: FlowElements, large = false) {
  const { fitView, setCenter, getZoom, getInternalNode } = useReactFlow<TableFlowNode>();
  const focusRequest = useUiStore((s) => s.focusRequest);

  const resetView = useCallback(() => {
    void fitView({
      padding: fitPadding(issuesSheetOpen()),
      maxZoom: 1,
      duration: motionDuration(250),
    });
  }, [fitView]);

  const flowStore = useStoreApi();
  useEffect(() => {
    if (!focusRequest) return;
    const node = getInternalNode(focusRequest.tableId);
    if (!node) return;
    const { x, y } = node.internals.positionAbsolute;
    const width = node.measured.width ?? NODE_WIDTH;
    const height = node.measured.height ?? 0;
    // A column (search hit, link) centers on its row, which may be far down a long table.
    const table = focusRequest.columnId
      ? useSchemaStore.getState().schema?.tables[focusRequest.tableId]
      : undefined;
    const rowOffset =
      table && focusRequest.columnId
        ? rowCenterOffset(
            renderedColumns(table, node.data.mode, focusRequest.columnId),
            focusRequest.columnId,
          )
        : null;
    const target = { x: x + width / 2, y: y + (rowOffset ?? Math.min(height / 2, 200)) };
    if (focusRequest.mode === "ensure-visible") {
      // Reading through columns in the inspector must not make the diagram jump: pan only when
      // the row (or the table header) is outside the visible canvas.
      const { width: w, height: h, transform } = flowStore.getState();
      const [tx, ty, zoom] = transform;
      const half = (rowOffset === null ? NODE_ROW_HEIGHT : NODE_ROW_HEIGHT / 2) * zoom;
      const left = x * zoom + tx;
      const right = (x + width) * zoom + tx;
      const cy = target.y * zoom + ty;
      const visible = left >= 0 && right <= w && cy - half >= 0 && cy + half <= h;
      if (visible) return;
      void setCenter(target.x, target.y, { zoom, duration: motionDuration(300) });
      return;
    }
    const zoom = Math.max(getZoom(), 0.9);
    void setCenter(target.x, target.y, {
      zoom,
      duration: centerDuration(getZoom(), zoom, large),
    });
  }, [focusRequest, getInternalNode, setCenter, getZoom, flowStore, large]);

  // Re-fit whenever the node set is rebuilt from a new layout (initial load, re-layout, new schema).
  const firstBase = useRef(true);
  const fitWindowEnd = useRef(0);
  useEffect(() => {
    if (firstBase.current) {
      firstBase.current = false;
      useLayoutStore.getState().takePendingViewport();
      return;
    }
    // A restored session keeps its saved viewport: no fit, and no re-fit on the next resizes.
    if (useLayoutStore.getState().takePendingViewport()) return;
    fitWindowEnd.current = performance.now() + FIT_WINDOW_MS;
    const frame = requestAnimationFrame(() => resetView());
    return () => cancelAnimationFrame(frame);
  }, [base, resetView]);

  // An import can open the issues panel in the same update, shrinking the canvas a few frames
  // later. Size changes shortly after a new layout re-fit to the final size; any other resize
  // (the user opening, closing or dragging the panel) keeps the viewport. Subscribing to the store
  // (not `useStore`) avoids re-rendering the canvas on every resize frame.
  useEffect(() => {
    let frame = 0;
    const unsubscribe = flowStore.subscribe((s, prev) => {
      if (s.width === prev.width && s.height === prev.height) return;
      if (performance.now() > fitWindowEnd.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => resetView());
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [flowStore, resetView]);

  return { resetView };
}
