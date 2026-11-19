// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fingerprintSchema } from "@/domain/schema/fingerprint";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { discardPendingSaves, flushPendingSaves, loadLayout } from "./layout-persistence";
import { useLayoutStore } from "./layout-store";

const schema = createEcommerceSchema();
const fp = fingerprintSchema(schema);
const [first, second] = schema.tableOrder as [string, string];
const state = () => useLayoutStore.getState().layouts[fp]!;

beforeEach(() => {
  localStorage.clear();
  discardPendingSaves();
  useLayoutStore.setState({ layouts: {}, version: 0 });
  useLayoutStore.getState().ensureLayout(schema, fp);
});

describe("setCollapse", () => {
  it("stores keys/header and removes the entry for full (sparse map)", () => {
    const { setCollapse } = useLayoutStore.getState();
    setCollapse(fp, first, "keys");
    expect(state().collapsed).toEqual({ [first]: "keys" });
    setCollapse(fp, first, "header");
    expect(state().collapsed).toEqual({ [first]: "header" });
    setCollapse(fp, first, "full");
    expect(state().collapsed).toEqual({});
  });

  it("keeps positions and does not bump the layout version", () => {
    const before = state().positions;
    const version = useLayoutStore.getState().version;
    useLayoutStore.getState().setCollapse(fp, first, "header");
    expect(state().positions).toBe(before);
    expect(useLayoutStore.getState().version).toBe(version);
  });

  it("drops only the routes that touch the table", () => {
    const at = state().positions[first]!;
    const other = state().positions[second]!;
    const route = (a: typeof at, b: typeof at) => ({ waypoints: [], sourceAt: a, targetAt: b });
    useLayoutStore.setState((s) => ({
      layouts: {
        ...s.layouts,
        [fp]: {
          ...s.layouts[fp]!,
          edgeRoutes: {
            touching: route(at, { x: -9, y: -9 }),
            away: route(other, { x: -8, y: -8 }),
          },
        },
      },
    }));
    useLayoutStore.getState().setCollapse(fp, first, "keys");
    expect(Object.keys(state().edgeRoutes ?? {})).toEqual(["away"]);
  });

  it("is a no-op for an unchanged mode or an unknown fingerprint", () => {
    const before = state();
    useLayoutStore.getState().setCollapse(fp, first, "full");
    expect(state()).toBe(before);
    useLayoutStore.getState().setCollapse("nope", first, "keys");
    expect(useLayoutStore.getState().layouts["nope"]).toBeUndefined();
  });

  it("persists and round-trips through loadLayout", () => {
    useLayoutStore.getState().setCollapse(fp, first, "keys");
    flushPendingSaves();
    expect(loadLayout(schema, fp)?.collapsed).toEqual({ [first]: "keys" });
  });
});

describe("setAllCollapse", () => {
  it("sets every table, clears routes, and full empties the map", () => {
    useLayoutStore.getState().setAllCollapse(schema, fp, "header");
    expect(Object.keys(state().collapsed)).toHaveLength(schema.tableOrder.length);
    expect(Object.values(state().collapsed).every((m) => m === "header")).toBe(true);
    expect(state().edgeRoutes).toBeUndefined();
    useLayoutStore.getState().setAllCollapse(schema, fp, "full");
    expect(state().collapsed).toEqual({});
  });
});
