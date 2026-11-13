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

function renderWorkspace() {
  return render(
    <div>
      <TableList />
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
      <Inspector />
    </div>,
  );
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
});
