"use client";

import { CanvasErrorBoundary } from "@/components/canvas/canvas-error-boundary";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Inspector } from "./inspector";
import { TableList } from "./table-list";
import { Toolbar } from "./toolbar";
import { usePanelSync } from "./use-panel-sync";
import { useSampleLoader } from "./use-sample-loader";

export function Workspace() {
  useSampleLoader();
  const left = usePanelSync("left");
  const right = usePanelSync("right");

  return (
    <div className="flex h-full flex-col" data-testid="workspace">
      <Toolbar />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
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
          <main className="h-full" aria-label="Diagram">
            <CanvasErrorBoundary>
              <SchemaCanvas />
            </CanvasErrorBoundary>
          </main>
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
          <Inspector />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
