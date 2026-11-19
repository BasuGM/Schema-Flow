import { expect, test, type Page } from "@playwright/test";
import { importFixture, openSample, tableNode } from "./support/app";

const dialog = (page: Page) => page.getByTestId("search-dialog");
const input = (page: Page) => page.getByTestId("search-input");
const options = (page: Page) => page.getByTestId("search-option");

async function openSearch(page: Page): Promise<void> {
  await page.getByTestId("toolbar-search").click();
  await expect(dialog(page)).toBeVisible();
}

async function search(page: Page, query: string): Promise<void> {
  await input(page).fill(query);
  await expect(page.getByTestId("search-results")).toHaveAttribute("data-query", query);
}

test.describe("search", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P2-T07-1: Ctrl/⌘+K and / open search; / in a text field types a slash", async ({
    page,
  }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();

    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();

    await page.getByTestId("table-filter").click();
    await page.keyboard.press("/");
    await expect(page.getByTestId("table-filter")).toHaveValue("/");
    await expect(dialog(page)).toBeHidden();
  });

  const SAMPLE_QUERIES: [string, string[]][] = [
    ["user", ["users", "addresses.user_id", "orders.user_id", "reviews.user_id"]],
    ["ord.user", ["orders.user_id"]],
    ["uid", ["addresses.user_id", "orders.user_id", "reviews.user_id"]],
  ];

  for (const [query, expected] of SAMPLE_QUERIES) {
    test(`AC-P2-T07-2: sample "${query}" → ${expected.length} result(s), in order`, async ({
      page,
    }) => {
      await openSearch(page);
      await search(page, query);
      await expect(options(page)).toContainText(expected);
      await expect(page.getByTestId("search-status")).toHaveText(
        `${expected.length} result${expected.length === 1 ? "" : "s"}`,
      );
    });
  }

  test("AC-P2-T07-3: no match and empty-query messages", async ({ page }) => {
    await openSearch(page);
    await expect(page.getByTestId("search-status")).toHaveText(
      "Type to search 12 tables and 71 columns",
    );
    await expect(options(page)).toHaveCount(12);
    await search(page, "zzzz");
    await expect(page.getByTestId("search-empty")).toHaveText("No tables or columns match “zzzz”.");
    await expect(options(page)).toHaveCount(0);
  });

  test("AC-P2-T07-4: arrows wrap, Enter chooses, Escape closes and keeps the selection", async ({
    page,
  }) => {
    await openSearch(page);
    await search(page, "user");
    await expect(input(page)).toHaveAttribute("role", "combobox");
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(options(page).last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(options(page).last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    const active = await options(page).first().getAttribute("id");
    await expect(input(page)).toHaveAttribute("aria-activedescendant", active ?? "");

    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeHidden();
    await expect(tableNode(page, "users")).toHaveAttribute("data-selected", "true");

    await openSearch(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(tableNode(page, "users")).toHaveAttribute("data-selected", "true");
  });

  test("AC-P2-T07-5: choosing a column highlights its row; Escape clears the highlight", async ({
    page,
  }) => {
    await openSearch(page);
    await search(page, "ord.user");
    await options(page).first().click();
    await expect(dialog(page)).toBeHidden();
    const row = tableNode(page, "orders").getByTestId("column-user_id");
    await expect(row).toHaveAttribute("data-highlighted", "true");
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("Escape");
    await expect(row).not.toHaveAttribute("data-highlighted", "true");
  });

  test("AC-P2-T07-5: choosing a table clears a table-list filter that hides it", async ({
    page,
  }) => {
    await page.getByTestId("table-filter").fill("audit");
    await expect(page.getByTestId("table-list-item-orders")).toHaveCount(0);
    await openSearch(page);
    await search(page, "orders");
    await options(page).first().click();
    await expect(page.getByTestId("table-filter")).toHaveValue("");
    await expect(page.getByTestId("table-list-item-orders")).toBeVisible();
  });

  test("AC-P2-T07-7: focus returns to the Search button on close", async ({ page }) => {
    await openSearch(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId("toolbar-search")).toBeFocused();
  });

  test("AC-P2-T07-10: one polite live region whose text alone changes", async ({ page }) => {
    await openSearch(page);
    const live = page.getByTestId("search-live");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await search(page, "user");
    await expect(live).toHaveText("4 results");
    await expect(page.getByTestId("search-status")).not.toHaveAttribute("aria-live", /.+/);
  });

  test("AC-P2-T07-2: prisma/blog.prisma queries", async ({ page }) => {
    await importFixture(page, "prisma/blog.prisma");
    await openSearch(page);
    await search(page, "authorId");
    await expect(options(page)).toContainText(["Comment.authorId", "posts.author_id"]);
    await search(page, "createdAt");
    await expect(options(page)).toContainText(["users.created_at"]);
  });

  test("AC-P2-T07-2: sql/edge-cases.postgres.sql queries", async ({ page }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await openSearch(page);
    await search(page, "order lines");
    await expect(options(page).first()).toContainText("Order Lines");
    await expect(options(page).first()).toHaveAttribute("data-kind", "table");
    await search(page, "quoted");
    await expect(options(page)).toContainText(['Order Lines.weird "quoted" col']);
    await search(page, "billing.inv");
    await expect(options(page)).toContainText(["billing.invoices"]);
    await expect(options(page).first()).toHaveAttribute("data-kind", "table");
  });
});
