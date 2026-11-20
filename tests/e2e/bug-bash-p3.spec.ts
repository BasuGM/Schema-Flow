import { expect, test, type Page } from "@playwright/test";
import { clickTable, importFixture, openSample } from "./support/app";

// BB-P3 (docs/development/plans/bb-p3.md): the automated rows. Row 4 (keyboard-only Phase 3 dialogs),
// row 5 (console and viewports) and the saas-300 everyday smoke. AC-BB-P3-6…9.

const SAAS = "synthetic/saas-300.postgres.sql";

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      problems.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
  return problems;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  const desktop = page.getByTestId("toolbar-theme");
  if (await desktop.isVisible()) {
    await desktop.click();
    await page.getByTestId(`theme-${theme}`).click();
    await expect(page.getByTestId(`theme-${theme}`)).toHaveCount(0);
  } else {
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId(`more-theme-${theme}`).click();
    await expect(page.getByTestId(`more-theme-${theme}`)).toHaveCount(0);
  }
}

/** Opens Export… from the toolbar, or from More on phones. */
async function openExport(page: Page): Promise<void> {
  const toolbar = page.getByTestId("toolbar-export");
  if (await toolbar.isVisible()) await toolbar.click();
  else {
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId("more-export").click();
  }
  await expect(page.getByTestId("export-dialog")).toBeVisible();
}

test("AC-BB-P3-6 (QA-036): exactly one element carries data-testid=inspector", async ({ page }) => {
  await openSample(page);
  await clickTable(page, "orders");
  // getByTestId throws a strict-mode error when it matches two elements.
  await expect(page.getByTestId("inspector")).toBeVisible();
  await expect(page.getByTestId("inspector")).toHaveCount(1);
});

test("AC-BB-P3-7: a 300-table schema works end to end (import, search, inspect, export, reload)", async ({
  page,
}) => {
  const problems = watchConsole(page);
  await page.goto("/");
  await expect(page.getByTestId("table-node-orders")).toBeVisible();
  await importFixture(page, SAAS);
  await expect(page.getByTestId("toolbar-schema-name")).toContainText("300");

  await page.getByTestId("toolbar-search").click();
  await page.getByTestId("search-input").fill("t050_entity");
  await page.getByTestId("search-option").first().click();
  await expect(page.getByTestId("inspector-title")).toContainText("t050_entity");

  await openExport(page);
  await page.getByTestId("export-tab-sql").click();
  await expect(page.getByTestId("export-preview")).toContainText("CREATE TABLE");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("export-dialog")).toBeHidden();

  // The session is saved a moment after the change; then a reload brings it back.
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(localStorage).includes("session-ui")))
    .toBe(true);
  await page.reload();
  await expect(page.getByTestId("toolbar-schema-name")).toContainText("300");
  await expect(page.getByTestId("inspector-title")).toContainText("t050_entity");
  expect(problems).toEqual([]);
});

test.describe("row 4: Phase 3 dialogs by keyboard", () => {
  test("AC-BB-P3-8: Export opens from the keyboard, tabs move with arrows, Escape returns focus", async ({
    page,
  }) => {
    await openSample(page);
    const trigger = page.getByTestId("toolbar-export");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("export-dialog")).toBeVisible();
    const tabs = ["sql", "prisma", "mermaid", "json", "image"];
    await page.getByTestId("export-tab-sql").focus();
    for (const tab of tabs.slice(1)) {
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId(`export-tab-${tab}`)).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("export-dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("AC-BB-P3-8: Clear saved data opens from the keyboard and Cancel returns focus", async ({
    page,
  }) => {
    await openSample(page);
    await page.getByTestId("toolbar-settings").focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("settings-clear-data").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("clear-data-dialog")).toBeVisible();
    await page.getByTestId("clear-data-cancel").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("clear-data-dialog")).toBeHidden();
    await expect(page.getByTestId("toolbar-settings")).toBeFocused();
  });
});

test.describe("row 5: viewports and themes with the Phase 3 dialogs", () => {
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"] as const) {
      test(`AC-BB-P3-9: Export and Clear dialogs have no horizontal overflow at ${width}px (${theme})`, async ({
        page,
      }) => {
        const problems = watchConsole(page);
        await page.setViewportSize({ width, height: width < 768 ? 844 : 800 });
        await openSample(page);
        await setTheme(page, theme);
        await importFixture(page, "sql/edge-cases.postgres.sql");
        await openExport(page);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("export-dialog")).toBeHidden();
        if (width < 768) {
          await page.getByTestId("toolbar-more").click();
          await page.getByTestId("more-clear-data").click();
        } else {
          await page.getByTestId("toolbar-settings").click();
          await page.getByTestId("settings-clear-data").click();
        }
        await expect(page.getByTestId("clear-data-dialog")).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await page.keyboard.press("Escape");
        expect(problems).toEqual([]);
      });
    }
  }
});
