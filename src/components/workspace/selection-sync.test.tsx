// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { Inspector } from "./inspector";
import { TableList } from "./table-list";
import { useEscapeToClear } from "./use-escape-to-clear";

function Harness() {
  const onKeyDown = useEscapeToClear();
  return (
    <div onKeyDown={onKeyDown}>
      <TableList />
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
      <Inspector />
    </div>
  );
}

function renderWorkspace() {
  return render(<Harness />);
}

const nodeWrapper = (name: string) =>
  screen.getByTestId(`table-node-${name}`).closest(".react-flow__node") as HTMLElement;

beforeEach(() => resetStores());

describe("selection sync between list, canvas and inspector", () => {
  it("renders one node per table and one edge per relationship", () => {
    const { container } = renderWorkspace();
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(12);
    expect(container.querySelectorAll(".react-flow__edge")).toHaveLength(13);
  });

  it("selecting in the list highlights the node and fills the inspector", async () => {
    renderWorkspace();
    await userEvent.click(screen.getByTestId("table-list-item-orders"));
    expect(screen.getByTestId("table-node-orders")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("table-node-users")).toHaveAttribute("data-selected", "false");
    expect(screen.getByTestId("inspector-title")).toHaveTextContent("orders");
  });

  it("clicking a node selects it in the list and inspector", () => {
    renderWorkspace();
    fireEvent.click(nodeWrapper("payments"));
    expect(useUiStore.getState().selectedTableId).toBe("public.payments");
    expect(screen.getByTestId("table-list-item-payments")).toHaveAttribute("aria-current", "true");
    expect(
      within(screen.getByTestId("inspector")).getByTestId("inspector-title"),
    ).toHaveTextContent("payments");
  });

  it("clicking the empty canvas clears the selection", () => {
    const { container } = renderWorkspace();
    fireEvent.click(nodeWrapper("users"));
    fireEvent.click(container.querySelector(".react-flow__pane")!);
    expect(useUiStore.getState().selectedTableId).toBeNull();
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });

  it("supports keyboard selection (Enter) and clearing (Escape) on focused nodes", () => {
    renderWorkspace();
    const node = nodeWrapper("reviews");
    node.focus();
    fireEvent.keyDown(node, { key: "Enter" });
    expect(useUiStore.getState().selectedTableId).toBe("public.reviews");
    fireEvent.keyDown(node, { key: "Escape" });
    expect(useUiStore.getState().selectedTableId).toBeNull();
  });

  it("does not rebuild the nodes when selection changes", () => {
    renderWorkspace();
    const before = nodeWrapper("users");
    fireEvent.click(nodeWrapper("orders"));
    expect(nodeWrapper("users")).toBe(before);
  });

  it("re-layout keeps every table on the canvas", () => {
    const { container } = renderWorkspace();
    const { schema, fingerprint } = useSchemaStore.getState();
    useLayoutStore.getState().setPosition(fingerprint!, "public.users", { x: 5000, y: 5000 });
    act(() => useLayoutStore.getState().relayout(schema!, fingerprint!));
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(12);
    expect(useLayoutStore.getState().layouts[fingerprint!]?.positions["public.users"]).not.toEqual({
      x: 5000,
      y: 5000,
    });
  });

  it("Escape clears a selection made from the table list (QA-003)", async () => {
    renderWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("table-list-item-users"));
    expect(useUiStore.getState().selectedTableId).toBe("public.users");
    await user.keyboard("{Escape}");
    expect(useUiStore.getState().selectedTableId).toBeNull();
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });

  it("Escape clears a selection while the inspector close button has focus", async () => {
    renderWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("table-list-item-orders"));
    screen.getByTestId("inspector-close").focus();
    await user.keyboard("{Escape}");
    expect(useUiStore.getState().selectedTableId).toBeNull();
  });

  it("Escape inside the filter input does not clear the selection", async () => {
    renderWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("table-list-item-orders"));
    await user.click(screen.getByTestId("table-filter"));
    await user.keyboard("{Escape}");
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");
  });

  it("draws the long orders → users edge along its auto-layout route (QA-001)", () => {
    const { container } = renderWorkspace();
    const edge = container.querySelector('[data-id="fk:public.orders(user_id)->public.users"]');
    const d = edge?.querySelector("path.react-flow__edge-path")?.getAttribute("d") ?? "";
    expect(d.match(/ C /g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("highlights the selected table's edges without showing their labels (QA-004)", async () => {
    const { container } = renderWorkspace();
    await userEvent.click(screen.getByTestId("table-list-item-orders"));
    expect(container.querySelectorAll('[data-testid^="edge-label-"]')).toHaveLength(0);
    const edgePath = container.querySelector(
      '[data-id="fk:public.orders(user_id)->public.users"] path.react-flow__edge-path',
    );
    expect(edgePath?.getAttribute("style")).toContain("var(--brand)");
  });

  it("shows exactly one full label for the hovered edge and hides it on leave (QA-004)", () => {
    renderWorkspace();
    const id = "fk:public.orders(user_id)->public.users";
    fireEvent.mouseEnter(screen.getByTestId(`edge-hit-${id}`));
    const labels = document.querySelectorAll('[data-testid^="edge-label-"]');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent("orders_user_fk · orders.user_id → users.id");
    fireEvent.mouseLeave(screen.getByTestId(`edge-hit-${id}`));
    expect(document.querySelectorAll('[data-testid^="edge-label-"]')).toHaveLength(0);
  });

  it("keeps the label of a clicked edge until the canvas is clicked", () => {
    const { container } = renderWorkspace();
    const id = "fk:public.payments(order_id)->public.orders";
    fireEvent.click(container.querySelector(`[data-id="${id}"]`)!);
    expect(screen.getByTestId(`edge-label-${id}`)).toHaveTextContent("payments_order_fk");
    fireEvent.click(container.querySelector(".react-flow__pane")!);
    expect(screen.queryByTestId(`edge-label-${id}`)).toBeNull();
  });

  it("gives edges a descriptive accessible name", () => {
    const { container } = renderWorkspace();
    expect(
      container.querySelector('[data-id="fk:public.orders(user_id)->public.users"]'),
    ).toHaveAttribute("aria-label", "Relationship orders_user_fk · orders.user_id → users.id");
  });

  it("counter-scales the hover label by the current zoom (QA-005)", () => {
    const { container } = renderWorkspace();
    const id = "fk:public.orders(user_id)->public.users";
    fireEvent.mouseEnter(screen.getByTestId(`edge-hit-${id}`));
    const transform = (screen.getByTestId(`edge-label-${id}`) as HTMLElement).style.transform;
    const zoom = readCanvasZoom(container);
    expect(transform).toContain(`scale(${Math.round((1 / zoom) * 1000) / 1000})`);
  });

  it("gives a clicked edge a distinct selected state", () => {
    const { container } = renderWorkspace();
    const id = "fk:public.payments(order_id)->public.orders";
    expect(screen.getByTestId(`edge-${id}`)).toHaveAttribute("data-edge-state", "default");
    fireEvent.click(container.querySelector(`[data-id="${id}"]`)!);
    expect(screen.getByTestId(`edge-${id}`)).toHaveAttribute("data-edge-state", "selected");
    act(() => useUiStore.getState().selectTable(null));
    fireEvent.click(nodeWrapper("payments"));
    expect(screen.getByTestId(`edge-${id}`)).toHaveAttribute("data-edge-state", "highlighted");
  });

  it.each([
    ["clicking a list item", () => fireEvent.click(screen.getByTestId("table-list-item-users"))],
    ["clicking a node", () => fireEvent.click(nodeWrapper("users"))],
    [
      "pressing Enter on a focused node",
      () => {
        const node = nodeWrapper("users");
        node.focus();
        fireEvent.keyDown(node, { key: "Enter" });
      },
    ],
    ["re-selecting the already-selected table", () => fireEvent.click(nodeWrapper("orders"))],
  ])("selecting a table by %s clears a clicked edge and its pinned label", (_name, selectTable) => {
    const { container } = renderWorkspace();
    act(() => useUiStore.getState().selectTable("public.orders"));
    const id = "fk:public.payments(order_id)->public.orders";
    fireEvent.click(container.querySelector(`[data-id="${id}"]`)!);
    expect(screen.getByTestId(`edge-label-${id}`)).toBeInTheDocument();
    act(() => selectTable());
    expect(screen.queryByTestId(`edge-label-${id}`)).toBeNull();
    expect(screen.getByTestId(`edge-${id}`)).not.toHaveAttribute("data-edge-state", "selected");
  });
});

/** Zoom as applied by React Flow to the viewport element (`translate(...) scale(z)`). */
function readCanvasZoom(container: HTMLElement): number {
  const style =
    container.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";
  return Number(style.match(/scale\(([\d.]+)\)/)?.[1] ?? Number.NaN);
}
