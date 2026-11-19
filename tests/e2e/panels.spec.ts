import { expect, test, type Locator, type Page } from "@playwright/test";
import { clickTable, importFixture, openSample } from "./support/app";

type Side = "left" | "right";

const toggle = (page: Page, side: Side) => page.getByTestId(`toolbar-toggle-${side}`);
const content = (page: Page, side: Side) => page.getByTestId(`panel-content-${side}`);
const separator = (page: Page, name: string) => page.getByRole("separator", { name });

const SEPARATORS: { side: Side; name: string }[] = [
  { side: "left", name: "Resize table list" },
  { side: "right", name: "Resize inspector" },
];

async function width(handle: Locator): Promise<number> {
  return Number(await handle.getAttribute("aria-valuenow"));
}

/** Presses Tab `times` times and returns whether focus ever sat inside `panel`. */
async function tabbedInto(page: Page, panel: Locator, times: number): Promise<boolean> {
  const inside = await panel.elementHandle();
  if (!inside) throw new Error("panel not found");
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((el) => el.contains(document.activeElement), inside)) return true;
  }
  return false;
}

test.describe("side panels", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  for (const { side } of SEPARATORS) {
    test(`AC-P1-T06-10: a collapsed ${side} panel is inert and not reachable by Tab`, async ({
      page,
    }) => {
      await expect(content(page, side)).not.toHaveAttribute("inert", /.*/);
      await toggle(page, side).click();
      await expect(toggle(page, side)).toHaveAttribute("aria-expanded", "false");
      await expect(content(page, side)).toHaveAttribute("inert", "");
      await page.locator("body").click({ position: { x: 2, y: 2 } });
      expect(await tabbedInto(page, content(page, side), 40)).toBe(false);

      await toggle(page, side).click();
      await expect(toggle(page, side)).toHaveAttribute("aria-expanded", "true");
      await expect(content(page, side)).not.toHaveAttribute("inert", /.*/);
    });
  }

  test("AC-P1-T06-10: focus inside a panel that auto-collapses moves to its toolbar toggle", async ({
    page,
  }) => {
    await page.getByTestId("table-filter").focus();
    await page.setViewportSize({ width: 880, height: 800 });
    await expect(toggle(page, "left")).toHaveAttribute("aria-expanded", "false");
    await expect(toggle(page, "left")).toBeFocused();
    await expect(content(page, "left")).toHaveAttribute("inert", "");
  });

  test("AC-P1-T06-10: filter text survives collapsing and re-expanding", async ({ page }) => {
    await page.getByTestId("table-filter").fill("ord");
    await toggle(page, "left").click();
    await toggle(page, "left").click();
    await expect(page.getByTestId("table-filter")).toHaveValue("ord");
  });

  for (const { side, name } of SEPARATORS) {
    test(`AC-P2-T10-6: Enter on "${name}" collapses and restores the previous width`, async ({
      page,
    }) => {
      const handle = separator(page, name);
      const before = await width(handle);
      await handle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle(page, side)).toHaveAttribute("aria-expanded", "false");
      await expect(content(page, side)).toHaveAttribute("inert", "");
      await expect(handle).toBeFocused();
      // aria-valuenow follows the panel before the separator (the canvas, for the inspector).
      await expect.poll(() => width(handle)).not.toBe(before);

      await page.keyboard.press("Enter");
      await expect(toggle(page, side)).toHaveAttribute("aria-expanded", "true");
      await expect(content(page, side)).not.toHaveAttribute("inert", /.*/);
      await expect(handle).toBeFocused();
      await expect.poll(() => width(handle)).toBe(before);
    });

    test(`AC-P1-T06-10: arrow keys resize "${name}"`, async ({ page }) => {
      const handle = separator(page, name);
      await handle.focus();
      const start = await width(handle);
      // The inspector's edge grows leftwards, so compare in a direction-agnostic way.
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => width(handle)).not.toBe(start);
      const moved = await width(handle);
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => width(handle)).not.toBe(moved);
    });
  }

  test("AC-P2-T10-6: Enter on the issues separator closes the panel and focuses the toolbar button", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    const handle = separator(page, "Resize issues panel");
    const before = await width(handle);
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("issues-panel")).toHaveCount(0);
    await expect(page.getByTestId("toolbar-issues")).toBeFocused();
    await expect(page.getByTestId("toolbar-issues")).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    await expect(page.getByTestId("toolbar-issues")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => width(separator(page, "Resize issues panel"))).toBe(before);
  });

  test("selection and canvas keep working while the table list is collapsed", async ({ page }) => {
    await toggle(page, "left").click();
    await clickTable(page, "orders");
    await expect(page.getByTestId("inspector-title")).toContainText("orders");
  });
});
