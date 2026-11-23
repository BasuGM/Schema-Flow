// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "./use-global-shortcuts";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace/workspace";
import { useLayoutStore } from "@/stores/layout-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";

function renderWorkspace() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Workspace />
    </TooltipProvider>,
  );
}
const key = (k: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  act(() => {
    fireEvent.keyDown(target, { key: k, ...init });
  });
const ui = () => useUiStore.getState();

beforeEach(() => resetStores());

describe("global shortcuts", () => {
  it("runs each single key once", () => {
    renderWorkspace();
    const relayout = vi.spyOn(useLayoutStore.getState(), "relayout");
    key("f");
    expect(ui().resetViewRequest).toBe(1);
    key("L", { shiftKey: true });
    expect(relayout).toHaveBeenCalledTimes(1);
    key("h");
    expect(ui().issuesPanelOpen).toBe(true);
    expect(ui().issuesPanelTab).toBe("health");
    key("e");
    expect(ui().exportOpen).toBe(true);
  });

  it("toggles the panels with [ and ]", () => {
    renderWorkspace();
    expect(ui().leftPanelOpen).toBe(true);
    key("[");
    expect(ui().leftPanelOpen).toBe(false);
    key("]");
    expect(ui().rightPanelOpen).toBe(false);
  });

  it("opens Import and Shortcuts, and ? does not open search", () => {
    renderWorkspace();
    key("?", { shiftKey: true });
    expect(ui().shortcutsOpen).toBe(true);
    expect(ui().searchOpen).toBe(false);
    act(() => ui().setShortcutsOpen(false));
    key("i");
    expect(ui().importOpen).toBe(true);
  });

  it("ignores keys in a text field, with a dialog or menu open, with modifiers and on repeat", () => {
    renderWorkspace();
    const field = document.createElement("input");
    document.body.append(field);
    key("f", {}, field);
    key("f", { ctrlKey: true });
    key("f", { metaKey: true });
    key("f", { altKey: true });
    key("f", { repeat: true });
    expect(ui().resetViewRequest).toBe(0);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    key("f");
    expect(ui().resetViewRequest).toBe(0);
    dialog.remove();
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    key("f");
    expect(ui().resetViewRequest).toBe(0);
    menu.remove();
    field.remove();
    key("f");
    expect(ui().resetViewRequest).toBe(1);
  });

  it("needs a schema, except for Import, help and the panel toggles", () => {
    resetStores(null);
    // Not the Workspace: it would restore the sample schema on its own.
    function Harness() {
      useGlobalShortcuts();
      return null;
    }
    render(<Harness />);
    key("f");
    key("e");
    key("h");
    expect(ui().resetViewRequest).toBe(0);
    expect(ui().exportOpen).toBe(false);
    key("i");
    expect(ui().importOpen).toBe(true);
  });

  it("does nothing while search is open", () => {
    renderWorkspace();
    act(() => ui().setSearchOpen(true));
    key("f");
    expect(ui().resetViewRequest).toBe(0);
  });

  it("moves focus to the toolbar toggle when [ collapses the panel that has focus", () => {
    renderWorkspace();
    const inList = screen.getByTestId("panel-content-left").querySelector<HTMLElement>("button");
    expect(inList).not.toBeNull();
    act(() => inList!.focus());
    key("[", {}, inList!);
    expect(document.activeElement).toBe(screen.getByTestId("toolbar-toggle-left"));
  });

  it("on phones E, I and ? close the sheets first; other keys leave them open", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    try {
      renderWorkspace();
      act(() => ui().setIssuesPanelOpen(true));
      key("l");
      expect(ui().issuesPanelOpen).toBe(true);
      key("e");
      expect(ui().exportOpen).toBe(true);
      expect(ui().issuesPanelOpen).toBe(false);
      expect(ui().leftPanelOpen).toBe(false);
      expect(ui().rightPanelOpen).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
