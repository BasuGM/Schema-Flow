import { create } from "zustand";
import type {
  DiagramLayout,
  LayoutDirection,
  Position,
  Schema,
  TableId,
  Viewport,
} from "@/domain/schema/types";
import { layoutWithDagre } from "@/graph/layout-dagre";

interface LayoutState {
  /** Keyed by schema fingerprint. Persisted to localStorage in Phase 3 (P3-T01). */
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

export const useLayoutStore = create<LayoutState>()((set, get) => ({
  layouts: {},
  version: 0,
  ensureLayout: (schema, fingerprint) => {
    if (get().layouts[fingerprint]) return;
    set((s) => ({
      layouts: { ...s.layouts, [fingerprint]: computeLayout(schema, fingerprint) },
      version: s.version + 1,
    }));
  },
  relayout: (schema, fingerprint, direction) =>
    set((s) => ({
      layouts: {
        ...s.layouts,
        [fingerprint]: computeLayout(schema, fingerprint, s.layouts[fingerprint], direction),
      },
      version: s.version + 1,
    })),
  setPosition: (fingerprint, table, position) =>
    set((s) => {
      const layout = s.layouts[fingerprint];
      if (!layout) return s;
      return {
        layouts: {
          ...s.layouts,
          [fingerprint]: { ...layout, positions: { ...layout.positions, [table]: position } },
        },
      };
    }),
  setViewport: (fingerprint, viewport) =>
    set((s) => {
      const layout = s.layouts[fingerprint];
      if (!layout) return s;
      return { layouts: { ...s.layouts, [fingerprint]: { ...layout, viewport } } };
    }),
}));
