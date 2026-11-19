import { describe, expect, it } from "vitest";
import { MAX_AREA, MAX_SIDE, exportFileName, rasterSize } from "./raster-size";

describe("rasterSize", () => {
  it("keeps the requested scale for small diagrams", () => {
    expect(rasterSize(1200, 800, 2)).toEqual({
      scale: 2,
      pxWidth: 2400,
      pxHeight: 1600,
      reduced: false,
    });
  });

  it("rounds the pixel size once", () => {
    expect(rasterSize(1001, 333, 1).pxWidth).toBe(1001);
    expect(rasterSize(1001, 333, 2)).toMatchObject({ pxWidth: 2002, pxHeight: 666 });
  });

  it("reduces a tall GitLab-sized diagram to the side limit", () => {
    const r = rasterSize(5000, 242_000, 2);
    expect(r.reduced).toBe(true);
    expect(r.scale).toBeLessThan(0.07);
    expect(r.pxHeight).toBeLessThanOrEqual(MAX_SIDE);
    expect(r.pxWidth * r.pxHeight).toBeLessThanOrEqual(MAX_AREA);
  });

  it("reduces a wide-but-short diagram by the area cap, not the side cap", () => {
    const r = rasterSize(12_000, 3_000, 2);
    expect(r.reduced).toBe(true);
    expect(r.pxWidth).toBeLessThan(MAX_SIDE);
    expect(MAX_SIDE / 12_000).toBeGreaterThan(r.scale);
    expect(r.pxWidth * r.pxHeight).toBeLessThanOrEqual(MAX_AREA);
    expect(r.pxWidth * r.pxHeight).toBeGreaterThan(MAX_AREA * 0.98);
  });

  it("never returns zero pixels", () => {
    expect(rasterSize(0, 0, 1)).toMatchObject({ pxWidth: 1, pxHeight: 1 });
  });
});

describe("exportFileName", () => {
  it("slugifies the schema name", () => {
    expect(exportFileName("My Shop (v2)", "svg")).toBe("my-shop-v2.svg");
    expect(exportFileName("  --  ", "png")).toBe("schema.png");
    expect(exportFileName("日本語", "png")).toBe("schema.png");
    expect(exportFileName("a".repeat(100), "png")).toBe(`${"a".repeat(60)}.png`);
  });
});
