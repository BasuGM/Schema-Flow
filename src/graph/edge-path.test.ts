import { describe, expect, it } from "vitest";
import { labelAnchor, routeSegments, samePosition, segmentsToPath } from "./edge-path";

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

describe("labelAnchor (QA-002)", () => {
  it("places the label outside the FK handle on the side the edge leaves from", () => {
    expect(labelAnchor({ x: 100, y: 40 }, "left")).toEqual({ x: 82, y: 40, translateX: "-100%" });
    expect(labelAnchor({ x: 100, y: 40 }, "right")).toEqual({ x: 118, y: 40, translateX: "0%" });
  });
});
