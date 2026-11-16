// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { Inspector } from "@/components/inspector/inspector";
import { TableList } from "./table-list";
import { Toolbar } from "./toolbar";

beforeEach(() => resetStores());

describe("Inspector", () => {
  it("shows an empty state when nothing is selected", () => {
    render(<Inspector />);
    expect(screen.getByTestId("inspector-empty")).toHaveTextContent("Select a table to inspect it");
  });

  it("shows the selected table's columns and relationship counts", () => {
    useUiStore.getState().selectTable("public.orders");
    render(<Inspector />);
    expect(screen.getByTestId("inspector-title")).toHaveTextContent("orders");
    expect(screen.getByTestId("inspector-column-count")).toHaveTextContent("7");
    expect(screen.getByTestId("inspector-outgoing-count")).toHaveTextContent("3");
    expect(screen.getByTestId("inspector-incoming-count")).toHaveTextContent("3");
    const userId = screen.getByTestId("inspector-column-user_id");
    expect(within(userId).getByText("FK")).toBeInTheDocument();
    expect(within(screen.getByTestId("inspector-column-id")).getByText("PK")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("inspector-column-coupon_id")).getByText("NULL"),
    ).toBeInTheDocument();
  });

  it("clears the selection from the close button", async () => {
    useUiStore.getState().selectTable("public.users");
    render(<Inspector />);
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(useUiStore.getState().selectedTableId).toBeNull();
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });
});

describe("TableList", () => {
  it("lists every table with column counts", () => {
    render(<TableList />);
    expect(screen.getByTestId("table-list-count")).toHaveTextContent("12");
    expect(screen.getByTestId("table-list-item-users")).toHaveTextContent("7");
    expect(screen.getByTestId("table-list-item-audit_log")).toHaveTextContent("5");
  });

  it("filters by name and shows an empty state", async () => {
    const user = userEvent.setup();
    render(<TableList />);
    await user.type(screen.getByTestId("table-filter"), "ORDER");
    expect(screen.getByTestId("table-list-count")).toHaveTextContent("2 / 12");
    expect(screen.getByTestId("table-list-item-orders")).toBeInTheDocument();
    expect(screen.getByTestId("table-list-item-order_items")).toBeInTheDocument();
    await user.clear(screen.getByTestId("table-filter"));
    await user.type(screen.getByTestId("table-filter"), "zzz");
    expect(screen.getByTestId("table-list-empty")).toHaveTextContent("No tables match");
  });

  it("selects and requests focus when a table is clicked", async () => {
    render(<TableList />);
    await userEvent.click(screen.getByTestId("table-list-item-orders"));
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");
    expect(useUiStore.getState().focusRequest?.tableId).toBe("public.orders");
    expect(screen.getByTestId("table-list-item-orders")).toHaveAttribute("aria-current", "true");
  });

  it("shows no list items before a schema is loaded", () => {
    act(() => resetStores(null));
    render(<TableList />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("Toolbar", () => {
  it("marks unavailable actions as disabled with an explanation", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Toolbar />
      </TooltipProvider>,
    );
    expect(screen.getByTestId("toolbar-import")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("toolbar-export")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("toolbar-layout")).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("toolbar-schema-name")).toHaveTextContent("E-commerce sample");
    await userEvent.hover(screen.getByTestId("toolbar-export"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Export is coming in Phase 3");
  });

  it("re-runs layout from the Layout button", async () => {
    const { useLayoutStore } = await import("@/stores/layout-store");
    render(
      <TooltipProvider>
        <Toolbar />
      </TooltipProvider>,
    );
    const before = useLayoutStore.getState().version;
    await userEvent.click(screen.getByTestId("toolbar-layout"));
    expect(useLayoutStore.getState().version).toBe(before + 1);
  });

  it("toggles side panels", async () => {
    render(
      <TooltipProvider>
        <Toolbar />
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByTestId("toolbar-toggle-left"));
    expect(useUiStore.getState().leftPanelOpen).toBe(false);
    expect(screen.getByTestId("toolbar-toggle-left")).toHaveAttribute("aria-pressed", "false");
  });
});
