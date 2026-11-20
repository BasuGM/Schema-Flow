import { expect, test, type Page } from "@playwright/test";
import { importFixture, openSample } from "./support/app";

// P3-T07 (ADR-031): packed layout for large, shallow schemas, and the large-schema note.
// AC-P3-T07-1, 2, 6 and the note (AC-P3-T07-8).
const GITLAB = "real/gitlab-structure.postgres.sql";

interface Saved {
  key: string;
  positions: Record<string, { x: number; y: number }>;
}

/** The saved layout with the most tables (other tests leave the sample's layout behind). */
async function savedLayout(page: Page): Promise<Saved> {
  return page.evaluate(() => {
    let best: Saved | null = null;
    for (const key of Object.keys(localStorage)) {
      if (!key.includes("layout:v1:")) continue;
      const positions = JSON.parse(localStorage.getItem(key)!).positions ?? {};
      if (!best || Object.keys(positions).length > Object.keys(best.positions).length)
        best = { key, positions };
    }
    return best!;
  });
}

const maxY = (s: Saved) => Math.max(...Object.values(s.positions).map((p) => p.y));

async function importGitlab(page: Page): Promise<void> {
  await openSample(page);
  await importFixture(page, GITLAB);
  await expect(page.getByTestId("toolbar-schema-name")).toContainText("992 tables");
  await expect.poll(async () => Object.keys((await savedLayout(page)).positions).length).toBe(992);
}

test.describe("packed layout", () => {
  test.describe.configure({ timeout: 120_000 });

  test("AC-P3-T07-1: GitLab imports as a roughly square diagram, not one tall strip", async ({
    page,
  }) => {
    await importGitlab(page);
    const { positions } = await savedLayout(page);
    const xs = Object.values(positions).map((p) => p.x);
    const ys = Object.values(positions).map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(3);
  });

  test("AC-P3-T07-6: a saved tall layout is kept on reload; Layout packs it and saves", async ({
    page,
  }) => {
    await importGitlab(page);
    await page.waitForTimeout(800);
    const { key, positions } = await savedLayout(page);
    const tall = Object.fromEntries(
      Object.keys(positions).map((id, i) => [id, { x: 0, y: i * 400 }]),
    );
    await page.evaluate(
      ([k, tallPositions]) => {
        const layout = JSON.parse(localStorage.getItem(k!)!);
        localStorage.setItem(
          k!,
          JSON.stringify({ ...layout, positions: JSON.parse(tallPositions!), edgeRoutes: {} }),
        );
      },
      [key, JSON.stringify(tall)],
    );
    await page.goto("/");
    await expect(page.getByTestId("toolbar-schema-name")).toContainText("992 tables", {
      timeout: 60_000,
    });
    expect(maxY(await savedLayout(page))).toBeGreaterThan(300_000);

    await page.getByTestId("toolbar-layout").click();
    await expect
      .poll(async () => maxY(await savedLayout(page)), { timeout: 60_000 })
      .toBeLessThan(40_000);
  });

  test("AC-P3-T07-2: the 12-table sample and a 180-table schema keep their layout and show no note", async ({
    page,
  }) => {
    await openSample(page);
    await expect(page.getByTestId("large-schema-notice")).toHaveCount(0);
    await importFixture(page, "real/mysqldump-180.mysql.sql");
    await expect(page.getByTestId("toolbar-schema-name")).toContainText("180 tables");
    await expect(page.getByTestId("large-schema-notice")).toHaveCount(0);
  });
});

test("AC-P3-T07-8: a schema over 300 tables shows a dismissible note", async ({ page }) => {
  test.setTimeout(120_000);
  await openSample(page);
  await importFixture(page, GITLAB);
  const note = page.getByTestId("large-schema-notice");
  await expect(note).toBeVisible();
  await expect(note).toContainText(
    "Large schema (992 tables): SchemaFlow is designed for up to about 300 tables, so panning and selecting may be slow.",
  );
  await page.getByTestId("large-schema-notice-dismiss").click();
  await expect(note).toHaveCount(0);
});
