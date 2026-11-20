import { describe, expect, it } from "vitest";
import { fitViewport, fitZoom, nextOverviewState, OVERVIEW_TABLES } from "./overview";

describe("nextOverviewState", () => {
  it("never activates below the table threshold", () => {
    expect(nextOverviewState(true, 0.1, OVERVIEW_TABLES - 1)).toBe(false);
  });
  it("enters below 0.28, leaves above 0.32 and keeps its state in between", () => {
    expect(nextOverviewState(false, 0.27, 500)).toBe(true);
    expect(nextOverviewState(true, 0.33, 500)).toBe(false);
    expect(nextOverviewState(true, 0.3, 500)).toBe(true);
    expect(nextOverviewState(false, 0.3, 500)).toBe(false);
  });
  it("does not flip back and forth for a zoom wobbling inside the band", () => {
    let state = false;
    for (const z of [0.4, 0.31, 0.29, 0.31, 0.29, 0.27, 0.31, 0.29, 0.3]) {
      state = nextOverviewState(state, z, 992);
    }
    expect(state).toBe(true);
  });
});

describe("fitViewport", () => {
  const size = { width: 1000, height: 600 };
  it("fits a wide box and centres it", () => {
    const v = fitViewport({ x: 0, y: 0, width: 10000, height: 2000 }, size, 0.15);
    expect(v.zoom).toBeCloseTo(700 / 10000);
    expect(v.x).toBeCloseTo(150);
  });
  it("caps at 1 and floors at 0.05", () => {
    expect(fitZoom({ x: 0, y: 0, width: 100, height: 100 }, size, 0.15)).toBe(1);
    expect(fitZoom({ x: 0, y: 0, width: 1e6, height: 10 }, size, 0.15)).toBe(0.05);
  });
  it("accepts per-side padding", () => {
    const v = fitViewport({ x: 0, y: 0, width: 100, height: 100 }, size, {
      top: 0.05,
      right: 0.06,
      bottom: 0.5,
      left: 0.06,
    });
    expect(v.zoom).toBeCloseTo(Math.min(880 / 100, 270 / 100, 1));
  });
});
