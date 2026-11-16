// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { Inspector } from "./inspector";

describe("Inspector performance", () => {
  it("renders the first tab of a 1,000-column table in under 50 ms", () => {
    const schema = createEcommerceSchema();
    const users = schema.tables["public.users"]!;
    users.columns = Array.from({ length: 1000 }, (_, i) => ({
      ...users.columns[1]!,
      id: `public.users.c_${i}`,
      name: `c_${i}`,
      isUnique: false,
    }));
    users.primaryKey = undefined;
    users.uniqueConstraints = [];
    resetStores(schema);
    render(<Inspector />);
    // Warm up the renderer once with another table, then measure the wide one.
    act(() => useUiStore.getState().selectTable("public.orders"));
    let best = Infinity;
    for (let attempt = 0; attempt < 3 && best >= 50; attempt++) {
      act(() => useUiStore.getState().selectTable(null));
      const start = performance.now();
      act(() => useUiStore.getState().selectTable("public.users"));
      best = Math.min(best, performance.now() - start);
    }
    expect(within(screen.getByTestId("inspector-columns")).getAllByRole("listitem")).toHaveLength(
      100,
    );
    expect(best).toBeLessThan(50);
  });
});
