// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { ZoomDetail } from "./zoom-detail";

function Canvas({ zoom, enabled }: { zoom: number; enabled: boolean }) {
  return (
    <div data-testid="schema-canvas" style={{ width: 800, height: 600 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={[]} edges={[]} defaultViewport={{ x: 0, y: 0, zoom }} minZoom={0.05}>
          <ZoomDetail enabled={enabled} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

describe("ZoomDetail (ADR-022)", () => {
  it("marks a large schema's canvas as zoomed out below zoom 0.3", () => {
    render(<Canvas zoom={0.1} enabled />);
    expect(screen.getByTestId("schema-canvas")).toHaveAttribute("data-zoomed-out", "true");
  });

  it("leaves readable zooms and normal-sized schemas alone", () => {
    const { unmount } = render(<Canvas zoom={0.5} enabled />);
    expect(screen.getByTestId("schema-canvas")).not.toHaveAttribute("data-zoomed-out");
    unmount();
    render(<Canvas zoom={0.1} enabled={false} />);
    expect(screen.getByTestId("schema-canvas")).not.toHaveAttribute("data-zoomed-out");
  });
});
