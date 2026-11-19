import { expect, test, type Page } from "@playwright/test";
import {
  chooseFile,
  dropFile,
  fixtureText,
  openImport,
  openSample,
  schemaName,
  pasteText,
} from "./support/app";

interface Expected {
  file: string;
  status: string;
  counts: string;
  issues: string;
  button: string;
  name: string;
  pastedName: string;
}

const SQL = "Pasted SQL";
const PRISMA = "Pasted Prisma schema";

// AC-P2-T05 table, exact strings.
const FIXTURES: Expected[] = [
  ex(
    "sql/blog.sqlite.sql",
    "SQLite SQL",
    "4 tables · 12 columns · 3 relationships",
    "1 warning",
    "Import 4 tables",
    "blog.sqlite",
    SQL,
  ),
  ex(
    "sql/bom.postgres.sql",
    "PostgreSQL SQL",
    "2 tables · 3 columns · 1 relationship",
    "1 warning",
    "Import 2 tables",
    "bom.postgres",
    SQL,
  ),
  ex(
    "sql/ecommerce.postgres.sql",
    "PostgreSQL SQL",
    "12 tables · 71 columns · 13 relationships · 2 enums",
    "No issues",
    "Import 12 tables",
    "ecommerce.postgres",
    SQL,
  ),
  ex(
    "sql/edge-cases.postgres.sql",
    "PostgreSQL SQL",
    "3 tables · 10 columns · 2 relationships",
    "1 error · 5 warnings",
    "Import 3 tables (1 error)",
    "edge-cases.postgres",
    SQL,
  ),
  ex(
    "sql/pgdump.postgres.sql",
    "PostgreSQL SQL",
    "3 tables · 14 columns · 3 relationships · 1 enum",
    "2 warnings",
    "Import 3 tables",
    "pgdump.postgres",
    SQL,
  ),
  ex(
    "sql/shop.mysql.sql",
    "MySQL SQL",
    "5 tables · 18 columns · 4 relationships",
    "No issues",
    "Import 5 tables",
    "shop.mysql",
    SQL,
  ),
  ex(
    "sql/typeless.sqlite.sql",
    "PostgreSQL SQL",
    "2 tables · 6 columns · 1 relationship",
    "4 warnings",
    "Import 2 tables",
    "typeless.sqlite",
    SQL,
  ),
  ex(
    "sql/utf16le.postgres.sql",
    "PostgreSQL SQL",
    "2 tables · 4 columns · 1 relationship",
    "No issues",
    "Import 2 tables",
    "utf16le.postgres",
    SQL,
  ),
  ex(
    "prisma/blog.prisma",
    "Prisma schema",
    "9 tables · 31 columns · 11 relationships · 1 enum",
    "1 warning",
    "Import 9 tables",
    "blog",
    PRISMA,
  ),
  ex(
    "prisma/edge-cases.prisma",
    "Prisma schema",
    "3 tables · 8 columns · 1 relationship",
    "1 error · 8 warnings",
    "Import 3 tables (1 error)",
    "edge-cases",
    PRISMA,
  ),
  ex(
    "prisma/shop.mysql.prisma",
    "Prisma schema",
    "4 tables · 14 columns · 3 relationships · 1 enum",
    "No issues",
    "Import 4 tables",
    "shop.mysql",
    PRISMA,
  ),
];

function ex(
  file: string,
  format: string,
  counts: string,
  issues: string,
  button: string,
  name: string,
  pastedName: string,
): Expected {
  return {
    file,
    status: `Parsed as ${format}`,
    counts,
    issues,
    button,
    name,
    pastedName,
  };
}

async function expectPreview(page: Page, e: Expected): Promise<void> {
  await expect(page.getByTestId("import-status")).toHaveText(e.status);
  await expect(page.getByTestId("import-counts")).toHaveText(e.counts);
  await expect(page.getByTestId("import-issue-summary")).toHaveText(e.issues);
  await expect(page.getByTestId("import-confirm")).toHaveText(e.button);
}

test.describe("import dialog", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P2-T05-1: opens with focus in the textarea and the documented copy", async ({
    page,
  }) => {
    await openImport(page);
    await expect(page.getByTestId("import-textarea")).toBeFocused();
    const dialog = page.getByTestId("import-dialog");
    await expect(dialog).toContainText("Parsed in your browser. Nothing is uploaded or executed.");
    await expect(page.getByTestId("import-replace-note")).toContainText(
      "This replaces the current diagram.",
    );
    await expect(page.getByTestId("import-file-input")).not.toHaveAttribute("accept", /.+/);
  });

  for (const e of FIXTURES) {
    test(`AC-P2-T05-2 file: ${e.file}`, async ({ page }) => {
      await openImport(page);
      await chooseFile(page, e.file);
      await expect(page.getByTestId("import-file-card")).toBeVisible();
      await expect(page.getByTestId("import-textarea")).toHaveCount(0);
      await expectPreview(page, e);
      await page.getByTestId("import-confirm").click();
      await expect(page.getByTestId("import-dialog")).toBeHidden();
      await expect(schemaName(page)).toHaveText(e.name);
    });

    test(`AC-P2-T05-2 paste: ${e.file}`, async ({ page }) => {
      test.skip(e.file === "sql/utf16le.postgres.sql", "UTF-16 only exists as a file (BOM)");
      await openImport(page);
      await pasteText(page, fixtureText(e.file));
      await expectPreview(page, e);
      await page.getByTestId("import-confirm").click();
      await expect(page.getByTestId("import-dialog")).toBeHidden();
      await expect(schemaName(page)).toHaveText(e.pastedName);
    });

    test(`AC-P2-T05-2 drop: ${e.file}`, async ({ page }) => {
      await openImport(page);
      await dropFile(page, e.file);
      await expect(page.getByTestId("import-file-card")).toBeVisible();
      await expectPreview(page, e);
    });
  }

  test("AC-P2-T05-3: changing Format re-parses; Auto shows the detected format", async ({
    page,
  }) => {
    await openImport(page);
    await chooseFile(page, "sql/typeless.sqlite.sql");
    const format = page.getByTestId("import-format");
    await expect(format.locator("option").first()).toHaveText("Auto (detected: PostgreSQL SQL)");
    await format.selectOption({ label: "SQLite" });
    await expect(page.getByTestId("import-status")).toHaveText("Parsed as SQLite SQL");
    await expect(page.getByTestId("import-counts")).toHaveText(
      "2 tables · 6 columns · 1 relationship",
    );
  });

  test("AC-P2-T05-5: Import stays disabled when nothing was parsed", async ({ page }) => {
    await openImport(page);
    await pasteText(page, "this is not a schema");
    await expect(page.getByTestId("import-status")).not.toHaveText(/^Parsed as/);
    await expect(page.getByTestId("import-confirm")).toBeDisabled();
  });

  test("AC-P2-T05-6: importing replaces the diagram and resets the dialog", async ({ page }) => {
    await openImport(page);
    await chooseFile(page, "sql/shop.mysql.sql");
    await page.getByTestId("import-confirm").click();
    await expect(page.getByTestId("import-dialog")).toBeHidden();
    await expect(page.getByTestId("table-node-orders")).toBeVisible();
    await expect(schemaName(page)).toHaveText("shop.mysql");
    await expect(page.getByTestId("table-list-count")).toContainText("5");
    await openImport(page);
    await expect(page.getByTestId("import-textarea")).toHaveValue("");
  });

  test("AC-P2-T05-7: Escape keeps the draft file for the session", async ({ page }) => {
    await openImport(page);
    await chooseFile(page, "prisma/blog.prisma");
    await expect(page.getByTestId("import-status")).toHaveText("Parsed as Prisma schema");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("import-dialog")).toBeHidden();
    await openImport(page);
    await expect(page.getByTestId("import-file-card")).toBeVisible();
    await expect(page.getByTestId("import-counts")).toHaveText(
      "9 tables · 31 columns · 11 relationships · 1 enum",
    );
  });

  test("AC-P2-T05-4: a binary file is rejected and Import stays disabled", async ({ page }) => {
    await openImport(page);
    const chooser = page.waitForEvent("filechooser");
    await page.getByText("Choose file…").click();
    await (
      await chooser
    ).setFiles({
      name: "dump.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
    });
    await expect(page.getByTestId("import-preview")).toContainText(
      "This looks like a binary or compressed file.",
    );
    await expect(page.getByTestId("import-confirm")).toBeDisabled();
  });
});

// AC-P2-T10-1: real-world fixtures, counts from tests/fixtures/real/SOURCES.md (preview only).
const REAL: { file: string; status: string; counts: string; issues: string }[] = [
  {
    file: "real/sakila-schema.mysql.sql",
    status: "Parsed as MySQL SQL",
    counts: "16 tables · 90 columns · 22 relationships",
    issues: "8 warnings",
  },
  {
    file: "real/mysqldump-180.mysql.sql",
    status: "Parsed as MySQL SQL",
    counts: "180 tables · 1,625 columns · 306 relationships",
    issues: "1 warning",
  },
  {
    file: "real/large-200.prisma",
    status: "Parsed as Prisma schema",
    counts: "220 tables · 1,692 columns · 354 relationships · 10 enums",
    issues: "No issues",
  },
  {
    file: "real/gitlab-structure.postgres.sql",
    status: "Parsed as PostgreSQL SQL",
    counts: "992 tables · 9,982 columns · 1,720 relationships",
    issues: "140 warnings",
  },
];

test.describe("real-world fixtures", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  for (const r of REAL) {
    test(`AC-P2-T10-1: ${r.file}`, async ({ page }) => {
      test.setTimeout(90_000);
      await openImport(page);
      await chooseFile(page, r.file);
      await expect(page.getByTestId("import-status")).toHaveText(r.status, { timeout: 30_000 });
      await expect(page.getByTestId("import-counts")).toHaveText(r.counts);
      await expect(page.getByTestId("import-issue-summary")).toHaveText(r.issues);
    });
  }
});
