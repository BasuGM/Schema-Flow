// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { Toolbar } from "./toolbar";

function renderToolbar() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toolbar />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => resetStores());

describe("Toolbar on phones (More menu)", () => {
  it("shows Layout, Theme and Settings from sm up, and the More menu only below sm", () => {
    renderToolbar();
    expect(screen.getByTestId("toolbar-more")).toHaveClass("sm:hidden");
    const desktopOnly = screen.getByTestId("toolbar-layout").parentElement!;
    expect(desktopOnly).toHaveClass("hidden", "sm:flex");
    expect(desktopOnly).toContainElement(screen.getByTestId("toolbar-theme"));
    expect(desktopOnly).toContainElement(screen.getByTestId("toolbar-settings"));
  });

  it("re-runs the layout, switches the theme and toggles the minimap", async () => {
    const user = userEvent.setup();
    renderToolbar();
    const version = useLayoutStore.getState().version;

    await user.click(screen.getByTestId("toolbar-more"));
    await user.click(await screen.findByTestId("more-layout"));
    expect(useLayoutStore.getState().version).toBeGreaterThan(version);

    await user.click(screen.getByTestId("toolbar-more"));
    await user.click(await screen.findByRole("menuitemradio", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));

    await user.click(screen.getByTestId("toolbar-more"));
    await user.click(await screen.findByTestId("more-minimap"));
    expect(useUiStore.getState().showMiniMap).toBe(true);
  });

  it.each([
    ["toolbar-more", "more"],
    ["toolbar-settings", "settings"],
  ])("%s: All tables sets every table's collapse mode", async (trigger, prefix) => {
    const user = userEvent.setup();
    renderToolbar();
    const { schema, fingerprint } = useSchemaStore.getState();
    const collapsed = () => useLayoutStore.getState().layouts[fingerprint!]!.collapsed;

    await user.click(screen.getByTestId(trigger));
    await user.click(await screen.findByTestId(`${prefix}-collapse-all-header`));
    expect(Object.keys(collapsed())).toHaveLength(schema!.tableOrder.length);
    expect(new Set(Object.values(collapsed()))).toEqual(new Set(["header"]));

    await user.click(screen.getByTestId(trigger));
    await user.click(await screen.findByTestId(`${prefix}-collapse-all-full`));
    expect(collapsed()).toEqual({});
  });
});
