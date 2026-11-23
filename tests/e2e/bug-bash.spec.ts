import { expect, test, type Locator, type Page } from "@playwright/test";
import { clickTable, importFixture, openSample, tableNode } from "./support/app";

// BB-P2 (docs/development/plans/bug-bash-p2.md): the automated rows. Row 4 (focus is never lost to
// `body`), row 5 (viewport × theme matrix, no horizontal overflow) and row 7 (the console stays
// empty). AC-BB-P2-1…3.

/** Console messages that are not ours (browser or third party). Documented in the charter. */
const ALLOWED_WARNINGS: RegExp[] = [];

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    const text = m.text();
    if (
      m.type() === "error" ||
      (m.type() === "warning" && !ALLOWED_WARNINGS.some((r) => r.test(text)))
    )
      problems.push(`${m.type()}: ${text.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
  return problems;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Presses Tab (real keyboard input) until `target` has focus; fails after `max` presses. */
async function tabTo(page: Page, target: Locator, max = 30): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach the target in ${max} presses`);
}

const title = (page: Page) => page.getByTestId("inspector-title");
const titleHasRing = (page: Page) => title(page).evaluate((el) => el.matches(":focus-visible"));

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

test.describe("row 7: the console stays empty", () => {
  test("AC-BB-P2-1: a journey through every Phase 2 feature logs no errors or warnings", async ({
    page,
  }) => {
    test.setTimeout(120_000); // imports real/mysqldump-180
    const problems = watchConsole(page);
    await openSample(page);
    await clickTable(page, "orders");
    await page.getByTestId("toolbar-search").click();
    await page.getByTestId("search-input").fill("user");
    await page.getByTestId("search-option").first().click();
    await page.keyboard.press("Escape");
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    await page.getByTestId("issue-show-table").first().click();
    await importFixture(page, "prisma/shop.mysql.prisma");
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-neighbourhood-2").click();
    await page.keyboard.press("Escape");
    await importFixture(page, "real/mysqldump-180.mysql.sql");
    await expect(page.getByTestId("schema-canvas")).toHaveAttribute("data-zoomed-out", "true");
    expect(problems).toEqual([]);
  });
});

test.describe("row 5: viewport × theme matrix", () => {
  const VIEWPORTS = [
    { width: 390, height: 844 },
    { width: 768, height: 800 },
    { width: 900, height: 800 },
    { width: 1280, height: 800 },
  ];
  for (const viewport of VIEWPORTS) {
    for (const theme of ["light", "dark"] as const) {
      test(`AC-BB-P2-2: no horizontal overflow at ${viewport.width}px (${theme})`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openSample(page);
        await setTheme(page, theme);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        await importFixture(page, "sql/edge-cases.postgres.sql");
        expect(await overflow(page)).toBeLessThanOrEqual(0);
        if (viewport.width < 768) {
          await page.getByTestId("toolbar-toggle-left").click();
          await expect(page.getByTestId("table-list-sheet")).toBeVisible();
          expect(await overflow(page)).toBeLessThanOrEqual(0);
        }
      });
    }
  }

  test("AC-BB-P2-2: resizing across the breakpoints with a table selected keeps the layout sound", async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSample(page);
    await clickTable(page, "orders");
    for (const width of [900, 768, 700, 390, 700, 900, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await overflow(page), `overflow at ${width}`).toBeLessThanOrEqual(0);
      await expect(tableNode(page, "orders")).toHaveAttribute("data-selected", "true");
    }
    expect(problems).toEqual([]);
  });
});

test.describe("row 4: focus is never lost to the body", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-BB-P2-3: closing the import dialog (Escape and Cancel) returns focus", async ({
    page,
  }) => {
    for (const close of ["Escape", "Cancel"] as const) {
      await page.getByTestId("toolbar-import").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("import-dialog")).toBeVisible();
      if (close === "Escape") await page.keyboard.press("Escape");
      else await page.getByTestId("import-cancel").click();
      await expect(page.getByTestId("import-dialog")).toBeHidden();
      await expect(page.getByTestId("toolbar-import")).toBeFocused();
    }
  });

  test("AC-BB-P2-3: closing search and the settings menu returns focus", async ({ page }) => {
    await page.getByTestId("toolbar-search").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("search-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-dialog")).toBeHidden();
    await expect(page.getByTestId("toolbar-search")).toBeFocused();
    await page.getByTestId("toolbar-settings").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("toolbar-settings")).toBeFocused();
  });

  test("AC-BB-P2-3: closing the issues panel by its close button returns focus", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    await page.getByTestId("issues-close").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("issues-panel")).toBeHidden();
    await expect(page.getByTestId("toolbar-issues")).toBeFocused();
  });

  test("AC-BB-P2-3: Show table from an issue and the inspector close button keep focus", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    const show = page.getByTestId("issue-show-table").first();
    await show.focus();
    await page.keyboard.press("Enter");
    await expect(show).toBeFocused();
    const close = page.getByTestId("inspector-close");
    await expect(close).toBeVisible();
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("inspector-empty")).toBeFocused();
  });

  test("AC-P3-T08-1/2: Enter on a relation target and on Back moves focus to the inspector title", async ({
    page,
  }) => {
    await clickTable(page, "orders");
    await page.getByTestId("inspector-tab-relations").click();
    const target = page
      .getByTestId("inspector-outgoing")
      .getByRole("button", { name: "Show table users" });
    await tabTo(page, target);
    await page.keyboard.press("Enter");
    await expect(title(page)).toBeFocused();
    await expect(title(page)).toContainText("users");
    await expect(page.getByTestId("inspector-tab-relations")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await titleHasRing(page)).toBe(true);

    await page.keyboard.press("Shift+Tab"); // Back sits just before the title
    await expect(page.getByTestId("inspector-back")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(title(page)).toBeFocused();
    await expect(title(page)).toContainText("orders");
    expect(await titleHasRing(page)).toBe(true);
  });

  test("AC-P3-T08-3: a mouse click on a relation target or Back focuses the title without a ring", async ({
    page,
  }) => {
    await clickTable(page, "orders");
    await page.getByTestId("inspector-tab-relations").click();
    await page
      .getByTestId("inspector-outgoing")
      .getByRole("button", { name: "Show table users" })
      .click();
    await expect(title(page)).toBeFocused();
    expect(await titleHasRing(page)).toBe(false);
    await page.getByTestId("inspector-back").click();
    await expect(title(page)).toBeFocused();
    await expect(title(page)).toContainText("orders");
    expect(await titleHasRing(page)).toBe(false);
  });

  test("AC-P3-T08-1: Enter on a relation target in the phone sheet moves focus to the title", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clickTable(page, "orders");
    await page.getByTestId("toolbar-toggle-right").click();
    await expect(page.getByTestId("inspector-sheet")).toBeVisible();
    await page.getByTestId("inspector-tab-relations").click();
    const target = page
      .getByTestId("inspector-outgoing")
      .getByRole("button", { name: "Show table users" });
    await tabTo(page, target);
    await page.keyboard.press("Enter");
    await expect(title(page)).toBeFocused();
    await expect(title(page)).toContainText("users");
  });

  test("AC-P3-T08-4: Choose file… shows a focus ring for keyboard focus only", async ({ page }) => {
    await page.getByTestId("toolbar-import").click();
    await expect(page.getByTestId("import-dialog")).toBeVisible();
    const input = page.getByTestId("import-file-input");
    const label = page.locator("label", { has: input });
    const shadow = () => label.evaluate((el) => getComputedStyle(el).boxShadow);
    await page.getByTestId("import-textarea").focus();
    await tabTo(page, input);
    // The Button animates its ring in (transition), so poll.
    await expect.poll(shadow).not.toBe("none");

    await page.getByTestId("import-textarea").click();
    await expect.poll(shadow).toBe("none");
    const chooser = page.waitForEvent("filechooser");
    await label.click();
    await chooser; // dismissed: never answered
    await expect.poll(shadow).toBe("none");
  });
});
