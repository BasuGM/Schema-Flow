import { expect, test, type Page } from "@playwright/test";
import { clickTable, openSample, tableNode } from "./support/app";

// P4-T02 (docs/development/plans/p4-t02.md): the Path tab of the inspector on the ecommerce sample.
// reviews → coupons is connected; audit_log has no relationships.

const input = (page: Page) => page.getByTestId("path-target-input");
const hops = (page: Page) => page.getByTestId("path-hop");
const litNodes = (page: Page) => page.locator('[data-testid^="table-node-"][data-on-path="true"]');
const litEdges = (page: Page) => page.locator('.relationship-edge[data-on-path="true"]');

async function findPath(page: Page, from: string, to: string) {
  await clickTable(page, from);
  await page.getByTestId("inspector-tab-path").click();
  await input(page).fill(to);
  await page.getByTestId("path-target-option").first().click();
}

test.describe("desktop", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("finds a path, lights it on the canvas, and Clear restores the neighbourhood dimming", async ({
    page,
  }) => {
    await findPath(page, "reviews", "coupons");
    const summary = page.getByTestId("path-summary");
    await expect(summary).toContainText(/^reviews → coupons: \d+ hops?$/);
    const n = await hops(page).count();
    expect(n).toBeGreaterThan(0);
    await expect(summary).toContainText(`${n} hop`);
    await expect(litNodes(page)).toHaveCount(n + 1);
    await expect(litEdges(page)).toHaveCount(n);
    await expect(tableNode(page, "audit_log")).toHaveAttribute("data-dimmed", "true");
    await expect(tableNode(page, "reviews")).not.toHaveAttribute("data-dimmed", "true");

    await page.getByTestId("path-clear").click();
    await expect(page.getByTestId("path-result")).toHaveCount(0);
    await expect(litNodes(page)).toHaveCount(0);
    await expect(input(page)).toBeFocused();
    // reviews is still selected: its neighbourhood dimming is back, audit_log is outside it.
    await expect(tableNode(page, "audit_log")).toHaveAttribute("data-dimmed", "true");
    await expect(tableNode(page, "reviews")).not.toHaveAttribute("data-dimmed", "true");
  });

  test("Show on canvas keeps the path; Escape in the field clears the query only", async ({
    page,
  }) => {
    await findPath(page, "reviews", "coupons");
    await page.getByTestId("path-show").click();
    await expect(page.getByTestId("path-result")).toBeVisible();
    await input(page).fill("zz");
    await page.keyboard.press("Escape");
    await expect(input(page)).toHaveValue("");
    await expect(page.getByTestId("path-result")).toBeVisible();
    await expect(tableNode(page, "reviews")).toHaveAttribute("data-selected", "true");
  });

  test("Escape from the canvas clears the path and the selection", async ({ page }) => {
    await findPath(page, "reviews", "coupons");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Escape");
    await expect(litNodes(page)).toHaveCount(0);
    await expect(tableNode(page, "reviews")).not.toHaveAttribute("data-selected", "true");
  });

  test("selecting a table in the path keeps the highlight", async ({ page }) => {
    await findPath(page, "reviews", "coupons");
    const before = await litNodes(page).count();
    await hops(page).first().getByRole("button").last().click();
    await expect(page.getByTestId("path-result")).toContainText("Path from reviews");
    await expect(litNodes(page)).toHaveCount(before);
  });

  test("an unconnected pair says so and lights nothing", async ({ page }) => {
    await findPath(page, "reviews", "audit_log");
    await expect(page.getByTestId("path-none")).toContainText(
      "No path between reviews and audit_log",
    );
    await expect(litNodes(page)).toHaveCount(0);
  });

  test("keyboard only: type, arrow, Enter, with a visible focus ring on the field", async ({
    page,
  }) => {
    await clickTable(page, "reviews");
    await page.getByTestId("inspector-tab-path").click();
    await input(page).focus();
    await page.keyboard.type("co");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("path-result")).toBeVisible();
    await expect(input(page)).toBeFocused();
    const ring = await input(page).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe("none");
  });
});

test.describe("phone (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the Path tab fits the sheet; Show on canvas closes it; no horizontal overflow", async ({
    page,
  }) => {
    await openSample(page);
    await tableNode(page, "reviews").click({ position: { x: 20, y: 12 } });
    await page.getByTestId("toolbar-toggle-right").click();
    const sheet = page.getByTestId("inspector-sheet");
    await expect(sheet).toBeVisible();
    for (const tab of ["columns", "keys", "relations", "path"]) {
      const box = await page.getByTestId(`inspector-tab-${tab}`).boundingBox();
      const sheetBox = await sheet.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(sheetBox!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(sheetBox!.x + sheetBox!.width);
    }
    await page.getByTestId("inspector-tab-path").click();
    await input(page).fill("coupons");
    await page.getByTestId("path-target-option").first().click();
    await expect(page.getByTestId("path-result")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByTestId("path-show").click();
    await expect(sheet).toHaveCount(0);
    await expect(litNodes(page).first()).toBeVisible();
  });

  test("Escape closes the sheet first; a second Escape clears path and selection", async ({
    page,
  }) => {
    await openSample(page);
    await tableNode(page, "reviews").click({ position: { x: 20, y: 12 } });
    await page.getByTestId("toolbar-toggle-right").click();
    await page.getByTestId("inspector-tab-path").click();
    await input(page).fill("coupons");
    await page.getByTestId("path-target-option").first().click();
    await page.locator("body").press("Escape");
    await expect(page.getByTestId("inspector-sheet")).toHaveCount(0);
    await expect(litNodes(page).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(litNodes(page)).toHaveCount(0);
  });
});
