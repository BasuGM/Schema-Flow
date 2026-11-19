import { create } from "zustand";
import type {
  DiagramLayout,
  LayoutDirection,
  Position,
  Schema,
  TableId,
  Viewport,
} from "@/domain/schema/types";
import { dropRoutesAt } from "@/graph/edge-path";
import { layoutWithDagre } from "@/graph/layout-dagre";
import { loadLayout, scheduleSave } from "./layout-persistence";

interface LayoutState {
  /** Keyed by schema fingerprint. Saved to localStorage per fingerprint (layout-persistence). */
  layouts: Record<string, DiagramLayout>;
  /** Bumped whenever positions are replaced wholesale (auto-layout); the canvas resyncs on change. */
  version: number;
  ensureLayout: (schema: Schema, fingerprint: string) => void;
  relayout: (schema: Schema, fingerprint: string, direction?: LayoutDirection) => void;
  setPosition: (fingerprint: string, table: TableId, position: Position) => void;
  setViewport: (fingerprint: string, viewport: Viewport) => void;
}

function computeLayout(
  schema: Schema,
  fingerprint: string,
  prev?: DiagramLayout,
  direction?: LayoutDirection,
): DiagramLayout {
  const dir = direction ?? prev?.direction ?? "LR";
  const collapsed = prev?.collapsed ?? {};
  const { positions, edgeRoutes } = layoutWithDagre(schema, { direction: dir, collapsed });
  return {
    fingerprint,
    positions,
    edgeRoutes,
    collapsed,
    direction: dir,
    ...(prev?.viewport ? { viewport: prev.viewport } : {}),
  };
}

export const useLayoutStore = create<LayoutState>()((set, get) => {
  const save = (fingerprint: string) => scheduleSave(fingerprint, () => get().layouts[fingerprint]);

  return {
    layouts: {},
    version: 0,
    ensureLayout: (schema, fingerprint) => {
      if (get().layouts[fingerprint]) return;
      // A saved layout (an earlier visit or session) wins over running auto-layout again.
      const saved = loadLayout(schema, fingerprint);
      set((s) => ({
        layouts: { ...s.layouts, [fingerprint]: saved ?? computeLayout(schema, fingerprint) },
        version: s.version + 1,
      }));
      if (!saved) save(fingerprint);
    },
    relayout: (schema, fingerprint, direction) => {
      set((s) => ({
        layouts: {
          ...s.layouts,
          [fingerprint]: computeLayout(schema, fingerprint, s.layouts[fingerprint], direction),
        },
        version: s.version + 1,
      }));
      save(fingerprint);
    },
    setPosition: (fingerprint, table, position) => {
      const layout = get().layouts[fingerprint];
      if (!layout) return;
      const before = layout.positions[table];
      // Routes computed for the table's old spot no longer fit; the edge falls back to its default.
      const edgeRoutes = before ? dropRoutesAt(layout.edgeRoutes, before) : layout.edgeRoutes;
      set((s) => ({
        layouts: {
          ...s.layouts,
          [fingerprint]: {
            ...layout,
            positions: { ...layout.positions, [table]: position },
            ...(edgeRoutes ? { edgeRoutes } : {}),
          },
        },
      }));
      save(fingerprint);
    },
    setViewport: (fingerprint, viewport) => {
      const layout = get().layouts[fingerprint];
      if (!layout) return;
      set((s) => ({ layouts: { ...s.layouts, [fingerprint]: { ...layout, viewport } } }));
      save(fingerprint);
    },
  };
});
