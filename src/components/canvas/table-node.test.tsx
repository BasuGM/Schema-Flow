// @vitest-environment jsdom
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { columnHandleId } from "@/graph/handles";
import { NODE_ROW_HEIGHT } from "@/graph/node-metrics";
import { schemaToFlow } from "@/graph/schema-to-flow";
import type { TableFlowNode } from "@/graph/types";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { TableNode } from "./table-node";

const nodeTypes = { table: TableNode };

function renderNode(tableId: string, mode: TableFlowNode["data"]["mode"] = "full") {
  const schema = useSchemaStore.getState().schema!;
  const nodes = schemaToFlow(schema, {
    positions: {},
    collapsed: { [tableId]: mode },
  }).nodes.filter((n) => n.id === tableId);
  return render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} />
      </div>
    </ReactFlowProvider>,
  );
}

beforeEach(() => resetStores());

describe("TableNode", () => {
  it("renders the table name and every column with its type", () => {
    renderNode("public.orders");
    const node = screen.getByTestId("table-node-orders");
    expect(within(node).getByText("orders")).toBeInTheDocument();
    for (const name of [
      "id",
      "user_id",
      "shipping_address_id",
      "coupon_id",
      "status",
      "total_cents",
      "placed_at",
    ]) {
      expect(within(node).getByTestId(`column-${name}`)).toBeInTheDocument();
    }
    expect(within(node).getByText("order_status")).toHaveClass("font-mono");
  });

  it("marks primary-key and foreign-key columns with icons", () => {
    renderNode("public.orders");
    const id = screen.getByTestId("column-id");
    const userId = screen.getByTestId("column-user_id");
    expect(id).toHaveAttribute("data-pk", "true");
    expect(within(id).getByTestId("pk-icon")).toBeInTheDocument();
    expect(within(userId).getByTestId("fk-icon")).toBeInTheDocument();
    expect(within(screen.getByTestId("column-status")).queryByTestId("fk-icon")).toBeNull();
  });

  it("shows a nullable marker only on nullable columns", () => {
    renderNode("public.orders");
    expect(
      within(screen.getByTestId("column-coupon_id")).getByTestId("nullable-marker"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("column-user_id")).queryByTestId("nullable-marker"),
    ).toBeNull();
  });

  it("renders a handle wherever an edge attaches, and none on other rows (ADR-023)", () => {
    const schema = useSchemaStore.getState().schema!;
    const { edges } = schemaToFlow(schema, { positions: {}, collapsed: {} });
    for (const tableId of ["public.order_items", "public.orders"]) {
      const { container, unmount } = renderNode(tableId);
      const ends = edges.flatMap((e) => [
        ...(e.source === tableId ? [e.sourceHandle] : []),
        ...(e.target === tableId ? [e.targetHandle] : []),
      ]);
      expect(ends.length).toBeGreaterThan(0);
      for (const handle of ends)
        expect(container.querySelector(`[data-handleid="${handle}"]`), handle!).not.toBeNull();
      unmount();
    }
    const { container } = renderNode("public.order_items");
    const quantity = "public.order_items.quantity";
    expect(
      container.querySelector(`[data-handleid="${columnHandleId(quantity, "source")}"]`),
    ).toBeNull();
    expect(
      container.querySelector(`[data-handleid="${columnHandleId(quantity, "target")}"]`),
    ).toBeNull();
  });

  it("renders skeleton rows when a large schema is zoomed out, keeping height and edge handles", () => {
    const { container } = renderNode("public.order_items");
    const handles = [...container.querySelectorAll("[data-handleid]")].map((h) =>
      h.getAttribute("data-handleid"),
    );
    act(() => useUiStore.getState().setCanvasZoomedOut(true));
    const node = screen.getByTestId("table-node-order_items");
    expect(within(node).queryByTestId("column-quantity")).toBeNull();
    const block = within(node).getByTestId("skeleton-rows").firstElementChild as HTMLElement;
    expect(block.style.height).toBe(`${5 * NODE_ROW_HEIGHT}px`);
    expect(
      [...container.querySelectorAll("[data-handleid]")].map((h) =>
        h.getAttribute("data-handleid"),
      ),
    ).toEqual(handles);
    act(() => useUiStore.getState().setCanvasZoomedOut(false));
    expect(within(node).getByTestId("column-quantity")).toBeInTheDocument();
  });

  it("reflects selection from the UI store", () => {
    renderNode("public.users");
    const node = screen.getByTestId("table-node-users");
    expect(node).toHaveAttribute("data-selected", "false");
    act(() => useUiStore.getState().selectTable("public.users"));
    expect(node).toHaveAttribute("data-selected", "true");
  });

  it("is focusable with an accessible name", () => {
    const { container } = renderNode("public.users");
    const wrapper = container.querySelector(".react-flow__node");
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper).toHaveAttribute("aria-label", expect.stringContaining("users"));
  });

  it("hides non-key columns in keys mode", () => {
    renderNode("public.orders", "keys");
    expect(screen.getByTestId("column-user_id")).toBeInTheDocument();
    expect(screen.queryByTestId("column-status")).toBeNull();
  });
});
