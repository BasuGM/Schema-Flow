import type { EdgeRoute, Position } from "@/domain/schema/types";

export interface CubicSegment {
  from: Position;
  c1: Position;
  c2: Position;
  to: Position;
}

/**
 * Smooth path through `points` with horizontal tangents at every point (LR layouts). Waypoints from
 * Dagre sit in the channels between nodes, so leaving and entering each one horizontally keeps the
 * curve in those channels.
 */
export function routeSegments(points: readonly Position[]): CubicSegment[] {
  const segments: CubicSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    const dx = (to.x - from.x) / 2;
    segments.push({ from, c1: { x: from.x + dx, y: from.y }, c2: { x: to.x - dx, y: to.y }, to });
  }
  return segments;
}

export function segmentsToPath(segments: readonly CubicSegment[]): string {
  const first = segments[0];
  if (!first) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  return (
    `M ${r(first.from.x)} ${r(first.from.y)}` +
    segments
      .map(
        (s) => ` C ${r(s.c1.x)} ${r(s.c1.y)}, ${r(s.c2.x)} ${r(s.c2.y)}, ${r(s.to.x)} ${r(s.to.y)}`,
      )
      .join("")
  );
}

export function samePosition(
  a: Position | undefined,
  b: Position | undefined,
  tolerance = 0.5,
): boolean {
  return !!a && !!b && Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

/**
 * CSS transform for an edge label that keeps a constant on-screen size at any zoom (QA-005).
 * The label is anchored on the FK handle in flow coordinates, then counter-scaled by 1/zoom, so the
 * gap and font size are in screen pixels. `transform-origin` must be `0 0`.
 */
export function labelTransform(
  anchor: Position,
  side: "left" | "right",
  zoom: number,
  gapPx = 12,
  shiftPx = 0,
): string {
  const scale = 1 / (zoom > 0 && Number.isFinite(zoom) ? zoom : 1);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const place =
    side === "left"
      ? `translate(${-gapPx}px, 0) translate(-100%, -50%)`
      : `translate(${gapPx}px, 0) translate(0%, -50%)`;
  const shift = shiftPx !== 0 && Number.isFinite(shiftPx) ? ` translate(${r(shiftPx)}px, 0)` : "";
  return `translate(${r(anchor.x)}px, ${r(anchor.y)}px) scale(${r(scale)}) ${place}${shift}`;
}

/**
 * Horizontal screen-pixel shift that keeps a label inside the visible canvas pane (QA-006). Labels
 * have a constant on-screen size, so a long one beside a table near the pane edge would otherwise
 * be clipped under the side panel. Returns 0 when it fits or when the sizes are not known yet.
 */
export function labelOverflowShift({
  anchorScreenX,
  side,
  gapPx,
  widthPx,
  paneWidth,
  marginPx = 8,
}: {
  /** Anchor x relative to the pane's left edge, in screen pixels. */
  anchorScreenX: number;
  side: "left" | "right";
  gapPx: number;
  widthPx: number;
  paneWidth: number;
  marginPx?: number;
}): number {
  if (!(paneWidth > 0) || !(widthPx > 0) || !Number.isFinite(anchorScreenX)) return 0;
  const left = side === "left" ? anchorScreenX - gapPx - widthPx : anchorScreenX + gapPx;
  const right = left + widthPx;
  if (left < marginPx) return marginPx - left;
  // Too far right: move left, but never past the left margin (a label wider than the pane keeps
  // its start visible).
  if (right > paneWidth - marginPx) return Math.max(paneWidth - marginPx - right, marginPx - left);
  return 0;
}

/** Drops the routes that start or end at `position` (a table there has moved, so they no longer fit). */
export function dropRoutesAt(
  routes: Record<string, EdgeRoute> | undefined,
  position: Position,
): Record<string, EdgeRoute> | undefined {
  if (!routes) return routes;
  const kept = Object.entries(routes).filter(
    ([, r]) => !samePosition(r.sourceAt, position) && !samePosition(r.targetAt, position),
  );
  return kept.length === Object.keys(routes).length ? routes : Object.fromEntries(kept);
}

/**
 * The SVG path of a relationship edge, shared by the canvas and the image export. A self-reference
 * loops out of the left side and back into the referenced row; otherwise the auto-layout route
 * (when still valid) is smoothed through, so all edges share one curve style (QA-001).
 */
export function edgePath(
  selfReference: boolean,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  route: { waypoints: Position[] } | null,
): string {
  if (selfReference) {
    const loop = 56;
    return `M ${sourceX} ${sourceY} C ${sourceX - loop} ${sourceY}, ${sourceX - loop} ${targetY}, ${sourceX} ${targetY}`;
  }
  return segmentsToPath(
    routeSegments([
      { x: sourceX, y: sourceY },
      ...(route?.waypoints ?? []),
      { x: targetX, y: targetY },
    ]),
  );
}
