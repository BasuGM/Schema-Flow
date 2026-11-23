// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace/workspace";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";

function renderWorkspace() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Workspace />
    </TooltipProvider>,
  );
}
const input = () => screen.getByTestId("search-input");
const commandIds = () => screen.queryAllByTestId("command-option").map((o) => o.dataset.id);
const ui = () => useUiStore.getState();

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Control>}k{/Control}");
  await screen.findByTestId("search-dialog");
}

const t = (name: string, schemaName: string) => ({
  name,
  schemaName,
  columns: [{ name: "id", type: "int", primaryKey: true }],
});
const areaSchema = normalizeSchema(
  draft([t("a1", "core"), t("a2", "core"), t("b1", "billing"), t("b2", "billing")]),
);

beforeEach(() => resetStores());

describe("commands in the search dialog", () => {
  it("lists every command for an empty query, disabled ones included", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openPalette(user);
    expect(commandIds()).toEqual([
      "reset-view",
      "layout",
      "export",
      "export-image",
      "import",
      "health",
      "path-finder",
      "toggle-list",
      "toggle-inspector",
      "toggle-minimap",
      "theme-light",
      "theme-dark",
      "theme-system",
      "shortcuts",
      "clear-data",
    ]);
    const path = screen.getByText("Find path between tables").closest("[role=option]");
    expect(path).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("search-live")).toHaveTextContent(/Type to search/);
  });

  it("ranks commands for a typed query ahead of tables, and > shows commands only", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openPalette(user);
    await user.type(input(), "lay");
    await waitFor(() => expect(commandIds()[0]).toBe("layout"));
    await user.clear(input());
    await user.type(input(), ">exp");
    await waitFor(() => expect(commandIds()).toEqual(["export", "export-image"]));
    expect(screen.queryAllByTestId("search-option")).toEqual([]);
  });

  it("runs a command with Enter, closes the dialog and returns focus", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const before = screen.getByTestId("toolbar-toggle-left");
    act(() => before.focus());
    await openPalette(user);
    await user.type(input(), ">reset");
    await waitFor(() => expect(commandIds()).toEqual(["reset-view"]));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByTestId("search-dialog")).toBeNull());
    expect(ui().resetViewRequest).toBe(1);
    expect(document.activeElement).toBe(before);
  });

  it("opens Export from the palette and returns focus to where ⌘K was pressed", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const before = screen.getByTestId("toolbar-toggle-right");
    act(() => before.focus());
    await openPalette(user);
    await user.type(input(), ">export");
    await waitFor(() => expect(commandIds()[0]).toBe("export"));
    await user.keyboard("{Enter}");
    await screen.findByTestId("export-dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("export-dialog")).toBeNull());
    expect(document.activeElement).toBe(before);
  });

  it("skips a disabled command on Enter and keeps the dialog open", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await openPalette(user);
    await user.type(input(), ">path");
    await waitFor(() => expect(commandIds()).toEqual(["path-finder"]));
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("search-dialog")).toBeInTheDocument();
    expect(ui().inspectorTab).toBe("columns");
  });

  it("offers area commands only for a typed query", async () => {
    resetStores(areaSchema);
    const user = userEvent.setup();
    renderWorkspace();
    await openPalette(user);
    expect(commandIds().some((id) => id?.startsWith("area-"))).toBe(false);
    expect(commandIds()).toContain("show-all-areas");
    await user.type(input(), ">hide area");
    await waitFor(() => expect(commandIds().length).toBeGreaterThan(0));
    expect(commandIds().every((id) => id?.startsWith("area-toggle-"))).toBe(true);
  });
});
