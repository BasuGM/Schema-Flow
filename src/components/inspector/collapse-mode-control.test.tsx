// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { resetStores } from "@/test/store-helpers";
import { CollapseModeControl } from "./collapse-mode-control";

const table = "public.orders";
const modeOf = () => {
  const fp = useSchemaStore.getState().fingerprint!;
  return useLayoutStore.getState().layouts[fp]?.collapsed[table] ?? "full";
};

beforeEach(() => {
  resetStores();
  const { schema, fingerprint } = useSchemaStore.getState();
  useLayoutStore.getState().ensureLayout(schema!, fingerprint!);
});

describe("CollapseModeControl", () => {
  it("is a labelled fieldset with the current mode checked", () => {
    render(<CollapseModeControl tableId={table} />);
    expect(screen.getByRole("group", { name: "Show on canvas" })).toBeInTheDocument();
    expect(screen.getByTestId("inspector-collapse-full")).toBeChecked();
  });

  it("choosing Keys updates the layout store", async () => {
    render(<CollapseModeControl tableId={table} />);
    await userEvent.click(screen.getByText("Keys"));
    expect(modeOf()).toBe("keys");
    expect(screen.getByTestId("inspector-collapse-keys")).toBeChecked();
  });

  it("arrow keys move between modes", async () => {
    render(<CollapseModeControl tableId={table} />);
    screen.getByTestId("inspector-collapse-full").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(modeOf()).toBe("keys");
    await userEvent.keyboard("{ArrowRight}");
    expect(modeOf()).toBe("header");
  });

  it("two mounted controls never share a radio group", () => {
    render(
      <>
        <CollapseModeControl tableId={table} />
        <CollapseModeControl tableId="public.users" />
      </>,
    );
    const names = new Set(screen.getAllByRole("radio").map((r) => r.getAttribute("name")));
    expect(names.size).toBe(2);
  });
});
