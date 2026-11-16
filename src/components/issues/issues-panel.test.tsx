// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { applyImportedSchema } from "@/components/import/apply-import";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toolbar } from "@/components/workspace/toolbar";
import { Workspace } from "@/components/workspace/workspace";
import type { ImportIssue } from "@/domain/schema/types";
import { decodeSchemaFile, parseSchemaText } from "@/parsers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";

function importFixture(path: string) {
  const bytes = new Uint8Array(readFileSync(join(process.cwd(), "tests/fixtures", path)));
  const decoded = decodeSchemaFile(bytes);
  if (!decoded.ok) throw new Error("binary fixture");
  const { result } = parseSchemaText(decoded.text, {
    format: path.endsWith(".prisma") ? "prisma" : "auto",
  });
  act(() => applyImportedSchema(result.schema!, decoded.text));
}

/** Loads the sample with the given issues attached (and optional source). */
function loadWithIssues(issues: ImportIssue[], sourceText?: string) {
  const schema = createEcommerceSchema();
  schema.issues = issues;
  act(() => applyImportedSchema(schema, sourceText));
}

function renderWorkspace() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Workspace />
    </TooltipProvider>,
  );
}

const rows = () => screen.getAllByTestId("issue-row");
const rowText = (row: HTMLElement) => row.textContent ?? "";
const viewportTransform = (c: HTMLElement) =>
  c.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform;

beforeEach(() => resetStores());
afterEach(() => vi.restoreAllMocks());

describe("Issues panel", () => {
  it("is disabled and closed for the sample (no issues)", () => {
    renderWorkspace();
    const button = screen.getByTestId("toolbar-issues");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleName("Issues: No import issues");
    expect(screen.queryByTestId("issues-panel")).toBeNull();
  });

  it("opens after an import with errors and lists issues errors-first, then by line", () => {
    renderWorkspace();
    importFixture("sql/edge-cases.postgres.sql");
    const button = screen.getByTestId("toolbar-issues");
    expect(button).toHaveAccessibleName("Issues: 1 error, 5 warnings");
    expect(screen.getByTestId("toolbar-issues-errors")).toHaveTextContent("1");
    expect(screen.getByTestId("toolbar-issues-warnings")).toHaveTextContent("5");
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();
    expect(rows().map((r) => within(r).queryByTestId("issue-line")?.textContent ?? "-")).toEqual([
      "line 27",
      "line 14",
      "line 23",
      "line 29",
      "line 31",
      "-",
    ]);
    expect(rowText(rows()[0]!)).toMatch(/^Error.*Duplicate table/);
    expect(rowText(rows()[1]!)).toMatch(/^Warning/);
  });

  it("filters by severity", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    importFixture("sql/edge-cases.postgres.sql");
    await user.click(screen.getByTestId("issues-filter-errors"));
    expect(rows()).toHaveLength(1);
    expect(screen.getByTestId("issues-filter-errors")).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByTestId("issues-filter-warnings"));
    expect(rows()).toHaveLength(5);
    await user.click(screen.getByTestId("issues-filter-all"));
    expect(rows()).toHaveLength(6);
  });

  it("'Show table' selects and centers the linked table and clears a filter that hides it", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    importFixture("sql/edge-cases.postgres.sql");
    act(() => useUiStore.getState().setTableFilter("zzz"));
    await user.click(within(rows()[0]!).getByTestId("issue-show-table"));
    const ui = useUiStore.getState();
    expect(ui.selectedTableId).toBe("public.users");
    expect(ui.focusRequest?.tableId).toBe("public.users");
    expect(ui.tableFilter).toBe("");
    expect(rows().filter((r) => within(r).queryByTestId("issue-show-table"))).toHaveLength(3);
  });

  it("disables 'Show table' when the linked table is not in the diagram", () => {
    renderWorkspace();
    loadWithIssues([{ severity: "error", message: "gone", tableId: "public.nope" }]);
    const button = within(rows()[0]!).getByTestId("issue-show-table");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(useUiStore.getState().selectedTableId).toBeNull();
  });

  it("toggles a source excerpt with the keyboard (±2 lines, issue line highlighted)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    importFixture("sql/edge-cases.postgres.sql");
    const toggle = within(rows()[2]!).getByTestId("issue-toggle"); // line 23, CREATE VIEW
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const excerpt = screen.getByTestId("issue-excerpt");
    expect(toggle).toHaveAttribute("aria-controls", excerpt.id);
    expect(excerpt.querySelectorAll(":scope pre > div")).toHaveLength(5);
    expect(excerpt).toHaveTextContent(/^21CREATE FUNCTION/);
    expect(screen.getByTestId("issue-excerpt-current")).toHaveTextContent(
      "23CREATE VIEW active_users AS SELECT * FROM users WHERE name <> ';';",
    );
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("issue-excerpt")).toBeNull();
  });

  it("cuts a multi-megabyte single-line source in the excerpt", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const source = `CREATE TABLE x (${"a int, ".repeat(700_000)}b int);`;
    loadWithIssues([{ severity: "error", message: "huge", line: 1 }], source);
    await user.click(screen.getByTestId("issue-toggle"));
    const current = screen.getByTestId("issue-excerpt-current");
    expect(current).toHaveTextContent(
      `… (${(source.length - 400).toLocaleString("en-US")} more characters)`,
    );
  });

  it("renders large lists in batches of 500", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    loadWithIssues(
      Array.from({ length: 2000 }, (_, k) => ({
        severity: "error" as const,
        message: `e${k}`,
        line: k + 1,
      })),
    );
    expect(rows()).toHaveLength(500);
    expect(screen.getByTestId("issues-show-more")).toHaveTextContent("Show 500 more");
    await user.click(screen.getByTestId("issues-show-more"));
    expect(rows()).toHaveLength(1000);
  });

  it("copies the issues as text, falls back without the Clipboard API, and never fails silently", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    importFixture("sql/edge-cases.postgres.sql");
    const expected = /^ERROR {3}line 27 {3}Duplicate table "public\.USERS"/;

    const writeText = vi.fn().mockResolvedValue(undefined);
    const secure = (value: boolean) =>
      Object.defineProperty(window, "isSecureContext", { configurable: true, value });
    secure(true);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByTestId("issues-copy"));
    expect(writeText.mock.calls[0]?.[0]).toMatch(expected);
    expect(screen.getByTestId("issues-copy")).toHaveTextContent("Copied");

    secure(false);
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    await user.click(screen.getByTestId("issues-copy"));
    expect(exec).toHaveBeenCalledWith("copy");

    exec.mockReturnValue(false);
    await user.click(screen.getByTestId("issues-copy"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Copy failed — select the text manually.",
    );
    expect((screen.getByTestId("issues-copy-fallback") as HTMLTextAreaElement).value).toMatch(
      expected,
    );
  });

  it("follows the open/close rules across imports; Escape does not close it", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    importFixture("sql/blog.sqlite.sql"); // warnings only
    expect(screen.queryByTestId("issues-panel")).toBeNull();

    importFixture("sql/edge-cases.postgres.sql"); // errors → opens
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("issues-close"));
    expect(screen.queryByTestId("issues-panel")).toBeNull();
    importFixture("sql/typeless.sqlite.sql"); // warnings only → stays closed
    expect(screen.queryByTestId("issues-panel")).toBeNull();
    importFixture("prisma/edge-cases.prisma"); // errors → re-opens
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();

    importFixture("sql/shop.mysql.sql"); // clean import while open → empty state, not closed
    expect(screen.getByTestId("issues-empty")).toHaveTextContent("No issues for this schema.");
  });

  it("opening, closing and resizing the panel keeps the canvas viewport", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspace();
    importFixture("sql/blog.sqlite.sql");
    // Let the import's fit-view animation (250 ms) finish before taking the reference.
    await waitFor(() => expect(viewportTransform(container)).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 500));
    const before = viewportTransform(container);
    await user.click(screen.getByTestId("toolbar-issues"));
    expect(screen.getByTestId("issues-panel")).toBeInTheDocument();
    window.dispatchEvent(new Event("resize"));
    await user.click(screen.getByTestId("issues-close"));
    expect(viewportTransform(container)).toBe(before);
  });

  it("uses a bottom sheet over the canvas on narrow screens (same test ids)", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    renderWorkspace();
    importFixture("sql/edge-cases.postgres.sql");
    const sheet = screen.getByTestId("issues-sheet");
    expect(within(sheet).getByTestId("issues-panel")).toBeInTheDocument();
    expect(screen.getAllByTestId("issues-panel")).toHaveLength(1);
    fireEvent.click(within(sheet).getByTestId("issues-close"));
    expect(screen.queryByTestId("issues-sheet")).toBeNull();
  });
});

describe("Issues re-render isolation", () => {
  it("setting the source text re-renders neither the toolbar nor the canvas", () => {
    const commits = vi.fn();
    render(
      <TooltipProvider>
        <Profiler id="toolbar" onRender={commits}>
          <Toolbar />
        </Profiler>
        <div style={{ width: 800, height: 600 }}>
          <Profiler id="canvas" onRender={commits}>
            <SchemaCanvas />
          </Profiler>
        </div>
      </TooltipProvider>,
    );
    commits.mockClear();
    act(() => useSchemaStore.setState({ sourceText: "CREATE TABLE a (id int);\n".repeat(1000) }));
    expect(commits).not.toHaveBeenCalled();
  });
});
