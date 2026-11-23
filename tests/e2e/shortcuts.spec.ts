import { expect, test, type Page } from "@playwright/test";
import { openSample } from "./support/app";

// P4-T04 (docs/development/plans/p4-t04.md): single-key shortcuts, commands in the ⌘K dialog and the
// shortcuts help. ecommerce sample: no subject areas, nothing selected.

const commandIds = (page: Page) =>
  page
    .getByTestId("command-option")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));

async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("search-dialog")).toBeVisible();
}

test.describe("desktop", () => {
  test("AC-P4-T04-1: ⌘K lists commands; typing ranks them; > shows commands only", async ({
    page,
  }) => {
    await openSample(page);
    await openPalette(page);
    expect((await commandIds(page))[0]).toBe("reset-view");
    expect(await commandIds(page)).toContain("path-finder");
    await expect(
      page.getByText("Find path between tables").locator("xpath=ancestor::*[@role='option']"),
    ).toHaveAttribute("aria-disabled", "true");
    await page.getByTestId("search-input").fill("lay");
    await expect(page.getByTestId("command-option").first()).toHaveAttribute("data-id", "layout");
    await page.getByTestId("search-input").fill(">exp");
    await expect.poll(() => commandIds(page)).toEqual(["export", "export-image"]);
    await expect(page.getByTestId("search-option")).toHaveCount(0);
  });

  test("AC-P4-T04-2/6: a command runs and focus returns; a dialog command returns focus after close", async ({
    page,
  }) => {
    await openSample(page);
    const toggle = page.getByTestId("toolbar-toggle-right");
    await toggle.focus();
    await openPalette(page);
    await page.getByTestId("search-input").fill(">minimap");
    await expect(page.getByTestId("command-option").first()).toHaveAttribute(
      "data-id",
      "toggle-minimap",
    );
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("search-dialog")).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.focus();
    await openPalette(page);
    await page.getByTestId("search-input").fill(">export");
    await expect(page.getByTestId("command-option").first()).toHaveAttribute("data-id", "export");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("export-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("export-dialog")).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("AC-P4-T04-3: single keys work on the canvas and not while typing or over a dialog", async ({
    page,
  }) => {
    await openSample(page);
    await page.getByTestId("toolbar-toggle-left").focus();
    await page.keyboard.press("[");
    await expect(page.getByTestId("toolbar-toggle-left")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("]");
    await expect(page.getByTestId("toolbar-toggle-right")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("h");
    await expect(page.getByTestId("health-panel")).toBeVisible();
    await page.keyboard.press("e");
    await expect(page.getByTestId("export-dialog")).toBeVisible();
    await page.keyboard.press("i");
    await expect(page.getByTestId("import-dialog")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("export-dialog")).toBeHidden();
    await page.keyboard.press("i");
    await expect(page.getByTestId("import-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    // Typing in the filter must not trigger anything.
    await page.getByTestId("toolbar-toggle-left").click();
    await page.getByTestId("table-filter").fill("");
    await page.getByTestId("table-filter").press("e");
    await expect(page.getByTestId("export-dialog")).toBeHidden();
    await page.keyboard.press("Control+e");
    await expect(page.getByTestId("export-dialog")).toBeHidden();
  });

  test("AC-P4-T04-4: ? opens the shortcuts dialog (Shift+/), search stays closed; Escape returns focus", async ({
    page,
  }) => {
    await openSample(page);
    const toggle = page.getByTestId("toolbar-toggle-right");
    await toggle.focus();
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
    await expect(page.getByTestId("search-dialog")).toBeHidden();
    await expect(page.getByTestId("shortcut-row")).toHaveCount(10);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcuts-dialog")).toBeHidden();
    await expect(toggle).toBeFocused();
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-shortcuts").click();
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("toolbar-settings")).toBeFocused();
  });

  test("AC-P4-T04-5: search keeps working (⌘K, /, Escape)", async ({ page }) => {
    await openSample(page);
    await page.keyboard.press("/");
    await expect(page.getByTestId("search-dialog")).toBeVisible();
    await page.getByTestId("search-input").fill("orders");
    await expect(page.getByTestId("search-option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-dialog")).toBeHidden();
  });
});

test.describe("phone (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("AC-P4-T04-3/8: E closes an open sheet first; the help dialog fits without horizontal scroll", async ({
    page,
  }) => {
    await openSample(page);
    await page.getByTestId("toolbar-toggle-left").click();
    await expect(page.getByTestId("table-list-sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByTestId("toolbar-toggle-left").click();
    await page.getByTestId("toolbar-toggle-left").focus();
    await page.keyboard.press("e");
    await expect(page.getByTestId("export-dialog")).toBeVisible();
    await expect(page.getByTestId("table-list-sheet")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("export-dialog")).toBeHidden();
    await page.keyboard.press("?");
    const dialog = page.getByTestId("shortcuts-dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
