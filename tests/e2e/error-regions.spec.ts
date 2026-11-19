import { expect, test, type Page } from "@playwright/test";
import { importFixture, openSample } from "./support/app";

/**
 * AC-P2-T10-3 / AC-P2-T10-4. The crash hooks only exist in a build made with
 * `NEXT_PUBLIC_QA_HOOKS=1` (serve `out-qa/` and set `E2E_BASE_URL`), so the region tests run only
 * with `E2E_QA_HOOKS=1`. Against a normal build the last test checks that the hooks are absent.
 */
const QA = process.env.E2E_QA_HOOKS === "1";

interface QaWindow {
  schemaflowQa?: { crash(region: string): void; heal(region?: string): void };
}

const crash = (page: Page, region: string) =>
  page.evaluate((r) => (window as unknown as QaWindow).schemaflowQa?.crash(r), region);
const heal = (page: Page) =>
  page.evaluate(() => (window as unknown as QaWindow).schemaflowQa?.heal());

interface Region {
  qa: string;
  testId: string;
  name: string;
  /** What shows when the region renders normally. */
  content: string;
  /** Puts the page in a state where the region is on screen (before the crash). */
  prepare?: (page: Page) => Promise<void>;
  /** The dialog's autofocus leaves focus on Try again (search only; the import form's does not). */
  focusesRetry?: boolean;
  /** Dialogs only mount their region when opened (after the crash). */
  reveal?: (page: Page) => Promise<void>;
}

const REGIONS: Region[] = [
  { qa: "canvas", testId: "canvas-error", name: "diagram", content: "schema-canvas" },
  { qa: "table-list", testId: "table-list-error", name: "table list", content: "table-filter" },
  { qa: "inspector", testId: "inspector-error", name: "inspector", content: "inspector-empty" },
  {
    qa: "issues",
    testId: "issues-error",
    name: "issues panel",
    content: "issues-list",
    prepare: (page) => importFixture(page, "sql/edge-cases.postgres.sql"),
  },
  {
    qa: "search",
    testId: "search-error",
    name: "search",
    content: "search-input",
    focusesRetry: true,
    reveal: (page) => page.getByTestId("toolbar-search").click(),
  },
  {
    qa: "import",
    testId: "import-error",
    name: "import form",
    content: "import-textarea",
    reveal: (page) => page.getByTestId("toolbar-import").click(),
  },
];

test.describe("error regions (QA build)", () => {
  test.skip(!QA, "needs E2E_QA_HOOKS=1 against a build made with NEXT_PUBLIC_QA_HOOKS=1");

  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  for (const region of REGIONS) {
    test(`AC-P2-T10-3: ${region.qa} shows its fallback; the rest keeps working`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await region.prepare?.(page);
      await crash(page, region.qa);
      await region.reveal?.(page);

      const fallback = page.getByTestId(region.testId);
      await expect(fallback).toBeVisible();
      await expect(fallback).toContainText(`The ${region.name} could not be displayed.`);
      await expect(fallback).toContainText("QA hook: simulated render error");
      await expect(page.getByTestId(`${region.testId}-retry`)).toBeVisible();
      await expect(page.getByTestId("toolbar")).toBeVisible();

      // Exactly two console errors per crash: React's report and SchemaFlow's own line.
      await expect.poll(() => errors.length).toBe(2);
      expect(errors.some((e) => e.includes("QA hook"))).toBe(true);
      expect(
        errors.some((e) => e.includes(`SchemaFlow: the ${region.name} could not be displayed.`)),
      ).toBe(true);
    });

    test(`AC-P2-T10-3: ${region.qa} Try again does not loop and recovers after heal`, async ({
      page,
    }) => {
      await region.prepare?.(page);
      await crash(page, region.qa);
      await region.reveal?.(page);
      const fallback = page.getByTestId(region.testId);
      await expect(fallback).toBeVisible();

      await page.getByTestId(`${region.testId}-retry`).click();
      await expect(fallback).toBeVisible();

      await heal(page);
      await page.getByTestId(`${region.testId}-retry`).click();
      await expect(fallback).toHaveCount(0);
      await expect(page.getByTestId(region.content).first()).toBeVisible();
    });
  }

  for (const region of REGIONS.filter((r) => r.reveal)) {
    test(`AC-P2-T10-3: ${region.qa} dialog — Escape closes (focus on Try again where the region held it)`, async ({
      page,
    }) => {
      await crash(page, region.qa);
      await region.reveal?.(page);
      await expect(page.getByTestId(region.testId)).toBeVisible();
      if (region.focusesRetry) {
        await expect(page.getByTestId(`${region.testId}-retry`)).toBeFocused();
      }
      await page.keyboard.press("Escape");
      await expect(page.getByTestId(region.testId)).toHaveCount(0);
      await expect(page.getByTestId("workspace")).toBeVisible();
    });

    test(`AC-P2-T10-3: ${region.qa} dialog — Close button closes the failed dialog`, async ({
      page,
    }) => {
      await crash(page, region.qa);
      await region.reveal?.(page);
      await page.getByTestId(`${region.testId}-close`).click();
      await expect(page.getByTestId(region.testId)).toHaveCount(0);
    });
  }

  test("AC-P2-T10-3: a new import resets a failed panel region", async ({ page }) => {
    await crash(page, "table-list");
    await expect(page.getByTestId("table-list-error")).toBeVisible();
    await heal(page);
    await importFixture(page, "sql/shop.mysql.sql");
    await expect(page.getByTestId("table-list-error")).toHaveCount(0);
    await expect(page.getByTestId("table-filter")).toBeVisible();
  });

  test("AC-P2-T10-4: crash(app) shows app-error; Try again after heal restores the workspace", async ({
    page,
  }) => {
    await crash(page, "app");
    const error = page.getByTestId("app-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("SchemaFlow hit an unexpected error.");
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await heal(page);
    await page.getByTestId("app-error-retry").click();
    await expect(error).toHaveCount(0);
    await expect(page.getByTestId("workspace")).toBeVisible();
  });

  test("AC-P2-T10-4: crash(root) shows global-error; Try again after heal restores the workspace", async ({
    page,
  }) => {
    await crash(page, "root");
    const error = page.getByTestId("global-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("SchemaFlow hit an unexpected error.");
    await heal(page);
    await error.getByRole("button", { name: "Try again" }).click();
    await expect(error).toHaveCount(0);
    await expect(page.getByTestId("workspace")).toBeVisible();
  });
});

test.describe("normal build", () => {
  test.skip(QA, "the QA build is expected to expose the hooks");

  test("AC-P2-T10-4: schemaflowQa is undefined", async ({ page }) => {
    await openSample(page);
    expect(await page.evaluate(() => "schemaflowQa" in window)).toBe(false);
  });
});
