/** Colours an exported diagram uses; resolved from the app's theme tokens in the browser. */
export interface ExportPalette {
  canvas: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  edge: string;
  pk: string;
  fk: string;
}

export const DEFAULT_LIGHT_PALETTE: ExportPalette = {
  canvas: "#f7f7f7",
  card: "#ffffff",
  cardForeground: "#1f1f1f",
  muted: "#f4f4f4",
  mutedForeground: "#6b6b6b",
  border: "#e4e4e4",
  edge: "#8f8f8f",
  pk: "#a16a00",
  fk: "#2f5fd0",
};

export const DEFAULT_DARK_PALETTE: ExportPalette = {
  canvas: "#1a1a1a",
  card: "#262626",
  cardForeground: "#f0f0f0",
  muted: "#363636",
  mutedForeground: "#b0b0b0",
  border: "rgba(255,255,255,0.11)",
  edge: "#808080",
  pk: "#e6b84d",
  fk: "#7ea6f2",
};

/** Same stacks as `--font-sans` / `--font-mono` in globals.css. */
export const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export interface TextFont {
  family: "sans" | "mono";
  size: number;
  weight: number;
}

/** Text width in px for a font; the browser measures with a canvas, tests use `approxMeasure`. */
export type MeasureText = (text: string, font: TextFont) => number;

export const approxMeasure: MeasureText = (text, font) =>
  text.length * font.size * (font.family === "mono" ? 0.6 : 0.55) * (font.weight >= 600 ? 1.08 : 1);
