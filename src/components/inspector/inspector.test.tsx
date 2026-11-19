// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { applyImportedSchema } from "@/components/import/apply-import";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace/workspace";
import type { Schema } from "@/domain/schema/types";
import { parseSchemaText } from "@/parsers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { Inspector } from "./inspector";

/**
 * Inspector next to a real canvas. Not the full workspace: in jsdom every rect is 0×0, so the
 * resizable-panels pointer hit-testing claims clicks for a separator and Radix Tabs never see them
 * (a jsdom artefact; the workspace is checked in headless Chrome).
 */
function renderWorkspace() {
  return render(
    <TooltipProvider>
      <Inspector />
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
    </TooltipProvider>,
  );
}

function renderFullWorkspace() {
  return render(
    <TooltipProvider>
      <Workspace />
    </TooltipProvider>,
  );
}

const select = (id: string) => act(() => useUiStore.getState().selectTable(id));
const tab = (name: string) => screen.getByTestId(`inspector-tab-${name}`);
const inspector = () => screen.getByTestId("inspector");
const canvasRow = (table: string, column: string) =>
  within(screen.getByTestId(`table-node-${table}`)).getByTestId(`column-${column}`);

beforeEach(() => resetStores());

describe("Inspector tabs", () => {
  it("shows counts per tab and moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.orders");
    expect(tab("columns")).toHaveTextContent("Columns7");
    expect(tab("keys")).toHaveTextContent("Keys2");
    expect(tab("relations")).toHaveTextContent("Relations6");
    expect(tab("columns")).toHaveAttribute("aria-selected", "true");
    act(() => tab("columns").focus());
    await user.keyboard("{ArrowRight}");
    expect(tab("keys")).toHaveAttribute("aria-selected", "true");
    expect(within(inspector()).getAllByTestId("inspector-index")).toHaveLength(1);
    await user.keyboard("{End}");
    expect(tab("relations")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the chosen tab across selections and resets it on a new import", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.orders");
    await user.click(tab("relations"));
    select("public.users");
    expect(tab("relations")).toHaveAttribute("aria-selected", "true");
    const sql = readFileSync(join(process.cwd(), "tests/fixtures/sql/shop.mysql.sql"), "utf8");
    act(() => applyImportedSchema(parseSchemaText(sql).result.schema!, sql));
    expect(useUiStore.getState().inspectorTab).toBe("columns");
  });

  it("shows empty states for a table without keys or relations", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.audit_log");
    await user.click(tab("keys"));
    for (const text of [
      "No primary key",
      "No unique constraints",
      "No indexes",
      "No check constraints",
    ]) {
      expect(inspector()).toHaveTextContent(text);
    }
    await user.click(tab("relations"));
    expect(inspector()).toHaveTextContent("No foreign keys");
    expect(inspector()).toHaveTextContent("Not referenced");
  });

  it("hides the default schema name (public on PostgreSQL)", () => {
    renderWorkspace();
    select("public.orders");
    expect(screen.queryByTestId("inspector-schema")).toBeNull();
  });
});

describe("Inspector clear selection (QA-026)", () => {
  it("keeps focus in the panel (the empty message), not on <body>, after the X button", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.orders");
    await user.click(screen.getByTestId("inspector-close"));
    expect(useUiStore.getState().selectedTableId).toBeNull();
    await vi.waitFor(() => expect(screen.getByTestId("inspector-empty")).toHaveFocus());
  });
});

describe("Inspector columns", () => {
  it("shows type, default, FK target, enum values and comment", () => {
    renderWorkspace();
    select("public.orders");
    const status = screen.getByTestId("inspector-column-status");
    expect(within(status).getByTestId("inspector-column-default")).toHaveTextContent("= 'pending'");
    expect(within(status).getByTestId("inspector-column-enum")).toHaveTextContent(
      "pendingpaidshippeddeliveredcancelled",
    );
    expect(
      within(screen.getByTestId("inspector-column-id")).getByTestId("inspector-column-default"),
    ).toHaveTextContent("auto-increment");
    expect(
      within(screen.getByTestId("inspector-column-user_id")).getByTestId("inspector-column-fk"),
    ).toHaveTextContent("users.id");
  });

  it("clicking a column highlights it and only pans if needed; an FK link goes to the target", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.orders");
    await user.click(
      within(screen.getByTestId("inspector-column-status")).getByRole("button", { name: /status/ }),
    );
    expect(useUiStore.getState()).toMatchObject({
      highlightedColumn: { tableId: "public.orders", columnId: "public.orders.status" },
      focusRequest: { columnId: "public.orders.status", mode: "ensure-visible" },
    });
    expect(canvasRow("orders", "status")).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId("inspector-column-status")).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: "Highlight column users.id" }));
    const ui = useUiStore.getState();
    expect(ui.selectedTableId).toBe("public.users");
    expect(ui.focusRequest).toMatchObject({ columnId: "public.users.id", mode: undefined });
    expect(canvasRow("users", "id")).toHaveAttribute("data-highlighted", "true");
  });

  it("a search hit switches to Columns and marks the inspector row", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.orders");
    await user.click(tab("keys"));
    act(() => useUiStore.getState().focusTable("public.orders", "public.orders.placed_at"));
    expect(tab("columns")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("inspector-column-placed_at")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("toggles long enum lists and long check expressions", async () => {
    const user = userEvent.setup();
    const schema = createEcommerceSchema();
    schema.enums["order_status"]!.values = Array.from({ length: 12 }, (_, i) => `s${i}`);
    schema.tables["public.products"]!.checkConstraints[0]!.expression =
      `price_cents >= ${"0 + ".repeat(60)}0`;
    resetStores(schema);
    renderWorkspace();
    select("public.orders");
    const status = screen.getByTestId("inspector-column-status");
    expect(within(status).getAllByText(/^s\d+$/)).toHaveLength(8);
    await user.click(within(status).getByTestId("inspector-enum-more"));
    expect(within(status).getAllByText(/^s\d+$/)).toHaveLength(12);

    select("public.products");
    await user.click(tab("keys"));
    const check = screen.getAllByTestId("inspector-check")[0]!;
    expect(check.textContent).toMatch(/…Show more$/);
    await user.click(within(check).getByTestId("inspector-show-more"));
    expect(check).toHaveTextContent("Show less");
  });

  it("renders 100 columns at a time, plus a highlighted one beyond the cap", async () => {
    const user = userEvent.setup();
    resetStores(wideSchema(250));
    renderWorkspace();
    select("public.users");
    const rows = () => within(screen.getByTestId("inspector-columns")).getAllByRole("listitem");
    expect(rows()).toHaveLength(100);
    await user.click(screen.getByTestId("inspector-columns-more"));
    expect(rows()).toHaveLength(200);
    act(() => useUiStore.getState().focusTable("public.users", "public.users.c_240"));
    expect(rows()).toHaveLength(241);
    expect(screen.getByTestId("inspector-column-c_240")).toHaveAttribute("aria-current", "true");
  });
});

describe("Inspector relations", () => {
  it("navigates to the related table and Back restores the table and the tab", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.orders");
    await user.click(tab("relations"));
    const outgoing = screen.getByTestId("inspector-outgoing");
    expect(within(outgoing).getAllByTestId("inspector-relation")[0]).toHaveTextContent(
      "user_id→users.idN:1ON DELETE restrictorders_user_fk",
    );
    await user.click(within(outgoing).getByRole("button", { name: "Show table users" }));
    expect(useUiStore.getState()).toMatchObject({
      selectedTableId: "public.users",
      inspectorTab: "relations",
      highlightedColumn: { columnId: "public.users.id" },
    });
    expect(screen.getByTestId("inspector-back")).toHaveTextContent("Back to orders");
    const incoming = within(screen.getByTestId("inspector-incoming")).getAllByTestId(
      "inspector-relation",
    );
    expect(incoming.map((r) => r.textContent?.split("N:1")[0])).toEqual([
      "addresses.user_id→id",
      "orders.user_id→id",
      "reviews.user_id→id",
    ]);

    await user.click(tab("keys"));
    await user.click(screen.getByTestId("inspector-back"));
    expect(useUiStore.getState()).toMatchObject({
      selectedTableId: "public.orders",
      inspectorTab: "relations",
      inspectorBack: null,
    });
    expect(screen.queryByTestId("inspector-back")).toBeNull();
  });

  it("marks self-references and 1:1 relations", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    select("public.categories");
    await user.click(tab("relations"));
    expect(within(screen.getByTestId("inspector-outgoing")).getByText("self")).toBeInTheDocument();
    select("public.payments");
    expect(within(screen.getByTestId("inspector-outgoing")).getByText("1:1")).toBeInTheDocument();
  });
});

describe("Inspector isolation", () => {
  it("switching tabs and toggling details don't re-render the canvas", async () => {
    const user = userEvent.setup();
    const commits = vi.fn();
    render(
      <TooltipProvider>
        <Inspector />
        <div style={{ width: 800, height: 600 }}>
          <Profiler id="canvas" onRender={commits}>
            <SchemaCanvas />
          </Profiler>
        </div>
      </TooltipProvider>,
    );
    select("public.orders");
    await new Promise((resolve) => setTimeout(resolve, 300));
    commits.mockClear();
    await user.click(tab("keys"));
    await user.click(tab("relations"));
    await user.click(tab("columns"));
    expect(commits).not.toHaveBeenCalled();
  });
});

describe("Inspector on phones", () => {
  it("opens as an overlay sheet whose × closes the panel", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    renderFullWorkspace();
    select("public.orders");
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
    act(() => useUiStore.getState().setPanelOpen("right", true));
    const sheet = screen.getByTestId("inspector-sheet");
    expect(within(sheet).getByTestId("inspector-title")).toHaveTextContent("orders");
    expect(screen.getAllByRole("complementary", { name: "Inspector" })).toHaveLength(1);
    await user.click(within(sheet).getByTestId("inspector-sheet-close"));
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");
    vi.restoreAllMocks();
  });
});

function wideSchema(columns: number): Schema {
  const schema = createEcommerceSchema();
  const users = schema.tables["public.users"]!;
  users.columns = Array.from({ length: columns }, (_, i) => ({
    ...users.columns[1]!,
    id: `public.users.c_${i}`,
    name: `c_${i}`,
    isUnique: false,
  }));
  users.primaryKey = undefined;
  users.uniqueConstraints = [];
  return schema;
}
