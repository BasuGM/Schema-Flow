"use client";

import { Check, Copy, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import type { SqlDialect } from "@/domain/schema/types";
import { exportFileName } from "@/generators/raster-size";
import type { GeneratedFile } from "@/generators/text/generate-text";
import type { GeneratorTarget } from "@/generators/text/types";
import { afterNextPaint } from "@/lib/after-next-paint";
import { copyText } from "@/lib/copy-text";
import { downloadBlob } from "@/lib/download";
import { useSchemaStore } from "@/stores/schema-store";
import { OptionGroup, type Option } from "./option-group";
import { previewOf } from "./preview-text";

export type TextTab = "sql" | "prisma" | "mermaid" | "json";
export type ExportCache = Map<string, GeneratedFile>;

const LABELS: Record<TextTab, string> = {
  sql: "SQL",
  prisma: "Prisma",
  mermaid: "Mermaid",
  json: "JSON",
};
const DIALECTS: Option<SqlDialect>[] = [
  { value: "postgresql", label: "PostgreSQL", testId: "export-dialect-postgresql" },
  { value: "mysql", label: "MySQL", testId: "export-dialect-mysql" },
  { value: "sqlite", label: "SQLite", testId: "export-dialect-sqlite" },
];
type MermaidColumns = "all" | "keys";
const MERMAID: Option<MermaidColumns>[] = [
  { value: "all", label: "All columns", testId: "export-mermaid-all" },
  { value: "keys", label: "Keys only", testId: "export-mermaid-keys" },
];

interface Result {
  /** What the text was made for; it is shown only while this still matches the visible tab. */
  key: string;
  file?: GeneratedFile;
  error?: string;
}

/** A text tab of the Export dialog (P3-T05, ADR-029): options, preview, warnings, Copy, Download. */
export function ExportTextPanel({ tab, cache }: { tab: TextTab; cache: ExportCache }) {
  const schema = useSchemaStore((s) => s.schema);
  const revision = useSchemaStore((s) => s.revision);
  const [dialect, setDialect] = useState<SqlDialect>(schema?.source.dialect ?? "postgresql");
  const [columns, setColumns] = useState<MermaidColumns>("all");
  const [result, setResult] = useState<Result | null>(null);
  const [copyStatus, setCopyStatus] = useState<string>("");

  const target = useMemo<GeneratorTarget>(() => {
    if (tab === "sql") return { kind: "sql", dialect };
    if (tab === "mermaid") return { kind: "mermaid", columns };
    return { kind: tab };
  }, [tab, dialect, columns]);
  // The fingerprint hashes only table IDs and column names; the revision changes on every import.
  const key = `${revision}|${JSON.stringify(target)}`;

  useEffect(() => {
    if (!schema || cache.has(key)) return;
    // One request per (schema revision, target, options): leaving that combination (another tab or
    // option, a re-import, closing the dialog) makes this request stale, so it never reports back.
    let current = true;
    void (async () => {
      try {
        await afterNextPaint();
        const { generateSchemaText } = await import("@/generators/text/generate-text");
        const file = generateSchemaText(schema, target);
        // Keyed by what it was made for, so caching a stale result can never show the wrong text.
        cache.set(key, file);
        if (current) setResult({ key, file });
      } catch (e) {
        if (current) {
          setResult({
            key,
            error: e instanceof Error ? e.message : "The export could not be created.",
          });
        }
      }
    })();
    return () => {
      current = false;
    };
  }, [schema, target, key, cache]);

  const failed = result?.key === key ? result.error : undefined;
  const file = cache.get(key);
  const ready = file !== undefined;
  const view = useMemo(() => (file ? previewOf(file.text) : null), [file]);
  if (!schema) return null;

  // Copy and Download run synchronously inside the click: Safari and iOS drop the user gesture
  // after an `await`, so the text must already be ready (the buttons are disabled until it is).
  const onCopy = () => {
    if (!file) return;
    setCopyStatus("");
    void copyText(file.text).then((r) =>
      setCopyStatus(r === "copied" ? "Copied" : "Copy failed. Use Download instead."),
    );
  };
  const onDownload = () => {
    if (!file) return;
    const name = exportFileName(schema.name, file.extension);
    downloadBlob(
      new Blob([file.text], { type: `${file.mime};charset=utf-8` }),
      target.kind === "sql" ? name.replace(/\.sql$/, `.${target.dialect}.sql`) : name,
    );
  };

  const label = LABELS[tab];
  const bytes = file ? new Blob([file.text]).size : 0;
  return (
    <>
      <div className="flex min-w-0 flex-col gap-3" aria-busy={!ready || undefined}>
        {tab === "sql" && (
          <OptionGroup legend="Dialect" options={DIALECTS} value={dialect} onChange={setDialect} />
        )}
        {tab === "mermaid" && (
          <OptionGroup legend="Columns" options={MERMAID} value={columns} onChange={setColumns} />
        )}
        {failed && (
          <p role="alert" className="text-xs text-destructive" data-testid="export-error">
            {failed}
          </p>
        )}
        {!ready && !failed && (
          <p
            className="flex items-center gap-2 text-xs text-muted-foreground"
            data-testid="export-generating"
          >
            <Loader2 aria-hidden className="size-3 animate-spin" />
            Generating…
          </p>
        )}
        {file && view && (
          <>
            <pre
              tabIndex={0}
              aria-label={`${label} preview`}
              data-testid="export-preview"
              className="max-h-[40dvh] min-w-0 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs leading-5"
            >
              {view.preview}
            </pre>
            <p
              className="text-xs text-muted-foreground tabular-nums"
              data-testid="export-text-size"
            >
              {view.totalLines.toLocaleString()} {view.totalLines === 1 ? "line" : "lines"} ·{" "}
              {(bytes / 1024).toFixed(1)} KB
            </p>
            {view.truncated && (
              <p className="text-xs text-foreground" data-testid="export-preview-truncated">
                Preview shows the first part of {view.totalLines.toLocaleString()} lines. Copy and
                Download include everything.
              </p>
            )}
            <div className="text-xs" data-testid="export-warnings">
              {file.warnings.length === 0 ? (
                <span className="text-muted-foreground">No warnings</span>
              ) : (
                <details>
                  <summary className="cursor-pointer">
                    {file.warnings.length} {file.warnings.length === 1 ? "warning" : "warnings"}
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {file.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </>
        )}
        <p role="status" className="text-xs text-muted-foreground" data-testid="export-copy-status">
          {copyStatus}
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" data-testid="export-close">
            Close
          </Button>
        </DialogClose>
        <Button variant="outline" onClick={onCopy} disabled={!file} data-testid="export-copy">
          {copyStatus === "Copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
          Copy
        </Button>
        <Button onClick={onDownload} disabled={!file} data-testid="export-download-text">
          <Download aria-hidden />
          Download
        </Button>
      </DialogFooter>
    </>
  );
}
