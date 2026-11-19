// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setSessionBackend } from "@/lib/session-db";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { generateSyntheticSchema } from "@/samples/synthetic";
import { useSchemaStore } from "@/stores/schema-store";
import { SESSION_RECORD_KEY, SESSION_UI_KEY } from "@/stores/session-persistence";
import { PREFS_KEY, useUiStore } from "@/stores/ui-store";
import { FakeSessionBackend } from "@/test/fake-session-backend";
import { resetStores } from "@/test/store-helpers";
import { Toolbar } from "./toolbar";

let backend: FakeSessionBackend;

function renderToolbar() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toolbar />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  backend = new FakeSessionBackend();
  setSessionBackend(backend);
  resetStores(generateSyntheticSchema({ tables: 5, seed: 3 }));
});

describe("Clear saved data", () => {
  it("wipes the stored data, loads the sample and announces it", async () => {
    const user = userEvent.setup();
    backend.data.set(SESSION_RECORD_KEY, { v: 1 });
    localStorage.setItem(PREFS_KEY, "{}");
    localStorage.setItem(SESSION_UI_KEY, "{}");
    useSchemaStore.getState().loadSchema(generateSyntheticSchema({ tables: 5, seed: 3 }), "x");
    useUiStore.setState({ neighbourhoodDepth: 2 });
    renderToolbar();

    await user.click(screen.getByTestId("toolbar-settings"));
    await user.click(await screen.findByTestId("settings-clear-data"));
    expect(await screen.findByTestId("clear-data-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("clear-data-confirm"));

    await waitFor(() => expect(screen.queryByTestId("clear-data-dialog")).not.toBeInTheDocument());
    expect(useSchemaStore.getState().schema?.name).toBe(createEcommerceSchema().name);
    expect(useSchemaStore.getState().sourceText).toBeNull();
    expect(useUiStore.getState().neighbourhoodDepth).toBe(1);
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_UI_KEY)).toBeNull();
    await waitFor(() => expect(backend.data.size).toBe(0));
    expect(screen.getByTestId("clear-data-status")).toHaveTextContent("Saved data cleared");
  });

  it("Escape cancels, keeps everything and returns focus to the menu button", async () => {
    const user = userEvent.setup();
    backend.data.set(SESSION_RECORD_KEY, { v: 1 });
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-settings"));
    await user.click(await screen.findByTestId("settings-clear-data"));
    await screen.findByTestId("clear-data-dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("clear-data-dialog")).not.toBeInTheDocument());
    expect(backend.data.size).toBe(1);
    expect(screen.getByTestId("toolbar-settings")).toHaveFocus();
  });
});
