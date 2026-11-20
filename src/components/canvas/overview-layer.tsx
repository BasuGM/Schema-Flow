"use client";

import { useReactFlow, useStore, useStoreApi } from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DiagramGeometry } from "@/generators/diagram-geometry";
import { DEFAULT_DARK_PALETTE, DEFAULT_LIGHT_PALETTE } from "@/generators/export-palette";
import { resolveExportPalette } from "@/lib/export-palette";
import { useUiStore } from "@/stores/ui-store";

const HEADER_HEIGHT = 36;
const MINIMAP = { width: 200, height: 150 };

interface Paths {
  body: Path2D;
  header: Path2D;
  edge: Path2D;
}

/** Everything, built once per layout: parsing 3,000 edge paths on every selection is too slow. */
interface Cache {
  all: Paths;
  edgePaths: Map<string, Path2D>;
}

function buildCache(geometry: DiagramGeometry): Cache {
  const all: Paths = { body: new Path2D(), header: new Path2D(), edge: new Path2D() };
  for (const t of geometry.tables) {
    all.body.rect(t.x, t.y, t.w, t.h);
    all.header.rect(t.x, t.y, t.w, Math.min(HEADER_HEIGHT, t.h));
  }
  const edgePaths = new Map<string, Path2D>();
  for (const e of geometry.edges) {
    const path = new Path2D(e.d);
    edgePaths.set(e.id, path);
    all.edge.addPath(path);
  }
  return { all, edgePaths };
}

/** The tables and edges inside the focus set (small next to the whole diagram). */
function buildFocused(geometry: DiagramGeometry, cache: Cache, focus: ReadonlySet<string>): Paths {
  const paths: Paths = { body: new Path2D(), header: new Path2D(), edge: new Path2D() };
  for (const t of geometry.tables) {
    if (!focus.has(t.id)) continue;
    paths.body.rect(t.x, t.y, t.w, t.h);
    paths.header.rect(t.x, t.y, t.w, Math.min(HEADER_HEIGHT, t.h));
  }
  for (const e of geometry.edges) {
    if (focus.has(e.from) && focus.has(e.to)) paths.edge.addPath(cache.edgePaths.get(e.id)!);
  }
  return paths;
}

/**
 * The zoomed-out view of a large schema on one `<canvas>` (P3-T07, ADR-031): every table is a few
 * filled rectangles instead of a DOM subtree, so selecting and panning stay cheap. Mounted only
 * while the overview is active, from the same geometry the SVG export uses. Decorative
 * (`aria-hidden`); the table list is the accessible path. `pointer-events: none`, so React Flow's
 * pane still pans, zooms and receives clicks.
 */
export function OverviewLayer({ geometry }: { geometry: DiagramGeometry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flow = useStoreApi();
  const focusSet = useUiStore((s) => s.focusSet);
  const selectedId = useUiStore((s) => s.selectedTableId);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const cache = useMemo(() => buildCache(geometry), [geometry]);
  const focused = useMemo(
    () => (focusSet ? buildFocused(geometry, cache, focusSet) : null),
    [geometry, cache, focusSet],
  );
  const paths = cache.all;
  const palette = useMemo(() => {
    try {
      return resolveExportPalette(dark ? "dark" : "light");
    } catch {
      return dark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE;
    }
  }, [dark]);
  const selected = useMemo(
    () => geometry.tables.find((t) => t.id === selectedId) ?? null,
    [geometry, selectedId],
  );
  const dimNode = dark ? 0.4 : 0.3;
  const dimEdge = dark ? 0.25 : 0.15;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { transform, width, height } = flow.getState();
    const [tx, ty, zoom] = transform;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * tx, dpr * ty);
    ctx.lineWidth = 1 / zoom;
    ctx.lineJoin = "round";

    // With a focus set everything is drawn dimmed first and the focused part on top.
    const layers: [Paths, number, number][] = focused
      ? [
          [cache.all, dimNode, dimEdge],
          [focused, 1, 1],
        ]
      : [[cache.all, 1, 1]];
    for (const [layer, nodeAlpha, edgeAlpha] of layers) {
      ctx.globalAlpha = edgeAlpha;
      ctx.strokeStyle = palette.edge;
      ctx.stroke(layer.edge);
      ctx.globalAlpha = nodeAlpha;
      ctx.fillStyle = palette.card;
      ctx.fill(layer.body);
      ctx.fillStyle = palette.muted;
      ctx.fill(layer.header);
      ctx.strokeStyle = palette.border;
      ctx.stroke(layer.body);
    }
    ctx.globalAlpha = 1;
    if (selected) {
      ctx.strokeStyle = palette.fk;
      ctx.lineWidth = 3 / zoom;
      ctx.strokeRect(selected.x, selected.y, selected.w, selected.h);
    }
    canvas.dataset.tablesDrawn = String(geometry.tables.length);
    canvas.dataset.edgesDrawn = String(geometry.edges.length);
    canvas.dataset.selectedId = selected?.id ?? "";
    canvas.dataset.selectedHeight = selected ? String(selected.h) : "";
  }, [flow, cache, focused, palette, selected, geometry, dimNode, dimEdge]);

  // Redraw when the viewport or canvas size changes (coalesced to one draw per frame) and
  // whenever the drawing inputs change.
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
    };
    draw();
    const unsubscribe = flow.subscribe((s, prev) => {
      if (s.transform !== prev.transform || s.width !== prev.width || s.height !== prev.height)
        schedule();
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [flow, draw]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-testid="canvas-overview"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      />
      <p role="status" className="sr-only">
        Overview: {geometry.tables.length} tables drawn as a picture. Zoom in or use the table list.
      </p>
      <OverviewMiniMap geometry={geometry} paths={paths} palette={palette} />
    </>
  );
}

/**
 * React Flow's MiniMap draws from measured DOM nodes, which are hidden in the overview and would
 * leave it blank (R8). This draws the same geometry at thumbnail size, plus the viewport frame;
 * clicking it centres the view there.
 */
function OverviewMiniMap({
  geometry,
  paths,
  palette,
}: {
  geometry: DiagramGeometry;
  paths: Paths;
  palette: { card: string; border: string; canvas: string; fk: string; muted: string };
}) {
  const show = useUiStore((s) => s.showMiniMap);
  const ref = useRef<HTMLCanvasElement>(null);
  const flow = useStoreApi();
  const { setCenter, getZoom } = useReactFlow();
  const { bounds } = geometry;
  const scale = Math.min(MINIMAP.width / bounds.width, MINIMAP.height / bounds.height);
  const originX = (MINIMAP.width - bounds.width * scale) / 2 - bounds.minX * scale;
  const originY = (MINIMAP.height - bounds.height * scale) / 2 - bounds.minY * scale;
  const flowWidth = useStore((s) => s.width);

  useEffect(() => {
    if (!show) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = MINIMAP.width * dpr;
      canvas.height = MINIMAP.height * dpr;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * originX, dpr * originY);
      ctx.fillStyle = palette.muted;
      ctx.fill(paths.header);
      ctx.fillStyle = palette.border;
      ctx.fill(paths.body);
      const [tx, ty, zoom] = flow.getState().transform;
      const { width, height } = flow.getState();
      ctx.strokeStyle = palette.fk;
      ctx.lineWidth = 2 / scale;
      ctx.strokeRect(-tx / zoom, -ty / zoom, width / zoom, height / zoom);
    };
    paint();
    return flow.subscribe((s, prev) => {
      if (s.transform !== prev.transform && !frame) frame = requestAnimationFrame(paint);
    });
  }, [show, flow, paths, palette, scale, originX, originY, flowWidth]);

  if (!show) return null;
  return (
    <canvas
      ref={ref}
      data-testid="canvas-overview-minimap"
      aria-label="Diagram overview"
      role="img"
      style={{ width: MINIMAP.width, height: MINIMAP.height, background: palette.canvas }}
      className="absolute right-4 bottom-4 z-[5] cursor-pointer rounded-md border border-border shadow-sm"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - originX) / scale;
        const y = (e.clientY - rect.top - originY) / scale;
        void setCenter(x, y, { zoom: getZoom(), duration: 0 });
      }}
    />
  );
}
