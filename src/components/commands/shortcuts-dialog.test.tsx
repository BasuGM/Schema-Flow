// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace/workspace";
import { resetStores } from "@/test/store-helpers";
import { SHORTCUTS } from "./shortcuts";

function renderWorkspace() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Workspace />
    </TooltipProvider>,
  );
}

beforeEach(() => resetStores());

describe("shortcuts dialog", () => {
  it("opens with ? and lists exactly the SHORTCUTS table", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.keyboard("?");
    const dialog = await screen.findByTestId("shortcuts-dialog");
    const rows = screen.getAllByTestId("shortcut-row");
    expect(rows.map((r) => r.dataset.id)).toEqual(SHORTCUTS.map((s) => s.id));
    expect(dialog).toHaveTextContent("Keyboard shortcuts");
  });

  it("closes with Escape and returns focus to where it was", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const before = screen.getByTestId("toolbar-toggle-right");
    act(() => before.focus());
    await user.keyboard("?");
    await screen.findByTestId("shortcuts-dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shortcuts-dialog")).toBeNull());
    expect(document.activeElement).toBe(before);
  });

  it("opens from the Settings menu and returns focus to the Settings button", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const settings = screen.getByTestId("toolbar-settings");
    act(() => settings.focus());
    await user.keyboard("{Enter}");
    await user.click(await screen.findByTestId("settings-shortcuts"));
    await screen.findByTestId("shortcuts-dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("shortcuts-dialog")).toBeNull());
    expect(document.activeElement).toBe(settings);
  });

  it("puts aria-keyshortcuts on the toolbar buttons that have a key", () => {
    renderWorkspace();
    expect(screen.getByTestId("toolbar-layout")).toHaveAttribute("aria-keyshortcuts", "l");
    expect(screen.getByTestId("toolbar-export")).toHaveAttribute("aria-keyshortcuts", "e");
    expect(screen.getByTestId("toolbar-import")).toHaveAttribute("aria-keyshortcuts", "i");
    expect(screen.getByTestId("toolbar-toggle-left")).toHaveAttribute("aria-keyshortcuts", "[");
    expect(screen.getByTestId("toolbar-toggle-right")).toHaveAttribute("aria-keyshortcuts", "]");
    expect(screen.getByTestId("toolbar-issues")).toHaveAttribute("aria-keyshortcuts", "h");
  });
});
