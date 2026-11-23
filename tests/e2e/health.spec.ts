import { expect, test, type Page } from "@playwright/test";
import { expectSelectedHeaderAboveSheet, importFixture, tableNode } from "./support/app";

// P4-T01 (docs/development/plans/p4-t01.md): the Health tab, from the toolbar button and from the
// Settings item, plus one phone case. tests/fixtures/sql/health.postgres.sql triggers all four checks.

const FIXTURE = "sql/health.postgres.sql";
const healthRows = (page: Page) => page.getByTestId("health-list").getByTestId("issue-row");

test.describe("desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await importFixture(page, FIXTURE);
  });

  test("the toolbar button opens Health when there are no import issues", async ({ page }) => {
    await page.getByTestId("toolbar-issues").click();
    await expect(page.getByTestId("health-panel")).toBeVisible();
    await expect(page.getByTestId("bottom-tab-health")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("bottom-tab-health")).toContainText("Health 7");
    await expect(healthRows(page)).toHaveCount(7);
    for (const [id, n] of [
      ["missing-pk", 1],
      ["unindexed-fk", 3],
      ["orphan-table", 2],
      ["naming", 1],
    ] as const) {
      await expect(page.getByTestId(`health-filter-${id}`)).toContainText(String(n));
    }
  });

  test("Settings → Schema health opens Health; Show table selects the table", async ({ page }) => {
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-health").click();
    await expect(page.getByTestId("health-panel")).toBeVisible();
    await page.getByTestId("health-filter-missing-pk").click();
    await expect(healthRows(page)).toHaveCount(1);
    await healthRows(page).first().getByTestId("issue-show-table").click();
    await expect(tableNode(page, "order_items")).toHaveAttribute("data-selected", "true");
  });

  test("tabs switch with the arrow keys", async ({ page }) => {
    await page.getByTestId("toolbar-issues").click();
    await page.getByTestId("bottom-tab-health").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("bottom-tab-issues")).toBeFocused();
    await expect(page.getByTestId("issues-panel")).toBeVisible();
  });
});

test.describe("phone (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Health opens in the sheet with both tabs visible and no overflow", async ({ page }) => {
    await page.goto("/");
    await importFixture(page, FIXTURE);
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId("more-health").click();
    const sheet = page.getByTestId("issues-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("bottom-tab-issues")).toBeVisible();
    await expect(page.getByTestId("bottom-tab-health")).toBeVisible();
    await expect(healthRows(page).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("QA-039: Show table puts the table header above the open sheet", async ({ page }) => {
    await page.goto("/");
    await importFixture(page, FIXTURE);
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId("more-health").click();
    await healthRows(page).first().getByTestId("issue-show-table").click();
    await expectSelectedHeaderAboveSheet(page);
  });
});
