import { expect, test, type Page } from "@playwright/test";
import { clickTable, openSample, tableNode } from "./support/app";

// P3-T02: per-table collapse modes. AC-P3-T02-1…6.

const transformOf = (page: Page, tableId: string) =>
  page.evaluate(
    (id) =>
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)?.style.transform,
    "public." + tableId,
  );

const rowCount = (page: Page, name: string) => tableNode(page, name).locator("li").count();

async function openSettings(page: Page, item: string): Promise<void> {
  await page.getByTestId("toolbar-settings").click();
  await page.getByTestId(item).click();
  // Wait for the menu to finish closing, or the next open races its exit animation.
  await expect(page.getByTestId(item)).toHaveCount(0);
}

test.describe("collapse modes", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P3-T02-1/2: the inspector sets Keys and Header only; the count shows visible / total", async ({
    page,
  }) => {
    await clickTable(page, "orders");
    const total = await rowCount(page, "orders");
    await page.getByText("Keys", { exact: true }).click();
    await expect(tableNode(page, "orders").locator("li")).not.toHaveCount(total);
    await expect(
      tableNode(page, "orders").locator("li[data-testid^='column-']:not([data-pk]):not([data-fk])"),
    ).toHaveCount(0);
    await expect(tableNode(page, "orders").getByTestId("node-column-count")).toContainText(
      ` / ${total}`,
    );
    await page.getByText("Header only", { exact: true }).click();
    await expect(tableNode(page, "orders").locator("li")).toHaveCount(0);
    await expect(tableNode(page, "orders").getByTestId("node-column-count")).toContainText(
      `0 / ${total}`,
    );
    await page.getByText("All columns", { exact: true }).click();
    await expect(tableNode(page, "orders").locator("li")).toHaveCount(total);
  });

  test("AC-P3-T02-3: the node toggle cycles modes with the real mouse; no selection, no move", async ({
    page,
  }) => {
    const before = await transformOf(page, "orders");
    const toggle = tableNode(page, "orders").getByTestId("node-collapse-toggle");
    const total = await rowCount(page, "orders");
    await toggle.click();
    await expect(tableNode(page, "orders").locator("li")).not.toHaveCount(total);
    await toggle.click();
    await expect(tableNode(page, "orders").locator("li")).toHaveCount(0);
    await toggle.click();
    await expect(tableNode(page, "orders").locator("li")).toHaveCount(total);
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "false");
    expect(await transformOf(page, "orders")).toBe(before);
  });

  test("AC-P3-T02-6: Keys mode + search for a non-key column reveals and highlights it", async ({
    page,
  }) => {
    await openSettings(page, "settings-collapse-all-keys");
    await expect(tableNode(page, "orders").getByTestId("column-status")).toHaveCount(0);
    await page.getByTestId("toolbar-search").click();
    await page.getByTestId("search-input").fill("ord.status");
    await expect(page.getByTestId("search-results")).toHaveAttribute("data-query", "ord.status");
    await page.getByTestId("search-option").first().click();
    const row = tableNode(page, "orders").getByTestId("column-status");
    await expect(row).toHaveAttribute("data-highlighted", "true");
    await expect(row).toHaveAttribute("data-revealed", "true");
  });

  test("AC-P3-T02-4/5: Headers-only, then all columns, then Layout leaves no overlapping nodes", async ({
    page,
  }) => {
    await openSettings(page, "settings-collapse-all-header");
    await expect(page.locator(".react-flow__node li")).toHaveCount(0);
    await openSettings(page, "settings-collapse-all-full");
    await expect(page.locator(".react-flow__node li").first()).toBeVisible();
    await page.getByTestId("toolbar-layout").click();
    await expect
      .poll(async () => {
        const boxes = await page
          .locator(".react-flow__node")
          .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
        let overlaps = 0;
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!;
            const b = boxes[j]!;
            if (
              a.left < b.right - 1 &&
              b.left < a.right - 1 &&
              a.top < b.bottom - 1 &&
              b.top < a.bottom - 1
            )
              overlaps++;
          }
        return overlaps;
      })
      .toBe(0);
  });

  test("AC-P3-T02-5: modes survive a reload", async ({ page }) => {
    await clickTable(page, "orders");
    await page.getByText("Header only", { exact: true }).click();
    await expect(tableNode(page, "orders").locator("li")).toHaveCount(0);
    await page.reload();
    await expect(tableNode(page, "orders")).toBeVisible();
    await expect(tableNode(page, "orders").locator("li")).toHaveCount(0);
    await expect(tableNode(page, "users").locator("li").first()).toBeVisible();
  });
});
