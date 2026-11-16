"use client";

import { useLayoutEffect, useRef } from "react";
import { ErrorBoundary } from "@/components/errors/error-boundary";
import { QaCrash } from "@/components/errors/qa-crash";
import { SHEET_QUERY } from "@/components/issues/issues-sheet";
import { useSearchShortcut } from "@/components/search/use-search-shortcut";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { CanvasArea } from "./canvas-area";
import { Inspector } from "@/components/inspector/inspector";
import { TableList } from "./table-list";
import { InertPanel } from "./inert-panel";
import { SideSheet } from "./side-sheet";
import { Toolbar } from "./toolbar";
import { usePanelSync } from "./use-panel-sync";
import { useEscapeToClear } from "./use-escape-to-clear";
import { useSampleLoader } from "./use-sample-loader";

const toggle = (side: "left" | "right") => () => {
  const ui = useUiStore.getState();
  ui.setPanelOpen(side, !(side === "left" ? ui.leftPanelOpen : ui.rightPanelOpen));
};
const close = (side: "left" | "right") => () => useUiStore.getState().setPanelOpen(side, false);

export function Workspace() {
  useSampleLoader();
  // Below md both side panels open as overlay sheets: 200–240 px of panel beside the 320 px
  // minimum canvas can't fit (ADR-017 for the inspector, ADR-021 for the table list).
  const sheet = useMediaQuery(SHEET_QUERY);
  const left = usePanelSync("left", sheet);
  const right = usePanelSync("right", sheet);
  const leftOpen = useUiStore((s) => s.leftPanelOpen);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  const fingerprint = useSchemaStore((s) => s.fingerprint);
  useOneSheetAtATime(sheet, leftOpen, rightOpen);
  useEscapeToClear();
  useSearchShortcut();

  const tableList = (onClose?: () => void) => (
    <ErrorBoundary
      region="table list"
      testId="table-list-error"
      resetKeys={[fingerprint]}
      {...(onClose ? { onClose } : {})}
    >
      <QaCrash region="table-list" />
      <TableList {...(onClose ? { onClose } : {})} />
    </ErrorBoundary>
  );
  const inspector = (onClose?: () => void) => (
    <ErrorBoundary
      region="inspector"
      testId="inspector-error"
      resetKeys={[fingerprint]}
      {...(onClose ? { onClose } : {})}
    >
      <QaCrash region="inspector" />
      <Inspector sheet={!!onClose} />
    </ErrorBoundary>
  );

  return (
    <div className="flex h-full flex-col" data-testid="workspace">
      <QaCrash region="app" />
      <Toolbar />
      <div className="relative min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel
            id="tables"
            panelRef={left.panelRef}
            onResize={left.onResize}
            defaultSize={260}
            minSize={200}
            maxSize={420}
            collapsible
            collapsedSize={0}
          >
            <InertPanel side="left" open={leftOpen && !sheet}>
              {!sheet && tableList()}
            </InertPanel>
          </ResizablePanel>
          <ResizableHandle aria-label="Resize table list" onEnter={toggle("left")} />
          <ResizablePanel id="canvas" minSize={320}>
            <CanvasArea />
          </ResizablePanel>
          <ResizableHandle aria-label="Resize inspector" onEnter={toggle("right")} />
          <ResizablePanel
            id="inspector"
            panelRef={right.panelRef}
            onResize={right.onResize}
            defaultSize={300}
            minSize={240}
            maxSize={480}
            collapsible
            collapsedSize={0}
          >
            <InertPanel side="right" open={rightOpen && !sheet}>
              {!sheet && inspector()}
            </InertPanel>
          </ResizablePanel>
        </ResizablePanelGroup>
        {sheet && leftOpen && (
          <SideSheet side="left" testId="table-list-sheet" onClose={close("left")}>
            {tableList(close("left"))}
          </SideSheet>
        )}
        {sheet && rightOpen && (
          <SideSheet side="right" testId="inspector-sheet" onClose={close("right")}>
            {inspector(close("right"))}
          </SideSheet>
        )}
      </div>
    </div>
  );
}

/**
 * On phones the two sheets would cover each other (and the whole canvas): opening one closes the
 * other. Runs before paint, so both are never drawn together.
 */
function useOneSheetAtATime(sheet: boolean, leftOpen: boolean, rightOpen: boolean): void {
  const previous = useRef({ leftOpen, rightOpen });
  useLayoutEffect(() => {
    const was = previous.current;
    previous.current = { leftOpen, rightOpen };
    if (!sheet || !leftOpen || !rightOpen) return;
    // Keep the one that was just opened.
    useUiStore.getState().setPanelOpen(was.rightOpen && !was.leftOpen ? "right" : "left", false);
  }, [sheet, leftOpen, rightOpen]);
}
