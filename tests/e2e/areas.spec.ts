import { expect, test, type Page } from "@playwright/test";
import { importFixture, listItem, openSample, tableNode } from "./support/app";

// P4-T03 (docs/development/plans/p4-t03.md): subject areas on saas-300 (core / billing / analytics,
// 100 tables each). ecommerce has a single schema and no shared prefixes, so no areas.

const SAAS = "synthetic/saas-300.postgres.sql";
const nodes = (page: Page, area: string) => page.locator(`[data-testid^="table-node-${area}."]`);

async function openAreas(page: Page): Promise<void> {
  await page.getByTestId("area-filter").click();
  await expect(page.getByTestId("area-row-billing")).toBeVisible();
}

test.describe("desktop", () => {
  test("hiding an area removes its tables and edges; Show all restores them", async ({ page }) => {
    test.setTimeout(90_000);
    await openSample(page);
    await importFixture(page, SAAS);
    await expect(page.getByTestId("area-filter")).toContainText("3 of 3 shown");
    await expect(page.getByTestId("area-group-core")).toBeVisible();
    const edgesBefore = await page.locator(".react-flow__edge").count();

    await openAreas(page);
    await page.getByTestId("area-toggle-billing").uncheck();
    await expect(page.getByTestId("area-filter")).toContainText("2 of 3 shown");
    await expect(page.getByTestId("area-filter-notice")).toContainText("100 tables hidden");
    await expect(nodes(page, "billing")).toHaveCount(0);
    expect(await page.locator(".react-flow__edge").count()).toBeLessThan(edgesBefore);

    await page.getByTestId("area-show-all").click();
    await expect(page.getByTestId("area-filter-notice")).toHaveCount(0);
    await expect(page.getByTestId("area-filter")).toContainText("3 of 3 shown");
  });

  test("Only keeps one area; revealing a hidden table turns its area back on", async ({ page }) => {
    test.setTimeout(90_000);
    await openSample(page);
    await importFixture(page, SAAS);
    await openAreas(page);
    await page.getByTestId("area-only-analytics").click();
    await expect(page.getByTestId("area-filter-notice")).toContainText("200 tables hidden");
    await expect(nodes(page, "core")).toHaveCount(0);

    await page.getByTestId("table-filter").fill("core.t001_wide");
    await listItem(page, "core.t001_wide").click();
    await expect(page.getByTestId("area-filter")).toContainText("2 of 3 shown");
    await expect(tableNode(page, "core.t001_wide")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("area-filter-notice")).toContainText("100 tables hidden");
  });

  test("a table with no areas shows no Areas control", async ({ page }) => {
    await openSample(page);
    await expect(page.getByTestId("area-filter")).toHaveCount(0);
  });
});

test.describe("phone (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the list sheet shows Areas without overflow and the notice sits clear of Reset view", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openSample(page);
    await importFixture(page, SAAS);
    await page.getByTestId("toolbar-toggle-left").click();
    await openAreas(page);
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByTestId("area-toggle-billing").uncheck();
    await page.getByTestId("table-list-sheet-close").click();
    const notice = page.getByTestId("area-filter-notice");
    await expect(notice).toBeVisible();
    const a = (await notice.boundingBox())!;
    const b = (await page.getByTestId("canvas-reset-view").boundingBox())!;
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y).toBe(true);
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
