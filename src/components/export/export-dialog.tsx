"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore, type ExportTab } from "@/stores/ui-store";
import { ExportImagePanel } from "./export-image-panel";
import { ExportTextPanel, type ExportCache } from "./export-text-panel";

const TABS: { value: ExportTab; label: string }[] = [
  { value: "sql", label: "SQL" },
  { value: "prisma", label: "Prisma" },
  { value: "mermaid", label: "Mermaid" },
  { value: "json", label: "JSON" },
  { value: "image", label: "Image" },
];

/**
 * Export dialog (P3-T03, P3-T05, ADR-029): SQL, Prisma, Mermaid and JSON text with preview, copy
 * and download, plus the PNG / SVG image export. Opened from the toolbar, Settings and More; on
 * close, focus goes back to the control it was opened from, never to `body`.
 */
export function ExportDialog() {
  const open = useUiStore((s) => s.exportOpen);
  const closeExport = useUiStore((s) => s.closeExport);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeExport()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        data-testid="export-dialog"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const id = useUiStore.getState().exportReturnFocus;
          document.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Generated in your browser from the loaded schema. Nothing is uploaded.
          </DialogDescription>
        </DialogHeader>
        {open && <ExportTabs />}
      </DialogContent>
    </Dialog>
  );
}

function ExportTabs() {
  const tab = useUiStore((s) => s.exportTab);
  const setTab = useUiStore((s) => s.setExportTab);
  // Generated text for this opening of the dialog, so switching back to a tab is instant.
  const [cache] = useState<ExportCache>(() => new Map());
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ExportTab)} className="min-w-0 gap-3">
      {/* Padding keeps the focus ring inside the scroll box; the box scrolls, never the page. */}
      <TabsList className="w-full justify-start overflow-x-auto p-1" aria-label="Export format">
        {TABS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            data-testid={`export-tab-${t.value}`}
            className="shrink-0 px-3"
            onFocus={(e) =>
              e.currentTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" })
            }
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="flex min-w-0 flex-col gap-3">
          {t.value === "image" ? (
            <ExportImagePanel />
          ) : (
            <ExportTextPanel tab={t.value} cache={cache} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
