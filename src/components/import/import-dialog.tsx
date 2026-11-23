"use client";

import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { keyShortcutsFor, withShortcut } from "@/components/commands/shortcuts";
import { restorePaletteFocus } from "@/components/commands/focus-return";
import { ErrorBoundary } from "@/components/errors/error-boundary";
import { QaCrash } from "@/components/errors/qa-crash";
import { ToolbarButton } from "@/components/workspace/toolbar-button";
import { useReturnFocusTooltip } from "@/components/workspace/use-return-focus-tooltip";
import type { Schema } from "@/domain/schema/types";
import { afterNextPaint } from "@/lib/after-next-paint";
import { cn } from "@/lib/utils";
import type { ImportFormatChoice } from "@/parsers";
import { resolveSessionFormat } from "@/stores/session-persistence";
import { useUiStore } from "@/stores/ui-store";
import { applyImportedSchema, type SessionSave } from "./apply-import";
import {
  EMPTY_DRAFT,
  fileDraft,
  formatForFileName,
  PASTE_SOFT_LIMIT_BYTES,
  type ImportDraft,
} from "./import-draft";
import { formatLabel, ImportPreview, importLabel } from "./import-preview";
import { ImportSource } from "./import-source";
import { loadParsers, useImportParse } from "./use-import-parse";

const PASTE_DEBOUNCE_MS = 300;
/**
 * From this many tables the auto-layout takes long enough (~200 ms on the development machine) to
 * need feedback: Import shows "Laying out N tables…" and lets it paint before the layout blocks the
 * main thread. Smaller schemas import synchronously, as before.
 */
export const BUSY_IMPORT_TABLES = 150;

/**
 * Toolbar "Import" button + dialog. The draft lives here, above the dialog content, so Cancel or
 * Escape keeps it for the session; a successful import resets it.
 */
export function ImportDialog() {
  const open = useUiStore((s) => s.importOpen);
  const setOpen = useUiStore((s) => s.setImportOpen);
  const [draft, setDraft] = useState<ImportDraft>(EMPTY_DRAFT);
  const [format, setFormat] = useState<ImportFormatChoice>("auto");
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const state = useImportParse(draft, format);
  const { tooltipOpen, onTooltipOpenChange, onCloseAutoFocus } = useReturnFocusTooltip();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const commitText = (text: string) => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
    const size = new Blob([text]).size;
    if (size > PASTE_SOFT_LIMIT_BYTES) {
      // Large pastes become a card: keeping megabytes in the textarea makes typing slow.
      if (textareaRef.current) textareaRef.current.value = "";
      setDraft({ kind: "file", name: "Pasted text", size, source: text });
    } else setDraft(text.trim() ? { kind: "paste", text } : EMPTY_DRAFT);
  };

  const onTextInput = (text: string) => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { text, timer: setTimeout(() => commitText(text), PASTE_DEBOUNCE_MS) };
  };

  const onFile = (file: File) => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
    setDraft(fileDraft(file));
    setFormat(formatForFileName(file.name));
  };

  const onOpenChange = (next: boolean) => {
    if (applying !== null) return;
    // Keep typed-but-not-yet-committed text when the dialog closes.
    if (!next && pending.current) commitText(pending.current.text);
    if (next) void loadParsers();
    setDragging(false);
    setOpen(next);
  };

  const finishImport = (schema: Schema, text: string, saved: SessionSave) => {
    applyImportedSchema(schema, text, saved);
    setDraft(EMPTY_DRAFT);
    setFormat("auto");
    setApplying(null);
    setOpen(false);
  };

  const onImport = () => {
    if (applying !== null || state.status !== "done" || !state.parsed.result.schema) return;
    const { schema } = state.parsed.result;
    const saved = { format: resolveSessionFormat(state.parsed, schema.source.dialect) };
    const tables = schema.tableOrder.length;
    if (tables < BUSY_IMPORT_TABLES) return finishImport(schema, state.text, saved);
    setApplying(tables);
    void afterNextPaint().then(() => finishImport(schema, state.text, saved));
  };

  // While open, a file dropped outside the drop zone must not make the browser navigate to it.
  useEffect(() => {
    if (!open) return;
    const block = (e: globalThis.DragEvent) => e.preventDefault();
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, [open]);

  const onDragOver = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const label = importLabel(state);
  const detected =
    state.status === "done" && format === "auto" ? formatLabel(state.parsed) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <ToolbarButton
          tooltip={withShortcut("Import SQL or Prisma schema", "import")}
          aria-keyshortcuts={keyShortcutsFor("import")}
          tooltipOpen={tooltipOpen}
          onTooltipOpenChange={onTooltipOpenChange}
          data-testid="toolbar-import"
        >
          <Upload aria-hidden />
          <span className="hidden md:inline">Import</span>
        </ToolbarButton>
      </DialogTrigger>
      <DialogContent
        aria-busy={applying !== null || undefined}
        className="flex max-h-[min(90dvh,720px)] flex-col gap-0 p-0 sm:max-w-2xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (draft.kind === "file" ? removeRef.current : textareaRef.current)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (!restorePaletteFocus(event)) onCloseAutoFocus();
        }}
        onDragOver={onDragOver}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
        data-testid="import-dialog"
      >
        <DialogHeader className="border-b px-4 pt-4 pb-3">
          <DialogTitle>Import schema</DialogTitle>
          <DialogDescription>
            Parsed in your browser. Nothing is uploaded or executed.
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3",
            dragging && "outline-2 -outline-offset-4 outline-brand outline-dashed",
          )}
          data-testid="import-dropzone"
        >
          <ErrorBoundary
            region="import form"
            testId="import-error"
            onClose={() => onOpenChange(false)}
          >
            <QaCrash region="import" />
            <ImportSource
              draft={draft}
              format={format}
              detectedLabel={detected}
              textareaRef={textareaRef}
              removeRef={removeRef}
              onTextInput={onTextInput}
              onFile={onFile}
              onRemoveFile={() => setDraft(EMPTY_DRAFT)}
              onFormatChange={setFormat}
            />
            <ImportPreview state={state} />
          </ErrorBoundary>
        </div>
        <DialogFooter className="mx-0 mb-0 items-center px-4 py-3 sm:justify-between">
          <p className="text-xs text-muted-foreground" data-testid="import-replace-note">
            This replaces the current diagram.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" disabled={applying !== null} data-testid="import-cancel">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={!label || applying !== null}
              onClick={onImport}
              data-testid="import-confirm"
            >
              {applying !== null ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" />
                  Laying out {applying} tables…
                </>
              ) : (
                (label ?? "Import")
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
