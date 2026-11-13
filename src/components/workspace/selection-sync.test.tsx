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
});
