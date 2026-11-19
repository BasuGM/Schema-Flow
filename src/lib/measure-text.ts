import {
  MONO_STACK,
  SANS_STACK,
  approxMeasure,
  type MeasureText,
} from "@/generators/export-palette";

let context: CanvasRenderingContext2D | null | undefined;
let lastFont = "";

/** Text width from a canvas, so truncation in the export matches real glyph widths. */
export const measureText: MeasureText = (text, font) => {
  if (context === undefined) {
    try {
      context = document.createElement("canvas").getContext("2d");
    } catch {
      context = null;
    }
  }
  if (!context) return approxMeasure(text, font);
  const css = `${font.weight} ${font.size}px ${font.family === "mono" ? MONO_STACK : SANS_STACK}`;
  if (css !== lastFont) {
    context.font = css;
    lastFont = css;
  }
  return context.measureText(text).width;
};
