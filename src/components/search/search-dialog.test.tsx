// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { applyImportedSchema } from "@/components/import/apply-import";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace/workspace";
import { parseSchemaText } from "@/parsers";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { SearchDialog } from "./search-dialog";
import { useGlobalShortcuts } from "@/components/commands/use-global-shortcuts";

function renderWorkspace() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Workspace />
    </TooltipProvider>,
  );
}

const input = () => screen.getByTestId("search-input");
const options = () => screen.queryAllByTestId("search-option");
const optionLabels = () => options().map((o) => `${o.dataset.kind}:${o.dataset.id}`);
const activeOption = () => {
  const id = input().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

/**
 * Keyboard activation: in jsdom every element has a zero rect, so the resizable-panels pointer
 * hit-testing claims clicks for a separator and moves focus there (not an issue in browsers).
 */
async function openWithButton(user: ReturnType<typeof userEvent.setup>) {
  act(() => screen.getByTestId("toolbar-search").focus());
  await user.keyboard("{Enter}");
  await screen.findByTestId("search-dialog");
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(input(), text);
  // Results follow the deferred query; wait until they belong to the typed text.
  await waitFor(() =>
    expect(
      screen.queryByTestId("search-status") ?? screen.getByTestId("search-empty"),
    ).not.toHaveTextContent(/^Type to search/),
  );
}

beforeEach(() => resetStores());

describe("Search dialog", () => {
  it("opens with ⌘K, Ctrl+K and /, but not with / in a text field", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByTestId("search-dialog")).toBeInTheDocument();
    expect(input()).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).toBeNull());

    const ctrlK = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(ctrlK);
    });
    expect(ctrlK.defaultPrevented).toBe(true); // Firefox would focus its own search bar
    expect(await screen.findByTestId("search-dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).toBeNull());

    act(() => screen.getByTestId("table-filter").focus());
    await user.keyboard("/");
    expect(screen.getByTestId("table-filter")).toHaveValue("/");
    expect(screen.queryByTestId("search-dialog")).toBeNull();
    act(() => useUiStore.getState().setTableFilter(""));

    screen.getByTestId("toolbar-search").focus();
    await user.keyboard("/");
    expect(await screen.findByTestId("search-dialog")).toBeInTheDocument();
  });

  it("is disabled without a schema", async () => {
    resetStores(null);
    function Harness() {
      useGlobalShortcuts();
      return (
        <TooltipProvider>
          <SearchDialog />
        </TooltipProvider>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByTestId("toolbar-search")).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByTestId("toolbar-search"));
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.queryByTestId("search-dialog")).toBeNull();
  });

  it("uses the combobox/listbox pattern; arrows wrap, Home/End jump", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openWithButton(user);
    expect(input()).toHaveAttribute("role", "combobox");
    expect(input()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(screen.getByTestId("search-status")).toHaveTextContent(
      "Type to search 12 tables and 71 columns",
    );
    await type(user, "user");
    expect(optionLabels()).toEqual([
      "table:public.users",
      "column:public.addresses.user_id",
      "column:public.orders.user_id",
      "column:public.reviews.user_id",
    ]);
    expect(screen.getByTestId("search-status")).toHaveTextContent("4 results");
    expect(activeOption()).toBe(options()[0]);
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe(options()[3]); // wraps
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe(options()[0]);
    await user.keyboard("{End}");
    expect(activeOption()).toBe(options()[3]);
    await user.keyboard("{Home}");
    expect(activeOption()).toBe(options()[0]);
    expect(within(screen.getByRole("listbox")).getAllByRole("group")).toHaveLength(2);
  });

  it("Enter on a table selects and centers it, clears a hiding filter, and closes", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    act(() => useUiStore.getState().setTableFilter("zzz"));
    await openWithButton(user);
    await type(user, "ordit");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).toBeNull());
    const ui = useUiStore.getState();
    expect(ui.selectedTableId).toBe("public.order_items");
    expect(ui.focusRequest?.tableId).toBe("public.order_items");
    expect(ui.tableFilter).toBe("");
    // Focus returns to the button without popping its tooltip (QA-015 pattern).
    expect(screen.getByTestId("toolbar-search")).toHaveFocus();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("Enter on a column highlights its row (even in a collapsed node); another selection clears it", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const { fingerprint } = useSchemaStore.getState();
    // Collapse modes have no UI yet (P3-T02); set one directly to cover the hidden-row case.
    act(() =>
      useLayoutStore.setState((s) => ({
        layouts: {
          ...s.layouts,
          [fingerprint!]: { ...s.layouts[fingerprint!]!, collapsed: { "public.orders": "header" } },
        },
      })),
    );
    await openWithButton(user);
    await type(user, "ord.user");
    await user.keyboard("{Enter}");
    const ui = useUiStore.getState();
    expect(ui.highlightedColumn).toEqual({
      tableId: "public.orders",
      columnId: "public.orders.user_id",
    });
    expect(ui.focusRequest?.columnId).toBe("public.orders.user_id");
    const node = await screen.findByTestId("table-node-orders");
    const row = within(node).getByTestId("column-user_id");
    expect(row).toHaveAttribute("data-highlighted", "true");
    expect(row).toHaveAttribute("data-revealed", "true");
    expect(within(node).getAllByRole("listitem")).toHaveLength(1); // header mode + the hit

    act(() => useUiStore.getState().selectTable("public.users"));
    expect(useUiStore.getState().highlightedColumn).toBeNull();
    expect(within(node).queryByTestId("column-user_id")).toBeNull();
  });

  it("Escape closes it without clearing the selection; a new import closes it and clears the highlight", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    act(() => useUiStore.getState().focusTable("public.orders", "public.orders.user_id"));
    await openWithButton(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).toBeNull());
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");

    act(() => useUiStore.getState().setSearchOpen(true));
    const sql = readFileSync(join(process.cwd(), "tests/fixtures/sql/shop.mysql.sql"), "utf8");
    act(() => applyImportedSchema(parseSchemaText(sql).result.schema!, sql));
    expect(useUiStore.getState()).toMatchObject({ searchOpen: false, highlightedColumn: null });
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).toBeNull());
  });

  it("shows '+ N more' beyond 50 hits and a no-match message", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openWithButton(user);
    await type(user, "zzzz");
    expect(screen.getByTestId("search-empty")).toHaveTextContent(
      "No tables or columns match “zzzz”.",
    );
    await user.clear(input());
    act(() => {
      const many = createWideSchema(120);
      applyImportedSchema(many);
      useUiStore.getState().setSearchOpen(true);
    });
    await screen.findByTestId("search-dialog");
    await type(user, "col");
    expect(options()).toHaveLength(50);
    expect(screen.getByTestId("search-more-columns")).toHaveTextContent(
      "+ 70 more columns — keep typing to narrow",
    );
  });

  it("ignores Enter while an IME is composing", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openWithButton(user);
    await type(user, "users");
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(screen.getByTestId("search-dialog")).toBeInTheDocument();
    expect(useUiStore.getState().focusRequest).toBeNull();
  });
});

describe("Search live region (QA-016)", () => {
  it("keeps one polite live region and changes only its text", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openWithButton(user);
    const live = screen.getByTestId("search-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Type to search 12 tables and 71 columns");
    await type(user, "user");
    expect(screen.getByTestId("search-live")).toBe(live);
    expect(live).toHaveTextContent("4 results");
    await type(user, "zzz");
    expect(screen.getByTestId("search-live")).toBe(live);
    expect(live).toHaveTextContent("No tables or columns match “userzzz”.");
    expect(screen.getByTestId("search-empty")).not.toHaveAttribute("aria-live");
    await user.clear(input());
    await type(user, "ord.user");
    expect(screen.getByTestId("search-live")).toBe(live);
    expect(live).toHaveTextContent("1 result");
    expect(document.querySelectorAll("[role=dialog] [aria-live]")).toHaveLength(1);
  });
});

describe("Search re-render isolation", () => {
  it("opening search and typing don't re-render the canvas", async () => {
    const commits = vi.fn();
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SearchDialog />
        <div style={{ width: 800, height: 600 }}>
          <Profiler id="canvas" onRender={commits}>
            <SchemaCanvas />
          </Profiler>
        </div>
      </TooltipProvider>,
    );
    await waitFor(() => expect(document.querySelectorAll(".react-flow__node").length).toBe(12));
    await new Promise((resolve) => setTimeout(resolve, 300));
    commits.mockClear();
    await openWithButton(user);
    await type(user, "user");
    await user.keyboard("{ArrowDown}");
    expect(commits).not.toHaveBeenCalled();
  });
});

function createWideSchema(columns: number) {
  const schema = useSchemaStore.getState().schema!;
  const table = schema.tables["public.users"]!;
  const wide = structuredClone(schema);
  wide.tables["public.users"] = {
    ...table,
    columns: Array.from({ length: columns }, (_, i) => ({
      ...table.columns[0]!,
      id: `public.users.col_${i}`,
      name: `col_${i}`,
      isPrimaryKey: false,
    })),
  };
  return wide;
}
