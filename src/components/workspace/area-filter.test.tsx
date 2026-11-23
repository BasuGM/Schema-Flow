// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { TableList } from "./table-list";

const t = (name: string, schemaName: string) => ({
  name,
  schemaName,
  columns: [{ name: "id", type: "int", primaryKey: true }],
});
const schema = normalizeSchema(
  draft([t("a1", "core"), t("a2", "core"), t("b1", "billing"), t("b2", "billing")]),
);

beforeEach(() => resetStores(schema));

describe("TableList subject areas (P4-T03)", () => {
  it("groups the list under area headers with counts", () => {
    render(<TableList />);
    expect(screen.getByTestId("area-group-core")).toHaveTextContent("core");
    expect(within(screen.getByTestId("area-group-billing")).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByTestId("area-filter")).toHaveTextContent("Areas · 2 of 2 shown");
  });

  it("applies the text filter inside groups and drops empty groups", async () => {
    render(<TableList />);
    await userEvent.type(screen.getByTestId("table-filter"), "b1");
    expect(screen.queryByTestId("area-group-core")).toBeNull();
    expect(screen.getByTestId("area-group-billing")).toBeInTheDocument();
  });

  it("toggles, shows only, and shows all, with count in the checkbox label", async () => {
    render(<TableList />);
    await userEvent.click(screen.getByTestId("area-filter"));
    expect(screen.getByLabelText("billing (2)")).toBeChecked();
    expect(screen.getByTestId("area-show-all-list")).toBeDisabled();

    await userEvent.click(screen.getByTestId("area-toggle-billing"));
    expect([...useUiStore.getState().hiddenAreas]).toEqual(["billing"]);
    expect(screen.getByTestId("area-filter")).toHaveTextContent("1 of 2 shown");
    expect(
      within(screen.getByTestId("area-group-billing")).getAllByLabelText("hidden on canvas"),
    ).toHaveLength(2);
    expect(screen.getByTestId("area-only-core")).toBeDisabled();

    await userEvent.click(screen.getByTestId("area-only-billing"));
    expect([...useUiStore.getState().hiddenAreas]).toEqual(["core"]);

    await userEvent.click(screen.getByTestId("area-show-all-list"));
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);
  });

  it("is reachable by keyboard", async () => {
    render(<TableList />);
    await userEvent.type(screen.getByTestId("table-filter"), "{Tab}");
    expect(screen.getByTestId("area-filter")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("area-toggle-core")).toBeInTheDocument();
  });

  it("stays flat when the schema has no areas", () => {
    resetStores();
    render(<TableList />);
    expect(screen.queryByTestId("area-filter")).toBeNull();
    expect(document.querySelector('[data-testid^="area-group-"]')).toBeNull();
  });
});
