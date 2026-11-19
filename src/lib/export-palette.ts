import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  type ExportPalette,
} from "@/generators/export-palette";

const TOKENS: Record<keyof ExportPalette, string> = {
  canvas: "--canvas",
  card: "--card",
  cardForeground: "--card-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  border: "--border",
  edge: "--edge",
  pk: "--pk",
  fk: "--fk",
};

const SENTINEL = "#010203";

/** `#rrggbb`, or `rgba()` when the colour is translucent (the dark `--border` is 11% white). */
function toCss(ctx: CanvasRenderingContext2D, value: string): string | null {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = SENTINEL;
  ctx.fillStyle = value;
  // An unparseable colour leaves the sentinel in place.
  if (ctx.fillStyle === SENTINEL && value.replace(/\s/g, "").toLowerCase() !== SENTINEL)
    return null;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 255] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 255) {
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return `rgba(${r},${g},${b},${Math.round((a / 255) * 1000) / 1000})`;
}

/**
 * The app's theme tokens as plain colours the standalone SVG can carry. Tokens are `oklch()` in the
 * stylesheet and read back as such, so each is painted onto a 1×1 canvas and read as sRGB.
 * Reading the other theme toggles the `dark` class on `<html>` for the duration of this one
 * synchronous call (no frame is painted in between) and restores it. Anything that fails falls
 * back to the built-in palette for that token, so an export is never blocked by this.
 */
export function resolveExportPalette(theme: "light" | "dark"): ExportPalette {
  const fallback = theme === "dark" ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE;
  try {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const wantDark = theme === "dark";
    if (wasDark !== wantDark) root.classList.toggle("dark", wantDark);
    try {
      const style = getComputedStyle(root);
      const palette = { ...fallback };
      for (const key of Object.keys(TOKENS) as (keyof ExportPalette)[]) {
        const raw = style.getPropertyValue(TOKENS[key]).trim();
        const css = raw ? toCss(ctx, raw) : null;
        if (css) palette[key] = css;
      }
      return palette;
    } finally {
      if (wasDark !== wantDark) root.classList.toggle("dark", wasDark);
    }
  } catch {
    return fallback;
  }
}
