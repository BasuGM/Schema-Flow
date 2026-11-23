import { expect, test } from "@playwright/test";
import { importFixture, openSample } from "./support/app";

// AC-P2-T10-7 (ADR-023): a large schema zoomed below 0.3 draws rows as one striped block and
// edges without markers or hover targets; zooming in brings the detail back.
test.describe("zoomed-out rendering of large schemas", () => {
  test.describe.configure({ timeout: 120_000 });

  test("fitted view of a 180-table schema is an overview; zooming in restores detail", async ({
    page,
  }) => {
    await openSample(page);
    await importFixture(page, "real/mysqldump-180.mysql.sql");
    const canvas = page.getByTestId("schema-canvas");
    await expect(canvas).toHaveAttribute("data-zoomed-out", "true");
    await expect(page.getByTestId("skeleton-rows").first()).toBeAttached();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="edge-hit-"]')).toHaveCount(0);
    await expect(page.locator("g.relationship-edge text")).toHaveCount(0);

    const target = page.locator(".react-flow__node").first();
    await target.hover();
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -400);
      if ((await canvas.getAttribute("data-zoomed-out")) === null) break;
    }
    await expect(canvas).not.toHaveAttribute("data-zoomed-out", /.*/);
    await expect(page.getByTestId("skeleton-rows")).toHaveCount(0);
    await expect(page.locator('[data-testid^="column-"]').first()).toBeAttached();
  });

  test("the 12-table sample is never an overview", async ({ page }) => {
    await openSample(page);
    await expect(page.getByTestId("schema-canvas")).not.toHaveAttribute("data-zoomed-out", /.*/);
    await expect(page.getByTestId("skeleton-rows")).toHaveCount(0);
  });
});
