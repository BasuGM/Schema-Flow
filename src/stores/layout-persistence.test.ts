// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiagramLayout, Schema } from "@/domain/schema/types";
import { fingerprintSchema } from "@/domain/schema/fingerprint";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { FakeStorage, installStorage } from "@/test/fake-storage";
import {
  clearSavedLayouts,
  discardPendingSaves,
  flushPendingSaves,
  LAYOUT_INDEX_KEY,
  LAYOUT_KEY_PREFIX,
  loadLayout,
  MAX_SAVED_LAYOUTS,
  SAVE_DELAY_MS,
  saveLayout,
  scheduleSave,
} from "./layout-persistence";

const schema = createEcommerceSchema();
const fp = fingerprintSchema(schema);

function layoutFor(s: Schema, fingerprint: string, dx = 0): DiagramLayout {
  return {
    fingerprint,
    positions: Object.fromEntries(s.tableOrder.map((id, i) => [id, { x: i * 10 + dx, y: i }])),
    collapsed: {},
    direction: "LR",
  };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  discardPendingSaves();
  vi.useRealTimers();
});

describe("layout persistence", () => {
  it("round-trips a layout including a viewport", () => {
    saveLayout({ ...layoutFor(schema, fp, 5), viewport: { x: 1, y: 2, zoom: 0.5 } });
    const loaded = loadLayout(schema, fp);
    expect(loaded?.positions[schema.tableOrder[0]!]).toEqual({ x: 5, y: 0 });
    expect(loaded?.viewport).toEqual({ x: 1, y: 2, zoom: 0.5 });
  });

  it("returns null for nothing, corrupt JSON, a missing table or a bad position", () => {
    expect(loadLayout(schema, fp)).toBeNull();
    localStorage.setItem(LAYOUT_KEY_PREFIX + fp, "{not json");
    expect(loadLayout(schema, fp)).toBeNull();
    const partial = layoutFor(schema, fp);
    delete partial.positions[schema.tableOrder[0]!];
    saveLayout(partial);
    expect(loadLayout(schema, fp)).toBeNull();
    const bad = layoutFor(schema, fp);
    bad.positions[schema.tableOrder[0]!] = { x: Number.NaN, y: 0 };
    localStorage.setItem(LAYOUT_KEY_PREFIX + fp, JSON.stringify({ ...bad, direction: "LR" }));
    expect(loadLayout(schema, fp)).toBeNull();
  });

  it("a different schema does not inherit positions (AC-P3-T01-6)", () => {
    saveLayout(layoutFor(schema, fp));
    const other = createEcommerceSchema();
    const removed = other.tableOrder.pop()!;
    delete other.tables[removed];
    const otherFp = fingerprintSchema(other);
    expect(otherFp).not.toBe(fp);
    expect(loadLayout(other, otherFp)).toBeNull();
  });

  it("drops entries for tables the schema no longer has and invalid routes", () => {
    const stored = layoutFor(schema, fp);
    stored.positions["ghost"] = { x: 1, y: 1 };
    const [relId, rel] = Object.entries(schema.relationships)[0]!;
    const from = stored.positions[rel.from.tableId]!;
    const to = stored.positions[rel.to.tableId]!;
    stored.edgeRoutes = {
      [relId]: { waypoints: [{ x: 1, y: 1 }], sourceAt: from, targetAt: { x: to.x + 99, y: to.y } },
      nope: { waypoints: [], sourceAt: from, targetAt: to },
    };
    saveLayout(stored);
    const loaded = loadLayout(schema, fp);
    expect(loaded?.positions["ghost"]).toBeUndefined();
    expect(loaded?.edgeRoutes).toEqual({});
  });

  it("keeps a route whose ends still sit where it was computed", () => {
    const stored = layoutFor(schema, fp);
    const [relId, rel] = Object.entries(schema.relationships)[0]!;
    stored.edgeRoutes = {
      [relId]: {
        waypoints: [{ x: 1, y: 1 }],
        sourceAt: stored.positions[rel.from.tableId]!,
        targetAt: stored.positions[rel.to.tableId]!,
      },
    };
    saveLayout(stored);
    expect(Object.keys(loadLayout(schema, fp)?.edgeRoutes ?? {})).toEqual([relId]);
  });

  it("saves without edge routes when the layout is huge", () => {
    const stored = layoutFor(schema, fp);
    const [relId, rel] = Object.entries(schema.relationships)[0]!;
    stored.edgeRoutes = {
      [relId]: {
        waypoints: Array.from({ length: 200_000 }, (_, i) => ({ x: i, y: i })),
        sourceAt: stored.positions[rel.from.tableId]!,
        targetAt: stored.positions[rel.to.tableId]!,
      },
    };
    saveLayout(stored);
    expect(loadLayout(schema, fp)?.edgeRoutes).toEqual({});
  });
});

describe("eviction", () => {
  const fps = Array.from({ length: MAX_SAVED_LAYOUTS + 1 }, (_, i) => `sf1-f${i}`);
  const stored = (name: string) => localStorage.getItem(LAYOUT_KEY_PREFIX + name);

  it("keeps the 20 most recently used layouts", () => {
    for (const name of fps.slice(0, MAX_SAVED_LAYOUTS)) saveLayout(layoutFor(schema, name));
    saveLayout(layoutFor(schema, fps[MAX_SAVED_LAYOUTS]!));
    expect(stored(fps[0]!)).toBeNull();
    expect(stored(fps[1]!)).not.toBeNull();
    expect(stored(fps[MAX_SAVED_LAYOUTS]!)).not.toBeNull();
  });

  it("a layout that is opened but never saved again survives (AC lastUsed on load)", () => {
    saveLayout(layoutFor(schema, "sf1-a"));
    for (const name of fps.slice(1, MAX_SAVED_LAYOUTS)) saveLayout(layoutFor(schema, name));
    expect(loadLayout(schema, "sf1-a")).not.toBeNull();
    for (let i = 0; i < 5; i++) saveLayout(layoutFor(schema, `sf1-new${i}`));
    expect(stored("sf1-a")).not.toBeNull();
    expect(stored(fps[1]!)).toBeNull();
  });

  it("rebuilds from the keys when the index is missing or corrupt", () => {
    for (const name of fps.slice(0, MAX_SAVED_LAYOUTS)) saveLayout(layoutFor(schema, name));
    localStorage.removeItem(LAYOUT_INDEX_KEY);
    saveLayout(layoutFor(schema, "sf1-extra"));
    expect(Object.keys(localStorage).filter((k) => k.startsWith(LAYOUT_KEY_PREFIX)).length).toBe(
      MAX_SAVED_LAYOUTS,
    );
    localStorage.setItem(LAYOUT_INDEX_KEY, "garbage");
    saveLayout(layoutFor(schema, "sf1-extra2"));
    expect(Object.keys(localStorage).filter((k) => k.startsWith(LAYOUT_KEY_PREFIX)).length).toBe(
      MAX_SAVED_LAYOUTS,
    );
    expect(stored("sf1-extra2")).not.toBeNull();
  });

  it("clearSavedLayouts removes layouts and the index", () => {
    saveLayout(layoutFor(schema, fp));
    clearSavedLayouts();
    expect(localStorage.length).toBe(0);
  });
});

describe("storage failures", () => {
  it("on quota evicts the oldest other layouts until the write fits, never the saved one", () => {
    const one = JSON.stringify(layoutFor(schema, "sf1-a")).length + LAYOUT_KEY_PREFIX.length + 8;
    const restore = installStorage(new FakeStorage(one * 3 + 400));
    try {
      for (const name of ["sf1-a", "sf1-b", "sf1-c", "sf1-d", "sf1-e"])
        saveLayout(layoutFor(schema, name));
      expect(window.localStorage.getItem(LAYOUT_KEY_PREFIX + "sf1-e")).not.toBeNull();
      expect(window.localStorage.getItem(LAYOUT_KEY_PREFIX + "sf1-a")).toBeNull();
    } finally {
      restore();
    }
  });

  it("gives up silently when even an empty storage is too small", () => {
    const restore = installStorage(new FakeStorage(10));
    try {
      expect(() => saveLayout(layoutFor(schema, fp))).not.toThrow();
      expect(loadLayout(schema, fp)).toBeNull();
    } finally {
      restore();
    }
  });

  const failing: [string, () => Storage][] = [
    [
      "getItem throws",
      () =>
        ({
          ...new FakeStorage(),
          getItem: () => {
            throw new Error("x");
          },
          key: () => null,
          length: 0,
        }) as unknown as Storage,
    ],
    [
      "setItem throws",
      () =>
        ({
          getItem: () => null,
          setItem: () => {
            throw new Error("x");
          },
          removeItem: () => undefined,
          key: () => null,
          length: 0,
        }) as unknown as Storage,
    ],
  ];
  for (const [name, make] of failing) {
    it(`never throws when ${name}`, () => {
      const restore = installStorage(make());
      try {
        expect(() => saveLayout(layoutFor(schema, fp))).not.toThrow();
        expect(loadLayout(schema, fp)).toBeNull();
      } finally {
        restore();
      }
    });
  }

  it("never throws when the localStorage getter throws (SecurityError)", () => {
    const restore = installStorage(() => {
      throw new DOMException("denied", "SecurityError");
    });
    try {
      expect(() => saveLayout(layoutFor(schema, fp))).not.toThrow();
      expect(loadLayout(schema, fp)).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("debounced saves", () => {
  it("writes once after the quiet period, with the latest layout", () => {
    vi.useFakeTimers();
    let current = layoutFor(schema, fp, 1);
    scheduleSave(fp, () => current);
    current = layoutFor(schema, fp, 2);
    scheduleSave(fp, () => current);
    vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
    expect(localStorage.getItem(LAYOUT_KEY_PREFIX + fp)).toBeNull();
    vi.advanceTimersByTime(2);
    expect(loadLayout(schema, fp)?.positions[schema.tableOrder[0]!]?.x).toBe(2);
  });

  it("flushes pending saves on pagehide and when the page becomes hidden", () => {
    vi.useFakeTimers();
    scheduleSave(fp, () => layoutFor(schema, fp, 7));
    window.dispatchEvent(new Event("pagehide"));
    expect(loadLayout(schema, fp)?.positions[schema.tableOrder[0]!]?.x).toBe(7);
    localStorage.clear();
    scheduleSave(fp, () => layoutFor(schema, fp, 8));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "visibilityState");
    expect(loadLayout(schema, fp)?.positions[schema.tableOrder[0]!]?.x).toBe(8);
    flushPendingSaves();
  });
});
