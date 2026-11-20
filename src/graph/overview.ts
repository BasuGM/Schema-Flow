import type { Viewport } from "@/domain/schema/types";

/** Schemas with at least this many tables draw their zoomed-out view on one canvas. */
export const OVERVIEW_TABLES = 300;
/** Enter the overview below this zoom, leave it above OVERVIEW_LEAVE_ZOOM (hysteresis band). */
export const OVERVIEW_ENTER_ZOOM = 0.28;
export const OVERVIEW_LEAVE_ZOOM = 0.32;
export const FIT_MIN_ZOOM = 0.05;
export const FIT_MAX_ZOOM = 1;

/** Whether the overview is active after the zoom changed to `zoom`. Inside the band: unchanged. */
export function nextOverviewState(prev: boolean, zoom: number, tables: number): boolean {
  if (tables < OVERVIEW_TABLES) return false;
  if (zoom < OVERVIEW_ENTER_ZOOM) return true;
  if (zoom > OVERVIEW_LEAVE_ZOOM) return false;
  return prev;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fractions of the canvas size left empty on each side. */
export interface FitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Same maths as React Flow's `getViewportForBounds`, so the overview and `fitView` agree. */
export function fitViewport(
  bounds: Box,
  size: { width: number; height: number },
  padding: number | FitPadding,
  minZoom = FIT_MIN_ZOOM,
  maxZoom = FIT_MAX_ZOOM,
): Viewport {
  const p =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  const padX = size.width * (p.left + p.right);
  const padY = size.height * (p.top + p.bottom);
  const innerW = Math.max(1, size.width - padX);
  const innerH = Math.max(1, size.height - padY);
  const raw = Math.min(innerW / Math.max(1, bounds.width), innerH / Math.max(1, bounds.height));
  const zoom = Math.min(maxZoom, Math.max(minZoom, raw));
  return {
    zoom,
    x: size.width * p.left + (innerW - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: size.height * p.top + (innerH - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}

export function fitZoom(
  bounds: Box,
  size: { width: number; height: number },
  padding: number | FitPadding,
): number {
  return fitViewport(bounds, size, padding).zoom;
}
