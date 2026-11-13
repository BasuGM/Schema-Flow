import type { Position } from "@/domain/schema/types";

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
): string {
  const scale = 1 / (zoom > 0 && Number.isFinite(zoom) ? zoom : 1);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const shift =
    side === "left"
      ? `translate(${-gapPx}px, 0) translate(-100%, -50%)`
      : `translate(${gapPx}px, 0) translate(0%, -50%)`;
  return `translate(${r(anchor.x)}px, ${r(anchor.y)}px) scale(${r(scale)}) ${shift}`;
}
