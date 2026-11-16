// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { applyImportedSchema } from "@/components/import/apply-import";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsMenu } from "@/components/workspace/settings-menu";
import { useEscapeToClear } from "@/components/workspace/use-escape-to-clear";
import { parseSchemaText } from "@/parsers";
import { inspectorGoBack, navigateToRelated, revealTable } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { SchemaCanvas } from "./schema-canvas";

function Harness() {
  useEscapeToClear();
  return (
    <TooltipProvider>
      <SettingsMenu />
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
    </TooltipProvider>
  );
}

const ALL = [
  "users",
  "addresses",
  "categories",
  "products",
  "product_categories",
  "coupons",
  "orders",
  "order_items",
  "payments",
  "shipments",
  "reviews",
  "audit_log",
];
const dimmedTables = () =>
  ALL.filter((name) => screen.getByTestId(`table-node-${name}`).dataset.dimmed === "true");
const select = (name: string) => act(() => useUiStore.getState().selectTable(`public.${name}`));

/** Every edge is dimmed exactly when one of its ends is dimmed. */
function expectEdgesFollowTables() {
  const schema = useSchemaStore.getState().schema!;
  const dimmed = new Set(dimmedTables().map((n) => `public.${n}`));
  for (const r of Object.values(schema.relationships)) {
    const edge = screen.getByTestId(`edge-${r.id}`);
    const expected = dimmed.has(r.from.tableId) || dimmed.has(r.to.tableId);
    expect(edge.dataset.dimmed === "true", r.id).toBe(expected);
  }
}

beforeEach(() => resetStores());

describe("Neighbourhood highlighting", () => {
  it("dims nothing until a table is selected", () => {
    render(<Harness />);
    expect(dimmedTables()).toEqual([]);
    expect(document.querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
  });

  it("at 1 hop (default) dims everything outside orders' direct neighbours", () => {
    render(<Harness />);
    select("orders");
    expect(dimmedTables()).toEqual([
      "categories",
      "products",
      "product_categories",
      "reviews",
      "audit_log",
    ]);
    expectEdgesFollowTables();
    expect(screen.getByTestId("table-node-orders")).not.toHaveAttribute("data-dimmed");
  });

  it("2 hops widens the set; Off clears it; the setting survives selection and import", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    select("orders");
    await user.click(screen.getByTestId("toolbar-settings"));
    await user.click(screen.getByTestId("settings-neighbourhood-2"));
    expect(dimmedTables()).toEqual(["categories", "product_categories", "audit_log"]);
    expectEdgesFollowTables();

    select("categories");
    expect(useUiStore.getState().neighbourhoodDepth).toBe(2);
    expect(dimmedTables()).toEqual(
      ALL.filter((n) => !["categories", "products", "product_categories"].includes(n)),
    );

    await user.click(screen.getByTestId("toolbar-settings"));
    await user.click(screen.getByTestId("settings-neighbourhood-0"));
    expect(dimmedTables()).toEqual([]);

    const sql = readFileSync(join(process.cwd(), "tests/fixtures/sql/shop.mysql.sql"), "utf8");
    act(() => applyImportedSchema(parseSchemaText(sql).result.schema!, sql));
    expect(useUiStore.getState()).toMatchObject({ neighbourhoodDepth: 0, focusSet: null });
  });

  it("a new import and Escape clear the dimming", () => {
    render(<Harness />);
    select("orders");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(useUiStore.getState().focusSet).toBeNull();
    expect(dimmedTables()).toEqual([]);

    select("orders");
    const sql = readFileSync(join(process.cwd(), "tests/fixtures/sql/shop.mysql.sql"), "utf8");
    act(() => applyImportedSchema(parseSchemaText(sql).result.schema!, sql));
    expect(useUiStore.getState()).toMatchObject({ focusSet: null, neighbourhoodDepth: 1 });
    expect(document.querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
  });

  it("a table without relations dims every other table", () => {
    render(<Harness />);
    select("audit_log");
    expect(dimmedTables()).toEqual(ALL.filter((n) => n !== "audit_log"));
    expectEdgesFollowTables();
  });

  it("clicking a dimmed table selects it and recomputes the set, keeping the same nodes", () => {
    const { container } = render(<Harness />);
    select("audit_log");
    const before = container.querySelector('[data-id="public.payments"]');
    fireEvent.click(before!);
    expect(useUiStore.getState().selectedTableId).toBe("public.payments");
    expect(dimmedTables()).toEqual(ALL.filter((n) => !["orders", "payments"].includes(n)));
    // Not rebuilt or remounted: the same React Flow node element.
    expect(container.querySelector('[data-id="public.payments"]')).toBe(before);
  });

  it("search and Relations targets are never dimmed; Back recomputes the set", () => {
    render(<Harness />);
    select("audit_log");
    act(() => revealTable("public.reviews", "public.reviews.rating"));
    expect(dimmedTables()).not.toContain("reviews");
    expect(dimmedTables()).toEqual(
      ALL.filter((n) => !["users", "products", "reviews"].includes(n)),
    );

    select("orders");
    act(() => navigateToRelated("public.users", "public.users.id"));
    expect(dimmedTables()).toEqual(
      ALL.filter((n) => !["users", "addresses", "orders", "reviews"].includes(n)),
    );
    act(() => inspectorGoBack());
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");
    expect(dimmedTables()).toEqual([
      "categories",
      "products",
      "product_categories",
      "reviews",
      "audit_log",
    ]);
  });

  it("a hovered dimmed edge is drawn at full opacity while its label shows", () => {
    render(<Harness />);
    select("orders");
    const id = "fk:public.reviews(user_id)->public.users";
    expect(screen.getByTestId(`edge-${id}`)).toHaveAttribute("data-dimmed", "true");
    fireEvent.mouseEnter(screen.getByTestId(`edge-hit-${id}`));
    expect(screen.getByTestId(`edge-${id}`)).not.toHaveAttribute("data-dimmed");
    fireEvent.mouseLeave(screen.getByTestId(`edge-hit-${id}`));
    expect(screen.getByTestId(`edge-${id}`)).toHaveAttribute("data-dimmed", "true");
  });
});
