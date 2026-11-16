"use client";

import { SHEET_QUERY } from "@/components/issues/issues-sheet";
import { useSearchShortcut } from "@/components/search/use-search-shortcut";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useMediaQuery } from "@/lib/use-media-query";
import { useUiStore } from "@/stores/ui-store";
import { CanvasArea } from "./canvas-area";
import { Inspector } from "@/components/inspector/inspector";
import { TableList } from "./table-list";
import { Toolbar } from "./toolbar";
import { usePanelSync } from "./use-panel-sync";
import { useEscapeToClear } from "./use-escape-to-clear";
import { useSampleLoader } from "./use-sample-loader";

export function Workspace() {
  useSampleLoader();
  const left = usePanelSync("left");
  // Below md the inspector opens as an overlay sheet: 240 px beside a 320 px canvas can't fit.
  const sheet = useMediaQuery(SHEET_QUERY);
  const right = usePanelSync("right", sheet);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  useEscapeToClear();
  useSearchShortcut();

  return (
    <div className="flex h-full flex-col" data-testid="workspace">
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
            <TableList />
          </ResizablePanel>
          <ResizableHandle aria-label="Resize table list" />
          <ResizablePanel id="canvas" minSize={320}>
            <CanvasArea />
          </ResizablePanel>
          <ResizableHandle aria-label="Resize inspector" />
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
            {!sheet && <Inspector />}
          </ResizablePanel>
        </ResizablePanelGroup>
        {sheet && rightOpen && (
          <div
            className="absolute inset-y-0 right-0 z-30 w-[min(100%,22rem)] border-l shadow-lg"
            data-testid="inspector-sheet"
          >
            <Inspector sheet />
          </div>
        )}
      </div>
    </div>
  );
}
