"use client";

import { FileText, Upload, X } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ImportFormatChoice } from "@/parsers";
import { formatBytes, type ImportDraft } from "./import-draft";

const FORMATS: { value: ImportFormatChoice; label: string }[] = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "prisma", label: "Prisma" },
];

interface ImportSourceProps {
  draft: ImportDraft;
  format: ImportFormatChoice;
  /** Shown next to "Auto", e.g. "PostgreSQL SQL". */
  detectedLabel: string | undefined;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  removeRef: RefObject<HTMLButtonElement | null>;
  /** Raw textarea input; the dialog debounces it (the textarea stays uncontrolled). */
  onTextInput: (text: string) => void;
  onFile: (file: File) => void;
  onRemoveFile: () => void;
  onFormatChange: (format: ImportFormatChoice) => void;
}

export function ImportSource({
  draft,
  format,
  detectedLabel,
  textareaRef,
  removeRef,
  onTextInput,
  onFile,
  onRemoveFile,
  onFormatChange,
}: ImportSourceProps) {
  return (
    <div className="flex flex-col gap-3">
      {draft.kind === "file" ? (
        <div
          className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5"
          data-testid="import-file-card"
        >
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={draft.name}>
              {draft.name}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(draft.size)}</p>
          </div>
          <Button
            ref={removeRef}
            variant="ghost"
            size="sm"
            onClick={onRemoveFile}
            data-testid="import-file-remove"
          >
            <X aria-hidden />
            Remove
          </Button>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          aria-label="Schema text"
          placeholder={"Paste SQL DDL (CREATE TABLE …) or a Prisma schema (model … { … })"}
          defaultValue={draft.kind === "paste" ? draft.text : ""}
          onInput={(e) => onTextInput(e.currentTarget.value)}
          spellCheck={false}
          autoComplete="off"
          // Fixed height: `field-sizing-content` would grow with a large paste.
          className="[field-sizing:fixed] h-48 resize-y font-mono text-xs md:text-xs"
          data-testid="import-textarea"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          {/* Focus sits on the sr-only input, so the label mirrors the Button's own focus ring (QA-029). */}
          <label className="has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <Upload aria-hidden />
            Choose file…
            {/* No `accept`: dumps come as .sql, .ddl, .psql, .txt or without an extension. */}
            <input
              type="file"
              className="sr-only"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) onFile(file);
              }}
              data-testid="import-file-input"
            />
          </label>
        </Button>
        <span className="text-xs text-muted-foreground">or drop a file here</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Format</span>
          <select
            value={format}
            onChange={(e) => onFormatChange(e.currentTarget.value as ImportFormatChoice)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            data-testid="import-format"
          >
            <option value="auto">Auto{detectedLabel ? ` (detected: ${detectedLabel})` : ""}</option>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
