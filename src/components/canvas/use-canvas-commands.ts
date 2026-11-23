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

/** Canvas height left above the bottom sheet, given how many px of the pane it covers. */
export function visibleCanvasHeight(h: number, coveredPx: number): number {
  return Math.max(0, h - coveredPx);
}

/** Flow-y shift that moves a centred point from the pane middle to the middle of the visible band. */
export function sheetCenterOffset(h: number, visibleH: number, zoom: number): number {
  return (h - visibleH) / 2 / zoom;
}

/** Gap between the pane top and a table taller than the visible band (header stays in view). */
const TALL_TOP_GAP = 16;

/** Flow-y centre that puts a node's top `TALL_TOP_GAP` px below the pane top. */
export function tallNodeTargetY(nodeY: number, zoom: number, h: number): number {
  return nodeY - TALL_TOP_GAP / zoom + h / 2 / zoom;
}

export interface BandPlacement {
  /** Node top (flow y) and height (flow px). */
  nodeY: number;
  nodeH: number;
  /** Flow y that should be centred: the node middle, or the focused column's row. */
  targetY: number;
  /** True when `targetY` is a column row rather than the table as a whole. */
  hasRow: boolean;
  zoom: number;
  /** Pane height and the part of it above the sheet, in px. */
  h: number;
  visibleH: number;
}

/**
 * Flow-y to centre the viewport on so the reveal lands in the band above the phone sheet (QA-039,
 * QA-040). A table that fits is clamped to sit fully inside the band (header 16 px below the top),
 * which also keeps a focused column in view; a table taller than the band keeps its header at the
 * top, moving down to the column only when the column would otherwise be below the band.
 */
export function bandCenterY(p: BandPlacement): number {
  const { nodeY, nodeH, targetY, hasRow, zoom, h, visibleH } = p;
  const centered = targetY + sheetCenterOffset(h, visibleH, zoom);
  const headerFirst = tallNodeTargetY(nodeY, zoom, h); // largest centre that keeps the top gap
  if (nodeH * zoom <= visibleH - TALL_TOP_GAP) {
    const bottomBound = nodeY + nodeH + (h / 2 - visibleH) / zoom; // smallest centre keeping the bottom
    return Math.min(headerFirst, Math.max(bottomBound, centered));
  }
  if (!hasRow) return headerFirst;
  const columnInBand = targetY + (h / 2 - visibleH) / zoom + NODE_ROW_HEIGHT;
  return Math.max(headerFirst, columnInBand);
}

/**
 * Pixels of the pane covered by the phone issues sheet (QA-039), measured from the DOM because
 * the sheet is a share of the viewport while the pane sits below the toolbar. Falls back to the
 * sheet's percentage when the element is not mounted yet.
 */
function sheetCoveredPx(pane: HTMLElement | null, h: number): number {
  if (!issuesSheetOpen()) return 0;
  const sheet = document.querySelector<HTMLElement>('[data-testid="issues-sheet"]');
  if (!sheet || !pane) return (h * SHEET_HEIGHT_PERCENT) / 100;
  return Math.max(0, pane.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top);
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
    const { width: w, height: h, transform, domNode } = flowStore.getState();
    const [tx, ty, currentZoom] = transform;
    const visibleH = visibleCanvasHeight(h, sheetCoveredPx(domNode, h));
    // With the phone sheet open, place the table in the band above it (see `bandCenterY`).
    // Nothing is covered on desktop: plain centring.
    const placeY = (zoom: number): number =>
      visibleH < h
        ? bandCenterY({
            nodeY: y,
            nodeH: height,
            targetY: target.y,
            hasRow: rowOffset !== null,
            zoom,
            h,
            visibleH,
          })
        : target.y;
    if (focusRequest.mode === "ensure-visible") {
      // Reading through columns in the inspector must not make the diagram jump: pan only when
      // the row (or the table header) is outside the visible canvas.
      const half = (rowOffset === null ? NODE_ROW_HEIGHT : NODE_ROW_HEIGHT / 2) * currentZoom;
      const left = x * currentZoom + tx;
      const right = (x + width) * currentZoom + tx;
      const cy = target.y * currentZoom + ty;
      const visible = left >= 0 && right <= w && cy - half >= 0 && cy + half <= visibleH;
      if (visible) return;
      void setCenter(target.x, placeY(currentZoom), {
        zoom: currentZoom,
        duration: motionDuration(300),
      });
      return;
    }
    const zoom = Math.max(getZoom(), 0.9);
    void setCenter(target.x, placeY(zoom), {
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
