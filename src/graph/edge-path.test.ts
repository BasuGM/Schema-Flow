import { describe, expect, it } from "vitest";
import {
  labelOverflowShift,
  labelTransform,
  routeSegments,
  samePosition,
  segmentsToPath,
} from "./edge-path";

describe("routeSegments / segmentsToPath", () => {
  it("builds one cubic per consecutive point pair with horizontal tangents", () => {
    const segs = routeSegments([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 50 },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({
      from: { x: 0, y: 0 },
      c1: { x: 50, y: 0 },
      c2: { x: 50, y: 50 },
      to: { x: 100, y: 50 },
    });
    expect(segmentsToPath(segs)).toBe("M 0 0 C 50 0, 50 50, 100 50 C 150 50, 150 50, 200 50");
  });

  it("returns an empty path for fewer than two points", () => {
    expect(segmentsToPath(routeSegments([{ x: 1, y: 1 }]))).toBe("");
  });
});

describe("samePosition", () => {
  it("compares with a small tolerance and rejects missing values", () => {
    expect(samePosition({ x: 1, y: 1 }, { x: 1.4, y: 0.7 })).toBe(true);
    expect(samePosition({ x: 1, y: 1 }, { x: 3, y: 1 })).toBe(false);
    expect(samePosition(undefined, { x: 0, y: 0 })).toBe(false);
  });
});

describe("labelTransform (QA-005)", () => {
  it("counter-scales by 1/zoom so labels keep a constant on-screen size", () => {
    expect(labelTransform({ x: 100, y: 40 }, "left", 1)).toBe(
      "translate(100px, 40px) scale(1) translate(-12px, 0) translate(-100%, -50%)",
    );
    expect(labelTransform({ x: 100, y: 40 }, "left", 0.354)).toContain("scale(2.825)");
    expect(labelTransform({ x: 100, y: 40 }, "left", 0.05)).toContain("scale(20)");
  });

  it("places the label outside the FK handle on the side the edge leaves from", () => {
    expect(labelTransform({ x: 0, y: 0 }, "right", 2, 8)).toBe(
      "translate(0px, 0px) scale(0.5) translate(8px, 0) translate(0%, -50%)",
    );
  });

  it("falls back to scale 1 for an invalid zoom", () => {
    expect(labelTransform({ x: 0, y: 0 }, "left", 0)).toContain("scale(1)");
    expect(labelTransform({ x: 0, y: 0 }, "left", Number.NaN)).toContain("scale(1)");
  });
});

describe("labelOverflowShift (QA-006)", () => {
  const base = { gapPx: 52, widthPx: 405, paneWidth: 900 };

  it("shifts a left-side label right so it is not clipped under the left panel", () => {
    // Cowork repro: categories self-loop after Fit view, label left edge ~76 px left of the pane.
    const shift = labelOverflowShift({ ...base, anchorScreenX: 381, side: "left" });
    expect(shift).toBe(8 - (381 - 52 - 405));
    expect(381 - 52 - 405 + shift).toBe(8);
  });

  it("shifts a right-side label left at the right edge, never past the left margin", () => {
    expect(labelOverflowShift({ ...base, anchorScreenX: 700, side: "right" })).toBe(
      900 - 8 - (700 + 52 + 405),
    );
    expect(labelOverflowShift({ ...base, paneWidth: 300, anchorScreenX: 10, side: "right" })).toBe(
      8 - (10 + 52),
    );
  });

  it("leaves fitting labels alone and ignores unknown sizes", () => {
    expect(labelOverflowShift({ ...base, anchorScreenX: 600, side: "left" })).toBe(0);
    expect(labelOverflowShift({ ...base, paneWidth: 0, anchorScreenX: 0, side: "left" })).toBe(0);
    expect(labelOverflowShift({ ...base, widthPx: 0, anchorScreenX: 0, side: "left" })).toBe(0);
  });

  it("is applied as a trailing screen-pixel translate", () => {
    expect(labelTransform({ x: 0, y: 0 }, "left", 0.5, 12, 76)).toBe(
      "translate(0px, 0px) scale(2) translate(-12px, 0) translate(-100%, -50%) translate(76px, 0)",
    );
    expect(labelTransform({ x: 0, y: 0 }, "left", 0.5, 12, 0)).not.toContain("76");
  });
});
