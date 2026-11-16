"use client";

import { useStore } from "@xyflow/react";
import { useEffect } from "react";

/** Below this zoom a table's 12 px row text is under ~4 px on screen: unreadable anyway. */
export const ROW_DETAIL_MIN_ZOOM = 0.3;

/**
 * Level of detail for large schemas (P2-T10, ADR-022): below `ROW_DETAIL_MIN_ZOOM` the canvas root
 * gets `data-zoomed-out`, and CSS hides the text and icons of column rows (keeping their size,
 * handles and colours) and draws a light bar instead. Painting hundreds of rows of sub-pixel text
 * is what made panning a zoomed-out 2,000-table schema run at ~30 fps. Only the boolean is
 * subscribed, so this re-renders when the zoom crosses the threshold, not on every frame.
 */
export function ZoomDetail({ enabled }: { enabled: boolean }) {
  const zoomedOut = useStore((s) => s.transform[2] < ROW_DETAIL_MIN_ZOOM);
  const domNode = useStore((s) => s.domNode);
  const active = enabled && zoomedOut;
  useEffect(() => {
    const root = domNode?.closest<HTMLElement>('[data-testid="schema-canvas"]');
    if (!root) return;
    if (active) root.dataset.zoomedOut = "true";
    else delete root.dataset.zoomedOut;
  }, [active, domNode]);
  return null;
}
