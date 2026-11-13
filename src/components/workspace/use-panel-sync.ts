"use client";

import { useEffect, useRef } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import { useUiStore } from "@/stores/ui-store";

/** Below this viewport width the side panels start collapsed (and collapse when crossing it). */
export const NARROW_QUERY = "(max-width: 900px)";

/**
 * Keeps a collapsible panel and `ui-store` open state in sync in both directions, and collapses
 * side panels on narrow viewports instead of squeezing the canvas.
 */
export function usePanelSync(side: "left" | "right") {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  const open = useUiStore((s) => (side === "left" ? s.leftPanelOpen : s.rightPanelOpen));
  const setPanelOpen = useUiStore((s) => s.setPanelOpen);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (open && panel.isCollapsed()) panel.expand();
    if (!open && !panel.isCollapsed()) panel.collapse();
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const apply = () => setPanelOpen(side, !mq.matches);
    if (mq.matches) apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [side, setPanelOpen]);

  const onResize = (size: PanelSize) => setPanelOpen(side, size.inPixels > 0);
  return { panelRef, onResize };
}
