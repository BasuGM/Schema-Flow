// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { SchemaCanvas } from "./schema-canvas";

const t = (name: string, schemaName: string, ref?: [string, string]) => ({
  name,
  schemaName,
  columns: [
    { name: "id", type: "int", primaryKey: true },
    ...(ref
      ? [{ name: "r_id", type: "int", references: { schemaName: ref[0], table: ref[1] } }]
      : []),
  ],
});
const schema = normalizeSchema(
  draft([t("a1", "x"), t("a2", "x", ["x", "a1"]), t("b1", "y", ["x", "a1"]), t("b2", "y")]),
);

function Harness() {
  return (
    <TooltipProvider>
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
    </TooltipProvider>
  );
}
const nodeIds = () =>
  [...document.querySelectorAll('[data-testid^="table-node-"]')].map((e) =>
    e.getAttribute("data-testid")!.replace("table-node-", ""),
  );

beforeEach(() => resetStores(schema));

describe("Subject-area filter on the canvas (P4-T03)", () => {
  it("hides the tables of a hidden area, shows a notice, and Show all restores them", () => {
    render(<Harness />);
    expect(nodeIds()).toHaveLength(4);
    act(() => useUiStore.getState().setAreaVisible("y", false));
    expect(nodeIds().sort()).toEqual(["x.a1", "x.a2"]);
    expect(screen.getByTestId("area-filter-notice").textContent).toContain("2 tables hidden");
    fireEvent.click(screen.getByTestId("area-show-all"));
    expect(nodeIds()).toHaveLength(4);
    expect(screen.queryByTestId("area-filter-notice")).toBeNull();
  });

  it("keeps the selection when its area is hidden, and revealing the table unhides the area", () => {
    render(<Harness />);
    act(() => useUiStore.getState().selectTable("y.b1"));
    act(() => useUiStore.getState().setAreaVisible("y", false));
    expect(useUiStore.getState().selectedTableId).toBe("y.b1");
    expect(useUiStore.getState().hiddenAreas.has("y")).toBe(true);
    act(() => useUiStore.getState().focusTable("y.b1"));
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);
    expect(nodeIds()).toHaveLength(4);
  });
});
