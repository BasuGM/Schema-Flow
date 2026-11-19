import { expect, test, type Page } from "@playwright/test";
import { importFixture, listItem, openSample, tableNode } from "./support/app";

// AC-P1-T06-8, AC-P2-T06-9/12, AC-P2-T07-9, AC-P2-T08-7, AC-P2-T10-5: the phone layout.
test.use({ viewport: { width: 390, height: 844 } });

const leftToggle = (page: Page) => page.getByTestId("toolbar-toggle-left");
const rightToggle = (page: Page) => page.getByTestId("toolbar-toggle-right");
const listSheet = (page: Page) => page.getByTestId("table-list-sheet");
const inspectorSheet = (page: Page) => page.getByTestId("inspector-sheet");

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.getByTestId("toolbar-more").click();
  await page.getByTestId(`more-theme-${theme}`).click();
  await expect(page.getByTestId(`more-theme-${theme}`)).toHaveCount(0);
}

test.describe("phone layout (390×844)", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`AC-P1-T06-8: no horizontal overflow with Issues counts showing (${theme})`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await importFixture(page, "sql/edge-cases.postgres.sql");
      await expect(page.getByTestId("toolbar-issues-errors")).toBeVisible();
      await expect(page.getByTestId("toolbar-issues-warnings")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      for (const id of ["toolbar-import", "toolbar-issues", "toolbar-more"]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      }
    });
  }

  test("AC-P2-T07-9: Layout, Theme and neighbourhood depth live in the More menu", async ({
    page,
  }) => {
    await expect(page.getByTestId("toolbar-layout")).toBeHidden();
    await expect(page.getByTestId("toolbar-settings")).toBeHidden();
    await page.getByTestId("toolbar-more").click();
    await expect(page.getByTestId("more-layout")).toBeVisible();
    await expect(page.getByTestId("more-theme-system")).toBeVisible();
    for (const depth of [0, 1, 2]) {
      await expect(page.getByTestId(`more-neighbourhood-${depth}`)).toBeVisible();
    }
    await expect(page.getByTestId("more-neighbourhood-1")).toHaveAttribute("aria-checked", "true");
  });

  test("AC-P2-T10-5: the table list opens as a sheet; picking a table closes it and selects", async ({
    page,
  }) => {
    await expect(listSheet(page)).toHaveCount(0);
    await leftToggle(page).click();
    await expect(listSheet(page)).toBeVisible();
    await expect(leftToggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(listSheet(page)).toBeFocused();

    await listItem(page, "orders").click();
    await expect(listSheet(page)).toHaveCount(0);
    await expect(leftToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");
    await expect(inspectorSheet(page)).toHaveCount(0);
    await expect(leftToggle(page)).toBeFocused();
  });

  test("AC-P2-T10-5: Escape and Close tables close the sheet; selection and filter survive", async ({
    page,
  }) => {
    await leftToggle(page).click();
    await listItem(page, "orders").click();
    await leftToggle(page).click();
    await page.getByTestId("table-filter").fill("pay");
    await page.keyboard.press("Escape");
    await expect(listSheet(page)).toHaveCount(0);
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");

    await leftToggle(page).click();
    await expect(page.getByTestId("table-filter")).toHaveValue("pay");
    await page.getByTestId("table-list-sheet-close").click();
    await expect(listSheet(page)).toHaveCount(0);
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");
  });

  test("AC-P2-T10-5: opening one sheet closes the other", async ({ page }) => {
    await leftToggle(page).click();
    await expect(listSheet(page)).toBeVisible();
    await rightToggle(page).click();
    await expect(inspectorSheet(page)).toBeVisible();
    await expect(listSheet(page)).toHaveCount(0);
    await leftToggle(page).click();
    await expect(listSheet(page)).toBeVisible();
    await expect(inspectorSheet(page)).toHaveCount(0);
  });

  test("AC-P2-T08-7: the inspector opens as a sheet with Close inspector; lists scroll inside it", async ({
    page,
  }) => {
    await tableNode(page, "orders").click({ position: { x: 20, y: 12 } });
    await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");
    await expect(inspectorSheet(page)).toHaveCount(0);
    await rightToggle(page).click();
    await expect(inspectorSheet(page)).toBeVisible();
    await expect(page.getByTestId("inspector-title")).toContainText("orders");
    for (const tab of ["columns", "keys", "relations"]) {
      await expect(page.getByTestId(`inspector-tab-${tab}`)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await page.getByTestId("inspector-sheet-close").click();
    await expect(inspectorSheet(page)).toHaveCount(0);
    await expect(rightToggle(page)).toBeFocused();
  });

  test("AC-P2-T06-9/12: the issues panel is a bottom sheet and the tables fit above it", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    const sheet = page.getByTestId("issues-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("issues-close")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const sheetTop = (await sheet.boundingBox())!.y;
    await expect
      .poll(async () => {
        const bottoms: number[] = [];
        for (const name of ["users", "billing.invoices", "Order Lines"]) {
          const box = await tableNode(page, name).boundingBox();
          if (box) bottoms.push(box.y + box.height);
        }
        return bottoms.length === 3 && Math.max(...bottoms) <= sheetTop;
      })
      .toBe(true);

    await page.getByTestId("issues-close").click();
    await expect(sheet).toHaveCount(0);
  });

  test("AC-P2-T10-5: widening past 768 px with the sheet open docks the list", async ({ page }) => {
    await leftToggle(page).click();
    await expect(listSheet(page)).toBeVisible();
    await page.setViewportSize({ width: 1000, height: 844 });
    await expect(listSheet(page)).toHaveCount(0);
    await expect(page.getByTestId("panel-content-left")).not.toHaveAttribute("inert", /.*/);
    await expect(page.getByTestId("table-list")).toBeVisible();
    await expect(leftToggle(page)).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });
});
