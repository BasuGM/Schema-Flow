// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedSchema } from "@/components/import/apply-import";
import { SHEET_QUERY } from "@/components/issues/issues-sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace/workspace";
import { parseSchemaText } from "@/parsers";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { ErrorBoundary } from "./error-boundary";
import { qaHooks, type QaRegion } from "./qa-crash";

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetStores();
  vi.stubEnv("NEXT_PUBLIC_QA_HOOKS", "1");
  // React and the boundary both log a caught render error; keep the run's output readable.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  act(() => qaHooks.heal());
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const crash = (region: QaRegion) => act(() => qaHooks.crash(region));
const heal = () => act(() => qaHooks.heal());
const boundaryLogs = () =>
  consoleError.mock.calls.filter((c: unknown[]) => String(c[0]).startsWith("SchemaFlow: "));

describe("ErrorBoundary", () => {
  let renders = 0;
  let fail = true;
  function Flaky() {
    renders++;
    if (fail) throw new Error("boom");
    return <p data-testid="ok">ok</p>;
  }

  it("shows the region fallback with the error and logs one line naming the region", () => {
    renders = 0;
    fail = true;
    render(
      <ErrorBoundary region="table list" testId="list-error">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("list-error")).toHaveTextContent(
      "The table list could not be displayed.boom",
    );
    expect(screen.getByRole("alert")).toBe(screen.getByTestId("list-error"));
    expect(boundaryLogs().map((c: unknown[]) => c[0])).toEqual([
      "SchemaFlow: the table list could not be displayed.",
    ]);
  });

  it("'Try again' while the child still throws shows the fallback again, with no render loop", async () => {
    renders = 0;
    fail = true;
    render(
      <ErrorBoundary region="inspector" testId="x-error">
        <Flaky />
      </ErrorBoundary>,
    );
    const afterFirst = renders;
    await userEvent.click(screen.getByTestId("x-error-retry"));
    expect(screen.getByTestId("x-error")).toBeInTheDocument();
    const afterRetry = renders;
    // One attempt per click (React may retry a failed render once, synchronously).
    expect(afterRetry - afterFirst).toBeGreaterThan(0);
    expect(afterRetry - afterFirst).toBeLessThanOrEqual(afterFirst);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(renders).toBe(afterRetry);
    expect(boundaryLogs()).toHaveLength(2);

    fail = false;
    await userEvent.click(screen.getByTestId("x-error-retry"));
    expect(screen.getByTestId("ok")).toBeInTheDocument();
  });

  it("moves focus to 'Try again' when the failed region held it", () => {
    fail = true;
    render(
      <ErrorBoundary region="search" testId="s-error">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("s-error-retry")).toHaveFocus();
  });

  it("retries when a reset key changes (e.g. a new import)", () => {
    fail = true;
    const { rerender } = render(
      <ErrorBoundary region="issues panel" testId="i-error" resetKeys={["a"]}>
        <Flaky />
      </ErrorBoundary>,
    );
    fail = false;
    rerender(
      <ErrorBoundary region="issues panel" testId="i-error" resetKeys={["b"]}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("ok")).toBeInTheDocument();
  });
});

function renderWorkspace() {
  return render(
    <TooltipProvider>
      <Workspace />
    </TooltipProvider>,
  );
}

describe("workspace regions (QA hooks)", () => {
  it.each([
    ["table-list", "table-list-error", "The table list could not be displayed."],
    ["inspector", "inspector-error", "The inspector could not be displayed."],
    ["canvas", "canvas-error", "The diagram could not be displayed."],
  ] as const)("a render error in the %s is contained", (region, testId, text) => {
    renderWorkspace();
    crash(region);
    expect(screen.getByTestId(testId)).toHaveTextContent(text);
    // The rest of the workspace keeps working.
    expect(screen.getByTestId("toolbar-import")).toBeEnabled();
    expect(screen.queryAllByTestId(/-error$/)).toHaveLength(1);
    heal();
    fireEvent.click(screen.getByTestId(`${testId}-retry`));
    expect(screen.queryByTestId(testId)).toBeNull();
  });

  it("a new import resets a failed region", () => {
    renderWorkspace();
    crash("table-list");
    heal();
    expect(screen.getByTestId("table-list-error")).toBeInTheDocument();
    const sql = readFileSync(join(process.cwd(), "tests/fixtures/sql/shop.mysql.sql"), "utf8");
    act(() => applyImportedSchema(parseSchemaText(sql).result.schema!, sql));
    expect(screen.queryByTestId("table-list-error")).toBeNull();
    expect(screen.getByTestId("table-list")).toBeInTheDocument();
  });

  it("the issues panel fallback can be closed", () => {
    renderWorkspace();
    act(() => useUiStore.getState().setIssuesPanelOpen(true));
    crash("issues");
    const fallback = screen.getByTestId("issues-error");
    fireEvent.click(within(fallback).getByTestId("issues-error-close"));
    expect(useUiStore.getState().issuesPanelOpen).toBe(false);
  });

  it("the inspector sheet fallback keeps Close and Escape (phones)", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === SHEET_QUERY,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    renderWorkspace();
    act(() => useUiStore.getState().setPanelOpen("right", true));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    crash("inspector");
    const retry = within(screen.getByTestId("inspector-sheet")).getByTestId(
      "inspector-error-retry",
    );
    expect(retry).toHaveFocus();
    fireEvent.keyDown(retry, { key: "Escape" });
    expect(useUiStore.getState().rightPanelOpen).toBe(false);
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
  });

  it.each([
    ["search", "toolbar-search", "search-dialog", "search-error"],
    ["import", "toolbar-import", "import-dialog", "import-error"],
  ] as const)(
    "the %s dialog fallback takes focus and closes with Close or Escape",
    async (region, trigger, dialog, testId) => {
      const user = userEvent.setup();
      renderWorkspace();
      await user.click(screen.getByTestId(trigger));
      await screen.findByTestId(dialog);
      crash(region);
      expect(screen.getByTestId(`${testId}-retry`)).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(screen.queryByTestId(dialog)).toBeNull();

      await user.click(screen.getByTestId(trigger));
      await user.click(await screen.findByTestId(`${testId}-close`));
      expect(screen.queryByTestId(dialog)).toBeNull();
    },
  );
});
