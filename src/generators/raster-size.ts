/** Longest side a browser reliably rasterizes. */
export const MAX_SIDE = 16384;
/** Total pixels; Safari / iOS fail above 4096² canvases. */
export const MAX_AREA = 16_777_216;

export interface RasterSize {
  scale: number;
  pxWidth: number;
  pxHeight: number;
  /** True when the requested scale did not fit and was lowered. */
  reduced: boolean;
}

/** PNG size for a diagram of `width × height` at the requested scale, within browser canvas limits. */
export function rasterSize(width: number, height: number, requested: number): RasterSize {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  let scale = Math.min(requested, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_AREA / (w * h)));
  const reduced = scale < requested;
  if (reduced) scale = Math.floor(scale * 10000) / 10000;
  const px = (s: number) => ({
    pxWidth: Math.max(1, Math.round(w * s)),
    pxHeight: Math.max(1, Math.round(h * s)),
  });
  let size = px(scale);
  // Rounding up can overshoot a limit by a pixel; step down until it fits.
  while (
    reduced &&
    scale > 0.0001 &&
    (size.pxWidth > MAX_SIDE || size.pxHeight > MAX_SIDE || size.pxWidth * size.pxHeight > MAX_AREA)
  ) {
    scale = Math.round((scale - 0.0001) * 10000) / 10000;
    size = px(scale);
  }
  return { scale, ...size, reduced };
}

/** `my-shop.svg`: a safe, lower-case file name for the schema; `schema` when nothing usable remains. */
export function exportFileName(schemaName: string, extension: "png" | "svg"): string {
  const slug = schemaName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || "schema"}.${extension}`;
}
