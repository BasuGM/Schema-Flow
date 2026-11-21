import { expect, test, type Page } from "@playwright/test";
import { importFixture, openSample, tableNode } from "./support/app";

interface Row {
  severity: "error" | "warning";
  line: number | null;
  starts: string;
  /** Test-id suffix of the table "Show table" selects; null = no button. */
  table: string | null;
  /** First and last line number of the excerpt; null = no excerpt. */
  excerpt: [number, number] | null;
}

// AC-P2-T06 tables: order is errors first, then by line, then issues without a line.
const EDGE_CASES_SQL: Row[] = [
  {
    severity: "error",
    line: 27,
    starts: 'Duplicate table "public.USERS"',
    table: "users",
    excerpt: [25, 29],
  },
  {
    severity: "warning",
    line: 14,
    starts: 'Foreign key on "invoices" references unknown table "ghosts".',
    table: "billing.invoices",
    excerpt: [12, 16],
  },
  {
    severity: "warning",
    line: 23,
    starts: "Skipped unsupported statement: CREATE VIEW.",
    table: null,
    excerpt: [21, 25],
  },
  {
    severity: "warning",
    line: 29,
    starts: "Could not parse CREATE TABLE: Expected referenced table near",
    table: null,
    excerpt: [27, 31],
  },
  {
    severity: "warning",
    line: 31,
    starts: 'Skipped an index on expressions for "users".',
    table: "users",
    excerpt: [29, 32],
  },
  {
    severity: "warning",
    line: null,
    starts: "Skipped 3 statements not needed for the diagram: schemas ×1,",
    table: null,
    excerpt: null,
  },
];

const PGDUMP_SQL: Row[] = [
  {
    severity: "warning",
    line: 130,
    starts: 'Skipped an index on expressions for "projects".',
    table: "projects",
    excerpt: [128, 132],
  },
  {
    severity: "warning",
    line: null,
    starts: "Skipped 31 statements not needed for the diagram: SET ×11, S",
    table: null,
    excerpt: null,
  },
];

const rows = (page: Page) => page.getByTestId("issue-row");

async function expectRows(page: Page, expected: Row[]): Promise<void> {
  await expect(rows(page)).toHaveCount(expected.length);
  for (const [i, want] of expected.entries()) {
    const row = rows(page).nth(i);
    await expect(row).toHaveAttribute("data-severity", want.severity);
    await expect(row).toContainText(want.starts);
    if (want.line === null) await expect(row.getByTestId("issue-line")).toHaveCount(0);
    else await expect(row.getByTestId("issue-line")).toHaveText(`line ${want.line}`);
    await expect(row.getByTestId("issue-show-table")).toHaveCount(want.table === null ? 0 : 1);
  }
}

test.describe("issues panel", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P2-T06-1/2: the sample has none; an import with errors opens the panel", async ({
    page,
  }) => {
    const button = page.getByTestId("toolbar-issues");
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute(
      "aria-label",
      "Issues and health checks: No import issues",
    );
    await expect(page.getByTestId("issues-panel")).toHaveCount(0);

    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute(
      "aria-label",
      "Issues and health checks: 1 error, 5 warnings",
    );
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("toolbar-issues-errors")).toHaveText("1");
    await expect(page.getByTestId("toolbar-issues-warnings")).toHaveText("5");
  });

  test("AC-P2-T06-3: edge-cases.postgres.sql rows, in order", async ({ page }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expectRows(page, EDGE_CASES_SQL);
  });

  test("AC-P2-T06-3: pgdump.postgres.sql is warnings only and leaves the panel closed", async ({
    page,
  }) => {
    await importFixture(page, "sql/pgdump.postgres.sql");
    await expect(page.getByTestId("issues-panel")).toHaveCount(0);
    await expect(page.getByTestId("toolbar-issues")).toHaveAttribute(
      "aria-label",
      "Issues and health checks: 2 warnings",
    );
    await page.getByTestId("toolbar-issues").click();
    await expectRows(page, PGDUMP_SQL);
  });

  test("AC-P2-T06-3: the All / Errors / Warnings chips filter the rows", async ({ page }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(page.getByTestId("issues-filter-all")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("issues-filter-errors").click();
    await expect(page.getByTestId("issues-filter-errors")).toHaveAttribute("aria-pressed", "true");
    await expect(rows(page)).toHaveCount(1);
    await page.getByTestId("issues-filter-warnings").click();
    await expect(rows(page)).toHaveCount(5);
    await page.getByTestId("issues-filter-all").click();
    await expect(rows(page)).toHaveCount(6);
  });

  test("AC-P2-T06-4: a row with a line toggles its source excerpt (click, Enter, Space)", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    for (const [i, want] of EDGE_CASES_SQL.entries()) {
      if (!want.excerpt) continue;
      const toggle = rows(page).nth(i).getByTestId("issue-toggle");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const lines = rows(page).nth(i).getByTestId("issue-excerpt").locator("pre > div");
      await expect(lines.first().locator("span").first()).toHaveText(String(want.excerpt[0]));
      await expect(lines.last().locator("span").first()).toHaveText(String(want.excerpt[1]));
      await expect(rows(page).nth(i).getByTestId("issue-excerpt-current")).toHaveCount(1);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
    const first = rows(page).first().getByTestId("issue-toggle");
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("aria-expanded", "false");
  });

  test("AC-P2-T06-5: Show table selects the table and clears a filter that hides it", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await page.getByTestId("table-filter").fill("zzz-no-match");
    await expect(page.getByTestId("table-list-empty")).toBeVisible();
    await rows(page).first().getByTestId("issue-show-table").click();
    await expect(page.getByTestId("table-filter")).toHaveValue("");
    await expect(tableNode(page, "users")).toHaveAttribute("data-selected", "true");

    await rows(page).nth(1).getByTestId("issue-show-table").click();
    await expect(tableNode(page, "billing.invoices")).toHaveAttribute("data-selected", "true");
    await expect(tableNode(page, "users")).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("inspector-title")).toContainText("invoices");
  });

  test("AC-P2-T06-2: Escape does not close the panel; the toolbar button does", async ({
    page,
  }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await page.getByTestId("issues-panel").focus();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    await page.getByTestId("issues-close").click();
    await expect(page.getByTestId("issues-panel")).toHaveCount(0);
    await expect(page.getByTestId("toolbar-issues")).toHaveAttribute("aria-pressed", "false");
  });

  test("AC-P2-T06-2: a clean import shows the empty panel and keeps it open", async ({ page }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(page.getByTestId("issues-panel")).toBeVisible();
    await importFixture(page, "sql/shop.mysql.sql");
    await expect(page.getByTestId("issues-empty")).toHaveText("No issues for this schema.");
    await expect(page.getByTestId("toolbar-issues")).toBeEnabled();
  });

  test("AC-P2-T06-10: severity is also conveyed as text for screen readers", async ({ page }) => {
    await importFixture(page, "sql/edge-cases.postgres.sql");
    await expect(rows(page).first()).toContainText("Error");
    await expect(rows(page).nth(1)).toContainText("Warning");
  });
});
