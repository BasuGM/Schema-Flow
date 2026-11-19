// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DARK_PALETTE, DEFAULT_LIGHT_PALETTE } from "@/generators/export-palette";
import { REVOKE_DELAY_MS, downloadBlob } from "./download";
import { resolveExportPalette } from "./export-palette";
import { measureText } from "./measure-text";
import { svgToPngBlob } from "./svg-to-png";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

function mockContext(pixel: (value: string) => number[]) {
  let fill = "";
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      if (v !== "bad") fill = v;
    },
    getImageData: () => ({ data: Uint8ClampedArray.from(pixel(fill)) }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
}

describe("resolveExportPalette", () => {
  it("falls back to the built-in palette when getContext returns null", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(resolveExportPalette("light")).toEqual(DEFAULT_LIGHT_PALETTE);
    expect(resolveExportPalette("dark")).toEqual(DEFAULT_DARK_PALETTE);
  });

  it("reads tokens, keeps alpha as rgba() and restores the theme class", () => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.setProperty("--card", "oklch(1 0 0)");
    document.documentElement.style.setProperty("--border", "oklch(1 0 0 / 11%)");
    mockContext((v) => (v.includes("/") ? [255, 255, 255, 28] : [255, 255, 255, 255]));
    const light = resolveExportPalette("light");
    expect(light.card).toBe("#ffffff");
    expect(light.border).toBe("rgba(255,255,255,0.11)");
    expect(light.canvas).toBe(DEFAULT_LIGHT_PALETTE.canvas);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps the fallback for a colour the canvas rejects", () => {
    document.documentElement.style.setProperty("--card", "bad");
    mockContext(() => [0, 0, 0, 255]);
    expect(resolveExportPalette("light").card).toBe(DEFAULT_LIGHT_PALETTE.card);
  });
});

describe("measureText", () => {
  it("falls back to an estimate when there is no canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(measureText("users", { family: "sans", size: 12, weight: 400 })).toBeGreaterThan(0);
  });
});

describe("downloadBlob", () => {
  it("clicks a download link and revokes the URL only after a delay", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["a"]), "shop.svg");
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(revoke).toHaveBeenCalledWith("blob:x");
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

describe("svgToPngBlob", () => {
  function stubUrl() {
    Object.assign(URL, { createObjectURL: () => "blob:svg", revokeObjectURL: vi.fn() });
  }

  it("reports a canvas that cannot be created", async () => {
    stubUrl();
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        set src(_v: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const result = await svgToPngBlob("<svg/>", 100, 100, 1);
    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns the encoded PNG at the rasterized size", async () => {
    stubUrl();
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        set src(_v: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: draw,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
      cb(new Blob(["png"], { type: "image/png" })),
    );
    const result = await svgToPngBlob("<svg/>", 100, 50, 2);
    expect(result.ok).toBe(true);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 200, 100);
    vi.unstubAllGlobals();
  });

  it("reports an image the browser cannot decode", async () => {
    stubUrl();
    vi.stubGlobal(
      "Image",
      class {
        onerror: (() => void) | null = null;
        set src(_v: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const result = await svgToPngBlob("<svg/>", 10, 10, 1);
    expect(result).toMatchObject({ ok: false });
    vi.unstubAllGlobals();
  });
});
