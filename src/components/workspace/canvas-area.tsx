"use client";

import { useEffect, useRef } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import { CanvasErrorBoundary } from "@/components/canvas/canvas-error-boundary";
import { ErrorBoundary } from "@/components/errors/error-boundary";
import { QaCrash } from "@/components/errors/qa-crash";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { IssuesPanel } from "@/components/issues/issues-panel";
import { SHEET_HEIGHT_PERCENT, SHEET_QUERY } from "@/components/issues/issues-sheet";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

const DEFAULT_ISSUES_SIZE = "35%";

/**
 * Canvas plus the issues panel (P2-T06). The split is always mounted, so the canvas (and its
 * viewport) never remounts when the panel opens, closes, resizes or switches to the sheet.
 */
export function CanvasArea() {
  const sheet = useMediaQuery(SHEET_QUERY);
  const open = useUiStore((s) => s.issuesPanelOpen);
  const fingerprint = useSchemaStore((s) => s.fingerprint) ?? "none";
  const docked = open && !sheet;
  const { panelRef, onResize, handleProps } = useIssuesPanelSync(docked, sheet);

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      {/* Percentage minimums are satisfiable at any height; pixel minimums made the library fall
          back to a 50/50 split in short groups, which would have opened the panel by itself. */}
      <ResizablePanel id="diagram" minSize="30%">
        <div className="relative h-full">
          <main className="h-full" aria-label="Diagram">
            <CanvasErrorBoundary>
              <QaCrash region="canvas" />
              <SchemaCanvas />
            </CanvasErrorBoundary>
          </main>
          {sheet && open && (
            <div
              className="absolute inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-xl border-t shadow-lg"
              style={{ height: `${SHEET_HEIGHT_PERCENT}%` }}
              data-testid="issues-sheet"
            >
              <IssuesRegion fingerprint={fingerprint} />
            </div>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle
        aria-label="Resize issues panel"
        className={cn(!docked && "hidden")}
        {...handleProps}
      />
      <ResizablePanel
        id="issues"
        panelRef={panelRef}
        onResize={onResize}
        defaultSize={docked ? DEFAULT_ISSUES_SIZE : "0%"}
        minSize="15%"
        collapsible
        collapsedSize={0}
      >
        {docked && <IssuesRegion fingerprint={fingerprint} />}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/** The issues panel (docked or sheet) in its own error boundary (ADR-020). */
function IssuesRegion({ fingerprint }: { fingerprint: string }) {
  return (
    <ErrorBoundary
      region="issues panel"
      testId="issues-error"
      resetKeys={[fingerprint]}
      onClose={() => useUiStore.getState().setIssuesPanelOpen(false)}
    >
      <QaCrash region="issues" />
      <IssuesPanel key={fingerprint} />
    </ErrorBoundary>
  );
}

/**
 * Keeps the docked panel and `ui-store` in sync. Only a resize made while the user drags or
 * keyboard-resizes the separator changes the store; any other resize (layout fallbacks on mount, a
 * group too small for its constraints) is corrected once back to the store's state, so the panel
 * never opens or closes by itself.
 */
function useIssuesPanelSync(docked: boolean, sheet: boolean) {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  const expected = useRef(docked);
  const interacting = useRef(false);
  const corrected = useRef(false);
  const lastSize = useRef<string>(DEFAULT_ISSUES_SIZE);

  useEffect(() => {
    const panel = panelRef.current;
    expected.current = docked;
    corrected.current = false;
    if (!panel) return;
    if (docked && panel.isCollapsed()) panel.resize(lastSize.current);
    if (!docked && !panel.isCollapsed()) panel.collapse();
  }, [docked]);

  useEffect(() => {
    const end = () => {
      interacting.current = false;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const onResize = (size: PanelSize) => {
    const expanded = size.inPixels > 0;
    if (sheet) return;
    if (interacting.current) {
      if (expanded) lastSize.current = `${size.asPercentage}%`;
      if (expanded !== expected.current) {
        expected.current = expanded;
        useUiStore.getState().setIssuesPanelOpen(expanded);
      }
      return;
    }
    if (expanded === expected.current || corrected.current) return;
    corrected.current = true;
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (expected.current) panel?.resize(lastSize.current);
      else panel?.collapse();
    });
  };

  const handleProps = {
    onPointerDown: () => {
      interacting.current = true;
    },
    onKeyDown: () => {
      interacting.current = true;
    },
    onKeyUp: () => {
      interacting.current = false;
    },
  };
  return { panelRef, onResize, handleProps };
}
