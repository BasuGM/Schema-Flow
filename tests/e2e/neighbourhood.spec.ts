import { expect, test, type Page } from "@playwright/test";
import { clickTable, importFixture, openSample, tableNode } from "./support/app";

const SAMPLE_TABLES = [
  "users",
  "addresses",
  "categories",
  "products",
  "product_categories",
  "coupons",
  "orders",
  "order_items",
  "payments",
  "shipments",
  "reviews",
  "audit_log",
];

// The sample's 13 relationships as [from, to] (a self-reference is [categories, categories]).
const SAMPLE_EDGES: [string, string][] = [
  ["addresses", "users"],
  ["categories", "categories"],
  ["product_categories", "products"],
  ["product_categories", "categories"],
  ["orders", "users"],
  ["orders", "addresses"],
  ["orders", "coupons"],
  ["order_items", "orders"],
  ["order_items", "products"],
  ["payments", "orders"],
  ["shipments", "orders"],
  ["reviews", "products"],
  ["reviews", "users"],
];

// AC-P2-T09 table: tables in focus besides the selected one, per depth.
const FOCUS: Record<string, { 1: string[]; 2: string[] }> = {
  orders: {
    1: ["users", "addresses", "coupons", "order_items", "payments", "shipments"],
    2: [
      "users",
      "addresses",
      "coupons",
      "order_items",
      "payments",
      "shipments",
      "products",
      "reviews",
    ],
  },
  users: {
    1: ["addresses", "orders", "reviews"],
    2: [
      "addresses",
      "orders",
      "reviews",
      "products",
      "coupons",
      "order_items",
      "payments",
      "shipments",
    ],
  },
  categories: {
    1: ["product_categories"],
    2: ["product_categories", "products"],
  },
  audit_log: { 1: [], 2: [] },
  payments: {
    1: ["orders"],
    2: ["orders", "users", "addresses", "coupons", "order_items", "shipments"],
  },
};

async function dimmedTables(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const name of SAMPLE_TABLES) {
    if ((await tableNode(page, name).getAttribute("data-dimmed")) === "true") found.push(name);
  }
  return found.sort();
}

/** A viewport point where the topmost element is the bare canvas pane (no node, edge or control). */
async function emptyPaneSpot(page: Page): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (!pane) return null;
    const box = pane.getBoundingClientRect();
    for (let y = box.top + 20; y < box.bottom - 20; y += 20) {
      for (let x = box.left + 20; x < box.right - 20; x += 20) {
        if (document.elementFromPoint(x, y) === pane) return { x, y };
      }
    }
    return null;
  });
  if (!spot) throw new Error("no empty canvas area to click");
  return spot;
}

async function setDepth(page: Page, depth: 0 | 1 | 2): Promise<void> {
  await page.getByTestId("toolbar-settings").click();
  await page.getByTestId(`settings-neighbourhood-${depth}`).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(`settings-neighbourhood-${depth}`)).toHaveCount(0);
}

/** Waits for the dimmed set to equal `expected` (dimming is state, so poll the attributes). */
async function expectDimmed(page: Page, selected: string, inFocus: string[]): Promise<void> {
  const focus = new Set([selected, ...inFocus]);
  const expected = SAMPLE_TABLES.filter((t) => !focus.has(t)).sort();
  await expect.poll(() => dimmedTables(page)).toEqual(expected);
  const dimmedEdges = SAMPLE_EDGES.filter(([a, b]) => !focus.has(a) || !focus.has(b)).length;
  await expect(page.locator("g.relationship-edge[data-dimmed]")).toHaveCount(dimmedEdges);
  await expect(page.locator("g.relationship-edge")).toHaveCount(SAMPLE_EDGES.length);
}

test.describe("neighbourhood highlighting (sample)", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P2-T09-1: with nothing selected, nothing is dimmed", async ({ page }) => {
    await expect.poll(() => dimmedTables(page)).toEqual([]);
    await expect(page.locator("g.relationship-edge[data-dimmed]")).toHaveCount(0);
  });

  for (const [table, sets] of Object.entries(FOCUS)) {
    test(`AC-P2-T09-1: ${table} at 1 hop`, async ({ page }) => {
      await clickTable(page, table);
      await expectDimmed(page, table, sets[1]);
    });

    test(`AC-P2-T09-2: ${table} at 2 hops`, async ({ page }) => {
      await setDepth(page, 2);
      await clickTable(page, table);
      await expectDimmed(page, table, sets[2]);
    });
  }

  test("AC-P2-T09-2: Off dims nothing", async ({ page }) => {
    await setDepth(page, 0);
    await clickTable(page, "orders");
    await expect.poll(() => dimmedTables(page)).toEqual([]);
    await expect(page.locator("g.relationship-edge[data-dimmed]")).toHaveCount(0);
  });

  test("AC-P2-T09-2: Escape clears the dimming; the depth survives selections and imports", async ({
    page,
  }) => {
    await setDepth(page, 2);
    await clickTable(page, "orders");
    await expectDimmed(page, "orders", FOCUS.orders!["2"]);
    await page.keyboard.press("Escape");
    await expect.poll(() => dimmedTables(page)).toEqual([]);
    await clickTable(page, "orders");
    await expectDimmed(page, "orders", FOCUS.orders!["2"]);

    await importFixture(page, "sql/shop.mysql.sql");
    await page.getByTestId("toolbar-settings").click();
    await expect(page.getByTestId("settings-neighbourhood-2")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("AC-P2-T09-1: a pane click clears the dimming", async ({ page }) => {
    await clickTable(page, "users");
    await expectDimmed(page, "users", FOCUS.users![1]);
    const spot = await emptyPaneSpot(page);
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(() => dimmedTables(page)).toEqual([]);
  });

  test("AC-P2-T09-1: selecting from the table list dims the same set", async ({ page }) => {
    await page.getByTestId("table-list-item-orders").click();
    await expectDimmed(page, "orders", FOCUS.orders![1]);
  });

  test("AC-P2-T09-3: a dimmed table stays selectable with the keyboard", async ({ page }) => {
    await clickTable(page, "orders");
    await expect(tableNode(page, "audit_log")).toHaveAttribute("data-dimmed", "true");
    await page.getByTestId("table-list-item-audit_log").click();
    await expect(tableNode(page, "audit_log")).toHaveAttribute("data-selected", "true");
    await expect(tableNode(page, "audit_log")).not.toHaveAttribute("data-dimmed", "true");
  });

  test("AC-P2-T09-3: per-theme dim opacity tokens", async ({ page }) => {
    const tokens = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return ["--dim-node", "--dim-edge", "--dim-node-hover"].map((n) =>
          Number.parseFloat(style.getPropertyValue(n)),
        );
      });
    await page.getByTestId("toolbar-theme").click();
    await page.getByTestId("theme-light").click();
    await expect(page.getByTestId("theme-light")).toHaveCount(0);
    await expect.poll(tokens).toEqual([0.3, 0.15, 0.7]);
    await page.getByTestId("toolbar-theme").click();
    await page.getByTestId("theme-dark").click();
    await expect.poll(tokens).toEqual([0.4, 0.25, 0.75]);
  });
});
