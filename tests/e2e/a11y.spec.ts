import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { clickTable, importFixture, openSample } from "./support/app";

/**
 * P4-T06: automated axe audit of the everyday screens in both themes (ADR-038).
 * Rule tags: WCAG 2.0/2.1 A and AA. No rule is disabled; zero violations is the assertion.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  const desktop = page.getByTestId("toolbar-theme");
  if (await desktop.isVisible()) {
    await desktop.click();
    await page.getByTestId(`theme-${theme}`).click();
    await expect(page.getByTestId(`theme-${theme}`)).toHaveCount(0);
  } else {
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId(`more-theme-${theme}`).click();
    await expect(page.getByTestId(`more-theme-${theme}`)).toHaveCount(0);
  }
}

/** Fails with a compact list: rule id, impact, count and the first targets. */
async function expectNoViolations(page: Page, state: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  expect(summary, `axe violations in "${state}"`).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`axe audit (${theme})`, () => {
    // Dialogs fade in; axe would read colours mid-fade. Reduced motion (honoured by globals.css)
    // makes the state settled and deterministic.
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("start screen", async ({ page }) => {
      await page.goto("/");
      await setTheme(page, theme);
      await expectNoViolations(page, "start screen");
    });

    test("sample, selection and inspector tabs", async ({ page }) => {
      await openSample(page);
      await setTheme(page, theme);
      await expectNoViolations(page, "sample");
      await clickTable(page, "orders");
      for (const tab of ["columns", "relations", "path"]) {
        await page.getByTestId(`inspector-tab-${tab}`).click();
        await expectNoViolations(page, `inspector ${tab}`);
      }
    });

    test("dialogs", async ({ page }) => {
      await openSample(page);
      await setTheme(page, theme);
      const dialogs: [string, string, string][] = [
        ["search", "toolbar-search", "search-dialog"],
        ["import", "toolbar-import", "import-dialog"],
        ["export", "toolbar-export", "export-dialog"],
      ];
      for (const [name, opener, dialog] of dialogs) {
        await page.getByTestId(opener).click();
        await expect(page.getByTestId(dialog)).toBeVisible();
        // Export renders its preview asynchronously; its buttons change while it generates.
        await expect(page.getByTestId("export-generating")).toHaveCount(0);
        await expectNoViolations(page, `${name} dialog`);
        await page.keyboard.press("Escape");
        await expect(page.getByTestId(dialog)).toHaveCount(0);
      }
      await page.keyboard.press("?");
      await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
      await expectNoViolations(page, "shortcuts dialog");
    });

    test("issues and health panels", async ({ page }) => {
      await page.goto("/");
      await importFixture(page, "sql/health.postgres.sql");
      await setTheme(page, theme);
      await page.getByTestId("toolbar-issues").click();
      await expect(page.getByTestId("health-panel")).toBeVisible();
      await expectNoViolations(page, "health panel");
      await page.getByTestId("bottom-tab-issues").click();
      await expectNoViolations(page, "issues panel");
    });

    test("phone table list sheet", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openSample(page);
      await setTheme(page, theme);
      await page.getByTestId("toolbar-toggle-left").click();
      await expect(page.getByTestId("table-list-sheet")).toBeVisible();
      await expectNoViolations(page, "phone table list");
    });
  });
}

test("AC-P4-T06-2: the skip link is the first Tab stop and moves focus to the diagram", async ({
  page,
}) => {
  await openSample(page);
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("skip-link")).toBeFocused();
  await expect(page.getByTestId("skip-link")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "Diagram" })).toBeFocused();
});

test("AC-P4-T06-3: React Flow controls use SchemaFlow wording", async ({ page }) => {
  await openSample(page);
  await expect(page.getByRole("button", { name: "Fit diagram to view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toHaveAttribute("aria-describedby", /.+/);
});
