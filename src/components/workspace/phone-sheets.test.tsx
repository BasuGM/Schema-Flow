// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHEET_QUERY } from "@/components/issues/issues-sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { NARROW_QUERY } from "./use-panel-sync";
import { Workspace } from "./workspace";

/** A controllable viewport: `width` drives SHEET_QUERY (< 768) and NARROW_QUERY (≤ 900). */
let width = 390;
let listeners: { query: string; fn: () => void }[] = [];
const matches = (query: string, w: number) =>
  query === SHEET_QUERY ? w < 768 : query === NARROW_QUERY ? w <= 900 : false;
function mockViewport() {
  listeners = [];
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return matches(query, width);
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.push({ query, fn }),
        removeEventListener: (_: string, fn: () => void) => {
          listeners = listeners.filter((l) => l.fn !== fn);
        },
      }) as unknown as MediaQueryList,
  );
}
/** Like a browser: only queries whose result changed notify their listeners. */
const resize = (next: number) => {
  const before = width;
  width = next;
  const changed = listeners.filter((l) => matches(l.query, before) !== matches(l.query, next));
  act(() => changed.forEach((l) => l.fn()));
};

function renderWorkspace() {
  return render(
    <TooltipProvider>
      <Workspace />
    </TooltipProvider>,
  );
}
const toggleLeft = () => screen.getByTestId("toolbar-toggle-left");
const toggleRight = () => screen.getByTestId("toolbar-toggle-right");

beforeEach(() => {
  resetStores();
  width = 390;
  mockViewport();
});
afterEach(() => vi.restoreAllMocks());

describe("phone table list sheet (ADR-021)", () => {
  it("opens as a sheet (not a 0 px panel) with focus, and the toggle reports it", () => {
    renderWorkspace();
    expect(useUiStore.getState().leftPanelOpen).toBe(false);
    expect(toggleLeft()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggleLeft());
    const sheet = screen.getByTestId("table-list-sheet");
    expect(within(sheet).getByTestId("table-list")).toBeInTheDocument();
    expect(within(screen.getByTestId("panel-content-left")).queryByTestId("table-list")).toBeNull();
    expect(sheet).toHaveFocus();
    expect(toggleLeft()).toHaveAttribute("aria-expanded", "true");
    expect(toggleLeft()).toHaveAttribute("aria-pressed", "true");
  });

  it("picking a table closes the sheet and selects it; the inspector sheet stays closed (QA-014)", () => {
    renderWorkspace();
    fireEvent.click(toggleLeft());
    fireEvent.click(screen.getByTestId("table-list-item-orders"));
    expect(useUiStore.getState()).toMatchObject({
      selectedTableId: "public.orders",
      leftPanelOpen: false,
      rightPanelOpen: false,
    });
    expect(screen.queryByTestId("table-list-sheet")).toBeNull();
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
    expect(toggleLeft()).toHaveFocus();
  });

  it("Escape and the close button close it, without clearing the selection", () => {
    renderWorkspace();
    act(() => useUiStore.getState().selectTable("public.users"));
    fireEvent.click(toggleLeft());
    fireEvent.keyDown(screen.getByTestId("table-filter"), { key: "Escape" });
    expect(screen.queryByTestId("table-list-sheet")).toBeNull();
    expect(useUiStore.getState().selectedTableId).toBe("public.users");
    fireEvent.click(toggleLeft());
    fireEvent.click(screen.getByTestId("table-list-sheet-close"));
    expect(screen.queryByTestId("table-list-sheet")).toBeNull();
    expect(toggleLeft()).toHaveFocus();
  });

  it("keeps the filter text across closing and reopening", () => {
    renderWorkspace();
    fireEvent.click(toggleLeft());
    fireEvent.change(screen.getByTestId("table-filter"), { target: { value: "ord" } });
    fireEvent.click(screen.getByTestId("table-list-sheet-close"));
    fireEvent.click(toggleLeft());
    expect(screen.getByTestId("table-filter")).toHaveValue("ord");
  });

  it("shows one sheet at a time: opening the inspector closes the list, and back", () => {
    renderWorkspace();
    fireEvent.click(toggleLeft());
    fireEvent.click(toggleRight());
    expect(screen.queryByTestId("table-list-sheet")).toBeNull();
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    fireEvent.click(toggleLeft());
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
    expect(screen.getByTestId("table-list-sheet")).toBeInTheDocument();
    expect(toggleRight()).toHaveAttribute("aria-expanded", "false");
  });

  it("widening past md with the sheet open docks the list, keeping focus and state", () => {
    renderWorkspace();
    fireEvent.click(toggleLeft());
    act(() => screen.getByTestId("table-filter").focus());
    resize(820);
    expect(screen.queryByTestId("table-list-sheet")).toBeNull();
    const docked = screen.getByTestId("panel-content-left");
    expect(docked).not.toHaveAttribute("inert");
    expect(within(docked).getByTestId("table-list")).toBeInTheDocument();
    expect(toggleLeft()).toHaveAttribute("aria-expanded", "true");
    expect(toggleLeft()).toHaveFocus();
  });
});

describe("Enter on resize separators", () => {
  beforeEach(() => {
    width = 1280;
  });
  const separator = (name: string) => screen.getByRole("separator", { name });
  const enter = (el: HTMLElement) => {
    act(() => el.focus());
    fireEvent.keyDown(el, { key: "Enter" });
  };

  it.each([
    ["Resize table list", "left"],
    ["Resize inspector", "right"],
  ] as const)("%s: Enter collapses and restores its own side panel", (name, side) => {
    renderWorkspace();
    const key = side === "left" ? "leftPanelOpen" : "rightPanelOpen";
    expect(useUiStore.getState()[key]).toBe(true);
    enter(separator(name));
    expect(useUiStore.getState()[key]).toBe(false);
    expect(screen.getByTestId(`panel-content-${side}`)).toHaveAttribute("inert");
    expect(separator(name)).toHaveFocus();
    expect(screen.getByTestId(`toolbar-toggle-${side}`)).toHaveAttribute("aria-expanded", "false");
    enter(separator(name));
    expect(useUiStore.getState()[key]).toBe(true);
    expect(screen.getByTestId(`panel-content-${side}`)).not.toHaveAttribute("inert");
  });

  it("Resize issues panel: Enter closes the docked issues panel and focus moves to Issues (QA-021)", () => {
    renderWorkspace();
    act(() => {
      useSchemaStore.setState({ issues: [{ severity: "warning", message: "Skipped a view." }] });
      useUiStore.getState().setIssuesPanelOpen(true);
    });
    enter(separator("Resize issues panel"));
    expect(useUiStore.getState().issuesPanelOpen).toBe(false);
    // The separator is hidden with the panel, so focus can't stay on it; it must not fall to body.
    const issues = screen.getByTestId("toolbar-issues");
    expect(issues).toHaveFocus();
    expect(issues).toHaveAttribute("aria-pressed", "false");
    // Enter on the focused button (a native button click) opens the panel again.
    fireEvent.click(issues);
    expect(useUiStore.getState().issuesPanelOpen).toBe(true);
  });

  it("leaves arrow keys, Home and End to the library (QA-017 regression)", () => {
    renderWorkspace();
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      const el = separator("Resize inspector");
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      act(() => {
        el.dispatchEvent(event);
      });
      // The library handled (and prevented) it; our Enter handler did not touch the store.
      expect(event.defaultPrevented, key).toBe(true);
    }
  });
});
