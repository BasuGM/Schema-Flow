// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { Inspector } from "./inspector";

const t = (name: string, refs: string[] = []) => ({
  name,
  columns: [
    { name: "id", type: "int", primaryKey: true },
    ...refs.map((r) => ({ name: `${r}_id`, type: "int", references: { table: r } })),
  ],
});

// a -> b <- e, b -> c -> d; f isolated
const SCHEMA = normalizeSchema(
  draft([t("a", ["b"]), t("b", ["c"]), t("c", ["d"]), t("d"), t("e", ["b"]), t("f")]),
);

function setup(selected = "a", sheet = false) {
  resetStores(SCHEMA);
  render(
    <TooltipProvider>
      <Inspector sheet={sheet} />
    </TooltipProvider>,
  );
  act(() => {
    useUiStore.getState().selectTable(selected);
    useUiStore.getState().setInspectorTab("path");
  });
  return userEvent.setup();
}

const input = () => screen.getByTestId("path-target-input");
const optionNames = () => screen.getAllByTestId("path-target-option").map((o) => o.textContent);

beforeEach(() => resetStores());

describe("Path tab", () => {
  it("lists tables except the selected one, with a hint, and filters as you type", async () => {
    const user = setup();
    expect(optionNames()).toEqual(["b", "c", "d", "e", "f"]);
    expect(screen.getByTestId("path-target-hint")).toHaveTextContent("Type to narrow (5 tables)");
    await user.type(input(), "e");
    expect(optionNames()).toEqual(["e"]);
    expect(optionNames()).not.toContain("a");
  });

  it("Enter picks the highlighted table; arrows move; hops read child → parent with direction", async () => {
    const user = setup();
    await user.click(input());
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowDown}"); // c
    expect(input()).toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("path-summary")).toHaveTextContent("a → c: 2 hops");
    const hops = screen.getAllByTestId("path-hop");
    expect(hops).toHaveLength(2);
    expect(hops[0]).toHaveTextContent("a references b");
    expect(hops[0]).toHaveTextContent("a.b_id → b.id");
    expect(hops[1]).toHaveTextContent("b references c");
    expect(useUiStore.getState().activePath?.path.tables).toEqual(["a", "b", "c"]);
  });

  it("shows both walk directions in one path", async () => {
    const user = setup();
    await user.type(input(), "e{Enter}");
    const hops = screen.getAllByTestId("path-hop");
    expect(hops[0]).toHaveTextContent("a references b");
    expect(hops[1]).toHaveTextContent("b referenced by e");
    expect(hops[1]).toHaveTextContent("e.b_id → b.id");
  });

  it("says so when no chain of foreign keys connects the tables", async () => {
    const user = setup();
    await user.type(input(), "f");
    await user.click(screen.getByTestId("path-target-option"));
    expect(screen.getByTestId("path-none")).toHaveTextContent("No path between a and f");
    expect(useUiStore.getState().activePath).toBeNull();
  });

  it("Escape in the field clears the query only", async () => {
    const user = setup();
    await user.type(input(), "e{Enter}");
    await user.type(input(), "c");
    await user.keyboard("{Escape}");
    expect(input()).toHaveValue("");
    expect(useUiStore.getState().activePath).not.toBeNull();
    expect(useUiStore.getState().selectedTableId).toBe("a");
  });

  it("Show on canvas fits the path tables; in the phone sheet it also closes the inspector", async () => {
    const user = setup("a", true);
    await user.type(input(), "c{Enter}");
    await user.click(screen.getByTestId("path-show"));
    expect(useUiStore.getState().fitRequest?.tableIds).toEqual(["a", "b", "c"]);
    expect(useUiStore.getState().rightPanelOpen).toBe(false);
  });

  it("Show on canvas keeps the panel open on desktop", async () => {
    const user = setup();
    await user.type(input(), "c{Enter}");
    await user.click(screen.getByTestId("path-show"));
    expect(useUiStore.getState().rightPanelOpen).toBe(true);
  });

  it("Clear removes the path and returns focus to the field", async () => {
    const user = setup();
    await user.type(input(), "c{Enter}");
    await user.click(screen.getByTestId("path-clear"));
    expect(useUiStore.getState().activePath).toBeNull();
    expect(screen.queryByTestId("path-result")).toBeNull();
    expect(input()).toHaveFocus();
  });

  it("selecting a table from a hop keeps the path and notes where it started", async () => {
    const user = setup();
    await user.type(input(), "c{Enter}");
    await user.click(
      within(screen.getAllByTestId("path-hop")[0]!).getByRole("button", { name: "Show table b" }),
    );
    expect(useUiStore.getState().selectedTableId).toBe("b");
    expect(useUiStore.getState().inspectorTab).toBe("path");
    expect(useUiStore.getState().activePath?.from).toBe("a");
    expect(screen.getByTestId("path-result")).toHaveTextContent("Path from a");
  });

  it("qualifies names that need a schema", () => {
    const s = normalizeSchema(
      draft([
        { ...t("wide"), schemaName: "core" },
        { ...t("wide"), schemaName: "billing" },
        { ...t("x"), schemaName: "core" },
      ]),
    );
    resetStores(s);
    render(
      <TooltipProvider>
        <Inspector />
      </TooltipProvider>,
    );
    act(() => {
      useUiStore.getState().selectTable("core.x");
      useUiStore.getState().setInspectorTab("path");
    });
    expect(optionNames()).toEqual(["core.wide", "billing.wide"]);
    expect(useSchemaStore.getState().schema).not.toBeNull();
  });
});
