"use client";

import { Download, PanelLeft, PanelRight, Workflow } from "lucide-react";
import { ImportDialog } from "@/components/import/import-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { SettingsMenu } from "./settings-menu";
import { ThemeToggle } from "./theme-toggle";
import { ToolbarButton } from "./toolbar-button";

export function Toolbar() {
  const schemaName = useSchemaStore((s) => s.schema?.name);
  const tableCount = useSchemaStore((s) => s.schema?.tableOrder.length ?? 0);
  const leftOpen = useUiStore((s) => s.leftPanelOpen);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  const setPanelOpen = useUiStore((s) => s.setPanelOpen);

  const relayout = () => {
    const { schema, fingerprint } = useSchemaStore.getState();
    if (schema && fingerprint) useLayoutStore.getState().relayout(schema, fingerprint);
  };

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-2"
      data-testid="toolbar"
    >
      <ToolbarButton
        tooltip={leftOpen ? "Hide table list" : "Show table list"}
        size="icon"
        aria-label="Toggle table list"
        aria-pressed={leftOpen}
        onClick={() => setPanelOpen("left", !leftOpen)}
        data-testid="toolbar-toggle-left"
      >
        <PanelLeft aria-hidden />
      </ToolbarButton>
      <div className="flex items-center gap-2 px-1.5">
        <span
          className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground"
          aria-hidden
        >
          <Workflow className="size-3.5" />
        </span>
        {/* Wordmark hidden on phones so the toolbar fits 390 px (the logo stays). */}
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">SchemaFlow</span>
      </div>
      <Separator orientation="vertical" className="mx-1 h-5!" />
      <div className="flex min-w-0 items-center gap-2" data-testid="toolbar-schema-name">
        <span className="truncate text-sm text-muted-foreground">
          {schemaName ?? "No schema loaded"}
        </span>
        {schemaName && (
          <Badge variant="secondary" className="hidden font-normal tabular-nums sm:inline-flex">
            {tableCount} tables
          </Badge>
        )}
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <ImportDialog />
        <ToolbarButton
          tooltip="Export is coming in Phase 3"
          unavailable
          data-testid="toolbar-export"
        >
          <Download aria-hidden />
          <span className="hidden md:inline">Export</span>
        </ToolbarButton>
        <ToolbarButton
          tooltip="Re-run automatic layout (discards manual positions)"
          onClick={relayout}
          unavailable={!schemaName}
          data-testid="toolbar-layout"
        >
          <Workflow aria-hidden />
          <span className="hidden md:inline">Layout</span>
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5!" />
        <ThemeToggle />
        <SettingsMenu />
        <ToolbarButton
          tooltip={rightOpen ? "Hide inspector" : "Show inspector"}
          size="icon"
          aria-label="Toggle inspector"
          aria-pressed={rightOpen}
          onClick={() => setPanelOpen("right", !rightOpen)}
          data-testid="toolbar-toggle-right"
        >
          <PanelRight aria-hidden />
        </ToolbarButton>
      </div>
    </header>
  );
}
