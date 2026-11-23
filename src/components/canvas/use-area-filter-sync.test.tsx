// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { useAreaFilterSync } from "./use-area-filter-sync";

const t = (name: string, schemaName: string) => ({
  name,
  schemaName,
  columns: [{ name: "id", type: "int", primaryKey: true }],
});
const schema = normalizeSchema(draft([t("a1", "x"), t("a2", "x"), t("b1", "y"), t("b2", "y")]));

beforeEach(() => {
  resetStores(schema);
  useUiStore.getState().showOnlyArea("x", ["x", "y"]);
});

describe("useAreaFilterSync", () => {
  it("turns an area back on when one of its tables is focused, fitted or put on a path", () => {
    renderHook(() => useAreaFilterSync());
    expect([...useUiStore.getState().hiddenAreas]).toEqual(["y"]);
    act(() => useUiStore.getState().focusTable("y.b1"));
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);

    act(() => useUiStore.getState().setAreaVisible("y", false));
    act(() => useUiStore.getState().fitTables(["x.a1", "y.b2"]));
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);

    act(() => useUiStore.getState().setAreaVisible("y", false));
    act(() =>
      useUiStore.getState().setActivePath({
        from: "x.a1",
        to: "y.b1",
        path: { tables: ["x.a1", "y.b1"], hops: [] },
        tables: new Set(["x.a1", "y.b1"]),
        relationships: new Set(),
      }),
    );
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);
  });

  it("does not unhide when the selected table's area is hidden", () => {
    renderHook(() => useAreaFilterSync());
    act(() => useUiStore.getState().selectTable("y.b1"));
    expect([...useUiStore.getState().hiddenAreas]).toEqual(["y"]);
    expect(useUiStore.getState().selectedTableId).toBe("y.b1");
  });
});
