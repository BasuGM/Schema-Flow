import { expect, test, type Page } from "@playwright/test";
import { importFixture, listItem, openSample, tableNode } from "./support/app";

const tab = (page: Page, name: "columns" | "keys" | "relations") =>
  page.getByTestId(`inspector-tab-${name}`);

async function expectCounts(page: Page, [c, k, r]: [number, number, number]): Promise<void> {
  await expect(tab(page, "columns")).toHaveText(new RegExp(`^Columns\\s*${c}$`));
  await expect(tab(page, "keys")).toHaveText(new RegExp(`^Keys\\s*${k}$`));
  await expect(tab(page, "relations")).toHaveText(new RegExp(`^Relations\\s*${r}$`));
}

async function select(page: Page, name: string): Promise<void> {
  await listItem(page, name).click();
  await expect(tableNode(page, name)).toHaveAttribute("data-selected", "true");
}

// AC-P2-T08 tab counts: Columns · Keys · Relations.
const SAMPLE_COUNTS: [string, [number, number, number]][] = [
  ["orders", [7, 2, 6]],
  ["users", [7, 2, 3]],
  ["order_items", [5, 2, 2]],
  ["products", [9, 5, 3]],
  ["payments", [6, 2, 1]],
  ["categories", [4, 2, 3]],
  ["audit_log", [5, 0, 0]],
];

test.describe("inspector (sample)", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("shows the empty state until a table is selected", async ({ page }) => {
    await expect(page.getByTestId("inspector-empty")).toBeVisible();
    await select(page, "orders");
    await expect(page.getByTestId("inspector-empty")).toHaveCount(0);
    await expect(page.getByTestId("inspector-title")).toContainText("orders");
  });

  for (const [name, counts] of SAMPLE_COUNTS) {
    test(`AC-P2-T08-1: ${name} tab counts ${counts.join(" · ")}`, async ({ page }) => {
      await select(page, name);
      await expectCounts(page, counts);
    });
  }

  test("AC-P2-T08-1: ←/→, Home/End move between tabs; the tab survives a new selection", async ({
    page,
  }) => {
    await select(page, "orders");
    await tab(page, "columns").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "keys")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tab(page, "relations")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "keys")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tab(page, "columns")).toHaveAttribute("aria-selected", "true");

    await tab(page, "keys").click();
    await select(page, "products");
    await expect(tab(page, "keys")).toHaveAttribute("aria-selected", "true");
  });

  test("AC-P2-T08-1: a new import resets the tab to Columns", async ({ page }) => {
    await select(page, "orders");
    await tab(page, "relations").click();
    await importFixture(page, "sql/shop.mysql.sql");
    await page.getByTestId("table-list").getByRole("button").first().click();
    await expect(tab(page, "columns")).toHaveAttribute("aria-selected", "true");
  });

  test("AC-P2-T08-3: clicking a column row highlights it in the inspector and on the canvas", async ({
    page,
  }) => {
    await select(page, "orders");
    const row = page.getByTestId("inspector-column-status");
    await row.getByTitle("Highlight on the canvas").click();
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(tableNode(page, "orders").getByTestId("column-status")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
  });

  test("AC-P2-T08-3: an FK target link selects the target table and shows Columns", async ({
    page,
  }) => {
    await select(page, "orders");
    await tab(page, "keys").click();
    await tab(page, "columns").click();
    await page
      .getByTestId("inspector-columns")
      .getByRole("button", { name: "Highlight column users.id" })
      .click();
    await expect(tableNode(page, "users")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("inspector-title")).toContainText("users");
    await expect(tab(page, "columns")).toHaveAttribute("aria-selected", "true");
    await expect(tableNode(page, "users").getByTestId("column-id")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
  });

  test("AC-P2-T08-5: Relations lists both directions; the table name navigates, Back restores", async ({
    page,
  }) => {
    await select(page, "users");
    await tab(page, "relations").click();
    await expect(page.getByTestId("inspector-outgoing")).toContainText("No foreign keys");
    await expect(
      page.getByTestId("inspector-incoming").getByTestId("inspector-relation"),
    ).toHaveCount(3);
    await expect(page.getByTestId("inspector-incoming")).toContainText(/ON DELETE cascade/i);
    await expect(page.getByTestId("inspector-incoming")).toContainText("orders_user_fk");
    await expect(page.getByTestId("inspector-back")).toHaveCount(0);

    await page
      .getByTestId("inspector-incoming")
      .getByRole("button", { name: "Show table orders" })
      .click();
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("inspector-title")).toContainText("orders");
    await expect(tab(page, "relations")).toHaveAttribute("aria-selected", "true");
    await expect(tableNode(page, "orders").getByTestId("column-user_id")).toHaveAttribute(
      "data-highlighted",
      "true",
    );

    await expect(page.getByTestId("inspector-back")).toContainText("users");
    await page.getByTestId("inspector-back").click();
    await expect(tableNode(page, "users")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("inspector-title")).toContainText("users");
    await expect(tab(page, "relations")).toHaveAttribute("aria-selected", "true");
  });

  test("AC-P2-T08-5: cardinality and the self badge", async ({ page }) => {
    await select(page, "payments");
    await tab(page, "relations").click();
    await expect(page.getByTestId("inspector-outgoing")).toContainText("1:1");
    await expect(page.getByTestId("inspector-outgoing")).toContainText("payments_order_fk");

    await select(page, "categories");
    await expect(page.getByTestId("inspector-outgoing")).toContainText("self");
    await expect(page.getByTestId("inspector-incoming")).toContainText("self");
  });

  test("AC-P2-T08-4: Keys lists the composite primary key and checks; empty states", async ({
    page,
  }) => {
    await select(page, "order_items");
    await tab(page, "keys").click();
    const panel = page.getByRole("tabpanel");
    await expect(panel).toContainText("order_items_pkey");
    await expect(panel).toContainText("order_id");
    await expect(panel).toContainText("line_no");
    await expect(panel).toContainText("quantity > 0");

    await select(page, "audit_log");
    await expect(panel).toContainText(/No (primary key|unique|indexes|checks)/i);
  });

  test("AC-P2-T08-2: enum values and defaults show on the column rows", async ({ page }) => {
    await select(page, "orders");
    await expect(
      page.getByTestId("inspector-column-status").getByTestId("inspector-column-enum"),
    ).toBeVisible();
    await expect(
      page.getByTestId("inspector-column-status").getByTestId("inspector-column-type"),
    ).toContainText("order_status");
  });

  test("the header button clears the selection and shows the empty state", async ({ page }) => {
    await select(page, "orders");
    await page.getByTestId("inspector-close").click();
    await expect(page.getByTestId("inspector-empty")).toBeVisible();
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "false");
  });
});

test.describe("inspector (imported fixtures)", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P2-T08: sql/edge-cases.postgres.sql — billing.invoices and Order Lines", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await select(page, "billing.invoices");
    await expectCounts(page, [4, 1, 1]);
    await expect(page.getByTestId("inspector-schema")).toContainText("billing");

    await select(page, "Order Lines");
    await expectCounts(page, [4, 1, 1]);
    await expect(page.getByTestId("inspector-columns")).toContainText("LineID");
    await expect(page.getByTestId("inspector-columns")).toContainText("it''s; fine");
    await expect(page.getByTestId("inspector-columns")).toContainText('weird "quoted" col');
  });

  test("AC-P2-T08: prisma/blog.prisma — _CategoryToPost is an implicit join table", async ({
    page,
  }) => {
    await importFixture(page, "prisma/blog.prisma");
    await select(page, "_CategoryToPost");
    await expectCounts(page, [2, 2, 2]);
    await expect(page.getByRole("complementary", { name: "Inspector" })).toContainText(
      "Implicit join table",
    );
    await tab(page, "keys").click();
    await expect(page.getByRole("tabpanel")).toContainText("_CategoryToPost_AB_unique");
    await tab(page, "relations").click();
    await expect(page.getByRole("tabpanel")).toContainText("Prisma implicit");
  });

  test("AC-P2-T08: prisma/shop.mysql.prisma — shipments has a composite 1:1 foreign key", async ({
    page,
  }) => {
    await importFixture(page, "prisma/shop.mysql.prisma");
    await select(page, "shipments");
    await expectCounts(page, [3, 2, 1]);
    await tab(page, "relations").click();
    await expect(page.getByTestId("inspector-outgoing")).toContainText("(order_id, line_no)");
    await expect(page.getByTestId("inspector-outgoing")).toContainText("1:1");
  });
});
