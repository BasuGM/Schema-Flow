"use client";

import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { computeDiagramBounds } from "@/generators/diagram-bounds";
import { exportFileName, rasterSize } from "@/generators/raster-size";
import { afterNextPaint } from "@/lib/after-next-paint";
import { downloadBlob } from "@/lib/download";
import { resolveExportPalette } from "@/lib/export-palette";
import { measureText } from "@/lib/measure-text";
import { svgToPngBlob } from "@/lib/svg-to-png";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { OptionGroup, type Option } from "./option-group";

type Format = "png" | "svg";
type ThemeChoice = "current" | "light" | "dark";
type Scale = "1" | "2";

const FORMATS: Option<Format>[] = [
  { value: "png", label: "PNG", testId: "export-format-png" },
  { value: "svg", label: "SVG", testId: "export-format-svg" },
];
const THEMES: Option<ThemeChoice>[] = [
  { value: "current", label: "Current", testId: "export-theme-current" },
  { value: "light", label: "Light", testId: "export-theme-light" },
  { value: "dark", label: "Dark", testId: "export-theme-dark" },
];
const SCALES: Option<Scale>[] = [
  { value: "1", label: "1×", testId: "export-scale-1" },
  { value: "2", label: "2×", testId: "export-scale-2" },
];

/** Image tab of the Export dialog (P3-T03, ADR-027): PNG or SVG of the whole diagram. */
export function ExportImagePanel() {
  const { resolvedTheme } = useTheme();
  const schema = useSchemaStore((s) => s.schema);
  const fingerprint = useSchemaStore((s) => s.fingerprint);
  const layout = useLayoutStore((s) => (fingerprint ? s.layouts[fingerprint] : undefined));
  const [format, setFormat] = useState<Format>("png");
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("current");
  const [scale, setScale] = useState<Scale>("2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One size for the dialog, the SVG and the PNG: computeDiagramBounds + rasterSize.
  const bounds = useMemo(
    () => (schema && layout ? computeDiagramBounds(schema, layout) : null),
    [schema, layout],
  );
  if (!schema || !layout || !bounds) return null;

  const raster = rasterSize(bounds.width, bounds.height, Number(scale));
  const tables = schema.tableOrder.length;

  const onDownload = async () => {
    setBusy(true);
    setError(null);
    await afterNextPaint();
    try {
      const { renderDiagramSvg } = await import("@/generators/diagram-svg");
      const theme =
        themeChoice === "current" ? (resolvedTheme === "dark" ? "dark" : "light") : themeChoice;
      const { svg, width, height } = renderDiagramSvg({
        schema,
        layout,
        palette: resolveExportPalette(theme),
        measure: measureText,
      });
      if (format === "svg") {
        downloadBlob(
          new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
          exportFileName(schema.name, "svg"),
        );
      } else {
        const png = await svgToPngBlob(svg, width, height, Number(scale));
        if (!png.ok) {
          setError(png.message);
          return;
        }
        downloadBlob(png.blob, exportFileName(schema.name, "png"));
      }
      useUiStore.getState().closeExport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The image could not be created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3" aria-busy={busy || undefined}>
        <OptionGroup legend="Format" options={FORMATS} value={format} onChange={setFormat} />
        <OptionGroup
          legend="Theme"
          options={THEMES}
          value={themeChoice}
          onChange={setThemeChoice}
        />
        <OptionGroup
          legend="PNG scale"
          options={SCALES}
          value={scale}
          onChange={setScale}
          disabled={format === "svg"}
        />
        <p
          className="text-xs text-muted-foreground tabular-nums"
          data-testid="export-size"
          data-width={bounds.width}
          data-height={bounds.height}
        >
          {tables.toLocaleString()} {tables === 1 ? "table" : "tables"} ·{" "}
          {bounds.width.toLocaleString()} × {bounds.height.toLocaleString()} px
        </p>
        {format === "png" && (
          <p
            className="text-xs text-muted-foreground tabular-nums"
            data-testid="export-output"
            data-width={raster.pxWidth}
            data-height={raster.pxHeight}
          >
            PNG: {raster.pxWidth.toLocaleString()} × {raster.pxHeight.toLocaleString()} px
          </p>
        )}
        {format === "png" && raster.reduced && (
          <p className="text-xs text-foreground" data-testid="export-reduced-note">
            PNG reduced to {raster.scale}× to fit browser limits. SVG keeps full detail.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive" data-testid="export-error">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={busy} data-testid="export-cancel">
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={() => void onDownload()} disabled={busy} data-testid="export-download">
          {busy ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Exporting…
            </>
          ) : (
            "Download"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
