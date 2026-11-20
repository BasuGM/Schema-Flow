import { create } from "zustand";
import type {
  CollapseMode,
  DiagramLayout,
  LayoutDirection,
  Position,
  Schema,
  TableId,
  Viewport,
} from "@/domain/schema/types";
import { dropRoutesAt } from "@/graph/edge-path";
import { layoutPacked } from "@/graph/layout-packed";
import { loadLayout, scheduleSave } from "./layout-persistence";

interface LayoutState {
  /** Keyed by schema fingerprint. Saved to localStorage per fingerprint (layout-persistence). */
  layouts: Record<string, DiagramLayout>;
  /** Bumped whenever positions are replaced wholesale (auto-layout); the canvas resyncs on change. */
  version: number;
  /**
   * One-shot, set only by a session restore: the saved pan and zoom the canvas opens with instead
   * of fitting the view. The canvas consumes it (`takePendingViewport`).
   */
  pendingViewport: Viewport | null;
  /** Queues the viewport saved with this fingerprint's layout, if there is one. */
  queueSavedViewport: (fingerprint: string) => void;
  takePendingViewport: () => Viewport | null;
  /** "Clear saved data": forget every in-memory layout. */
  resetAll: () => void;
  ensureLayout: (schema: Schema, fingerprint: string) => void;
  relayout: (schema: Schema, fingerprint: string, direction?: LayoutDirection) => void;
  setPosition: (fingerprint: string, table: TableId, position: Position) => void;
  setViewport: (fingerprint: string, viewport: Viewport) => void;
  /** One table's collapse mode. Positions stay; expanding can overlap neighbours until Layout. */
  setCollapse: (fingerprint: string, table: TableId, mode: CollapseMode) => void;
  /** Every table's collapse mode at once. */
  setAllCollapse: (schema: Schema, fingerprint: string, mode: CollapseMode) => void;
}

function computeLayout(
  schema: Schema,
  fingerprint: string,
  prev?: DiagramLayout,
  direction?: LayoutDirection,
): DiagramLayout {
  const dir = direction ?? prev?.direction ?? "LR";
  const collapsed = prev?.collapsed ?? {};
  const { positions, edgeRoutes } = layoutPacked(schema, { direction: dir, collapsed });
  return {
    fingerprint,
    positions,
    edgeRoutes,
    collapsed,
    direction: dir,
    ...(prev?.viewport ? { viewport: prev.viewport } : {}),
  };
}

/** The layout with `edgeRoutes` replaced; the key is absent when there are none. */
function withRoutes(layout: DiagramLayout, edgeRoutes: DiagramLayout["edgeRoutes"]): DiagramLayout {
  const copy: DiagramLayout = { ...layout };
  if (edgeRoutes) copy.edgeRoutes = edgeRoutes;
  else delete copy.edgeRoutes;
  return copy;
}

export const useLayoutStore = create<LayoutState>()((set, get) => {
  const save = (fingerprint: string) => scheduleSave(fingerprint, () => get().layouts[fingerprint]);

  return {
    layouts: {},
    version: 0,
    pendingViewport: null,
    queueSavedViewport: (fingerprint) => {
      const viewport = get().layouts[fingerprint]?.viewport;
      if (viewport) set({ pendingViewport: viewport });
    },
    takePendingViewport: () => {
      const viewport = get().pendingViewport;
      if (viewport) set({ pendingViewport: null });
      return viewport;
    },
    resetAll: () => set((s) => ({ layouts: {}, pendingViewport: null, version: s.version + 1 })),
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
    setCollapse: (fingerprint, table, mode) => {
      const layout = get().layouts[fingerprint];
      if (!layout || (layout.collapsed[table] ?? "full") === mode) return;
      // "full" is the default, so it is stored as absence and the map stays sparse.
      const collapsed = { ...layout.collapsed };
      if (mode === "full") delete collapsed[table];
      else collapsed[table] = mode;
      // Row handles move with the mode, so routes that end at this table no longer fit.
      const at = layout.positions[table];
      const edgeRoutes = at ? dropRoutesAt(layout.edgeRoutes, at) : layout.edgeRoutes;
      set((s) => ({
        layouts: { ...s.layouts, [fingerprint]: withRoutes({ ...layout, collapsed }, edgeRoutes) },
      }));
      save(fingerprint);
    },
    setAllCollapse: (schema, fingerprint, mode) => {
      const layout = get().layouts[fingerprint];
      if (!layout) return;
      const collapsed: Record<TableId, CollapseMode> = {};
      if (mode !== "full") for (const id of schema.tableOrder) collapsed[id] = mode;
      set((s) => ({
        layouts: { ...s.layouts, [fingerprint]: withRoutes({ ...layout, collapsed }, undefined) },
      }));
      save(fingerprint);
    },
  };
});
