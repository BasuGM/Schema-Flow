// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedSchema } from "@/components/import/apply-import";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toolbar } from "@/components/workspace/toolbar";
import { Workspace } from "@/components/workspace/workspace";
import { ThemeProvider } from "next-themes";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import * as analysis from "@/analysis/health";

function renderWorkspace() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Workspace />
    </TooltipProvider>,
  );
}

beforeEach(() => resetStores());
afterEach(() => vi.restoreAllMocks());

const healthRows = () => within(screen.getByTestId("health-list")).getAllByTestId("issue-row");

describe("Health tab", () => {
  it("opens on Health from the toolbar button when there are no import issues", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("toolbar-issues"));
    expect(screen.getByTestId("health-panel")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-tab-health")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("toolbar-issues")).toHaveAccessibleName(
      "Issues and health checks: No import issues",
    );
  });

  it("shows tab counts and lists findings with info and warning severities", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("toolbar-issues"));
    const found = analysis.analyzeSchema(createEcommerceSchema());
    expect(screen.getByTestId("bottom-tab-health")).toHaveTextContent(`Health ${found.length}`);
    expect(screen.getByTestId("bottom-tab-issues")).toHaveTextContent("Issues 0");
    expect(healthRows()).toHaveLength(found.length);
    expect(healthRows()[0]).toHaveAttribute("data-severity", "warning");
    expect(healthRows().at(-1)).toHaveAttribute("data-severity", "info");
  });

  it("filters by check", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("toolbar-issues"));
    const counts = analysis.countFindings(analysis.analyzeSchema(createEcommerceSchema()));
    await user.click(screen.getByTestId("health-filter-unindexed-fk"));
    expect(healthRows()).toHaveLength(counts["unindexed-fk"]);
    expect(screen.getByTestId("health-filter-unindexed-fk")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("'Show table' selects the table", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("toolbar-issues"));
    await user.click(within(healthRows()[0]!).getByTestId("issue-show-table"));
    expect(useUiStore.getState().selectedTableId).toBe(
      analysis.analyzeSchema(createEcommerceSchema())[0]?.tableId,
    );
  });

  it("switches tabs with the arrow keys and keeps focus on the tab", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("toolbar-issues"));
    screen.getByTestId("bottom-tab-health").focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("bottom-tab-issues")).toHaveFocus();
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();
    expect(useUiStore.getState().issuesPanelTab).toBe("issues");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("bottom-tab-health")).toHaveFocus();
    expect(screen.getByTestId("health-panel")).toBeInTheDocument();
  });

  it("does not analyse while the panel is closed, and only once per schema when open", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(analysis, "analyzeSchema");
    renderWorkspace();
    expect(spy).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("toolbar-issues"));
    await user.click(screen.getByTestId("bottom-tab-issues"));
    await user.click(screen.getByTestId("bottom-tab-health"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state and disables Copy when nothing is found", () => {
    renderWorkspace();
    const clean = normalizeSchema(
      draft([
        { name: "a", columns: [{ name: "id", type: "integer", primaryKey: true }] },
        { name: "b", columns: [{ name: "id", type: "integer", primaryKey: true }] },
      ]),
    );
    act(() => {
      applyImportedSchema(clean);
      useUiStore.getState().openHealthPanel();
    });
    expect(screen.getByTestId("health-empty")).toHaveTextContent("No health findings.");
    expect(screen.getByTestId("health-copy")).toBeDisabled();
  });

  it.each([
    ["toolbar-settings", "settings-health"],
    ["toolbar-more", "more-health"],
  ])(
    "%s → Schema health opens the panel on Health, even after the Issues tab was used",
    async (trigger, item) => {
      const user = userEvent.setup();
      render(
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <Toolbar />
          </TooltipProvider>
        </ThemeProvider>,
      );
      act(() => useUiStore.getState().setIssuesPanelTab("issues"));
      await user.click(screen.getByTestId(trigger));
      await user.click(await screen.findByTestId(item));
      const ui = useUiStore.getState();
      expect(ui.issuesPanelOpen).toBe(true);
      expect(ui.issuesPanelTab).toBe("health");
    },
  );
});
