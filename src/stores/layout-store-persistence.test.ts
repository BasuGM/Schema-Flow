// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprintSchema } from "@/domain/schema/fingerprint";
import * as dagre from "@/graph/layout-dagre";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { discardPendingSaves, flushPendingSaves, LAYOUT_KEY_PREFIX } from "./layout-persistence";
import { useLayoutStore } from "./layout-store";
import { hydratePrefs, PREFS_KEY, useUiStore } from "./ui-store";

const schema = createEcommerceSchema();
const fp = fingerprintSchema(schema);
const first = schema.tableOrder[0]!;

/** A page reload: memory is gone, localStorage stays. */
function reload() {
  flushPendingSaves();
  useLayoutStore.setState({ layouts: {}, version: 0 });
}

beforeEach(() => {
  localStorage.clear();
  discardPendingSaves();
  useLayoutStore.setState({ layouts: {}, version: 0 });
  useUiStore.getState().reset();
});
afterEach(() => vi.restoreAllMocks());

describe("layout-store persistence", () => {
  it("restores a dragged position after a reload without running auto-layout (AC-P3-T01-1)", () => {
    useLayoutStore.getState().ensureLayout(schema, fp);
    useLayoutStore.getState().setPosition(fp, first, { x: 1234, y: 567 });
    reload();
    const layoutSpy = vi.spyOn(dagre, "layoutWithDagre");
    useLayoutStore.getState().ensureLayout(schema, fp);
    expect(useLayoutStore.getState().layouts[fp]?.positions[first]).toEqual({ x: 1234, y: 567 });
    expect(layoutSpy).not.toHaveBeenCalled();
  });

  it("relayout replaces the saved positions (AC-P3-T01-3)", () => {
    const store = useLayoutStore.getState();
    store.ensureLayout(schema, fp);
    const auto = useLayoutStore.getState().layouts[fp]!.positions[first];
    store.setPosition(fp, first, { x: 999, y: 999 });
    store.relayout(schema, fp);
    reload();
    useLayoutStore.getState().ensureLayout(schema, fp);
    expect(useLayoutStore.getState().layouts[fp]?.positions[first]).toEqual(auto);
  });

  it("a fresh layout is saved too, so a reload does not lay out again", () => {
    useLayoutStore.getState().ensureLayout(schema, fp);
    flushPendingSaves();
    expect(localStorage.getItem(LAYOUT_KEY_PREFIX + fp)).not.toBeNull();
  });

  it("moving a table drops the routes that started or ended at its old spot", () => {
    useLayoutStore.getState().ensureLayout(schema, fp);
    const routes = {
      r: {
        waypoints: [],
        sourceAt: useLayoutStore.getState().layouts[fp]!.positions[first]!,
        targetAt: { x: -5000, y: -5000 },
      },
    };
    useLayoutStore.setState((s) => ({
      layouts: { ...s.layouts, [fp]: { ...s.layouts[fp]!, edgeRoutes: routes } },
    }));
    useLayoutStore.getState().setPosition(fp, first, { x: 4000, y: 4000 });
    expect(useLayoutStore.getState().layouts[fp]?.edgeRoutes).toEqual({});
  });
});

describe("neighbourhood depth preference (AC-P3-T01-4)", () => {
  it("is saved when changed and applied by hydratePrefs", () => {
    useUiStore.getState().setNeighbourhoodDepth(2);
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toEqual({ neighbourhoodDepth: 2 });
    useUiStore.getState().reset();
    expect(useUiStore.getState().neighbourhoodDepth).toBe(1);
    hydratePrefs();
    expect(useUiStore.getState().neighbourhoodDepth).toBe(2);
  });

  it("ignores invalid saved values and corrupt JSON", () => {
    for (const raw of ['{"neighbourhoodDepth":7}', "[]", "nope", '{"neighbourhoodDepth":"2"}']) {
      localStorage.setItem(PREFS_KEY, raw);
      useUiStore.getState().reset();
      hydratePrefs();
      expect(useUiStore.getState().neighbourhoodDepth).toBe(1);
    }
  });
});
