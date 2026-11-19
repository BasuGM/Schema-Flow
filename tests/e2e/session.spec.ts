import { expect, test, type Page } from "@playwright/test";
import { clickTable, importFixture, listItem, schemaName, tableNode } from "./support/app";

// P3-T06 (ADR-030): a reload brings back the last import, its pan and zoom and its selection.
// AC-P3-T06-1…6. Plain "/" restores; `?sample=` never does (openSample in support/app uses it).

const FIXTURE = "sql/blog.sqlite.sql";
const SAMPLE_TABLE = "table-node-orders";

interface Stored {
  v: number;
  text: string;
  format: string;
  name: string;
  savedAt: number;
}

/** The IndexedDB record `schemaflow` → `session` → `current`, or null. */
async function readRecord(page: Page): Promise<Stored | null> {
  return page.evaluate(
    () =>
      new Promise<Stored | null>((resolve) => {
        const open = indexedDB.open("schemaflow");
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("session")) return resolve(null);
          const get = db.transaction("session").objectStore("session").get("current");
          get.onsuccess = () => resolve((get.result as Stored | undefined) ?? null);
          get.onerror = () => resolve(null);
        };
      }),
  );
}

async function viewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  return page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
}

async function panAndZoom(page: Page): Promise<void> {
  const pane = page.locator(".react-flow__pane");
  const box = await pane.boundingBox();
  if (!box) throw new Error("no pane");
  const x = box.x + box.width - 80;
  const y = box.y + box.height - 80;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 70, y - 40, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(x - 70, y - 40);
  await page.mouse.wheel(0, -240);
}

/** Waits until the session is written, and optionally the selection and the viewport. */
async function waitForSaved(page: Page, also: ("ui" | "viewport")[] = []): Promise<void> {
  await expect.poll(() => readRecord(page)).not.toBeNull();
  const needles = also.map((k) => (k === "ui" ? "session-ui" : "viewport"));
  await expect
    .poll(() =>
      page.evaluate((list) => {
        const all = JSON.stringify(localStorage);
        return list.every((n) => all.includes(n));
      }, needles),
    )
    .toBe(true);
}

async function importBlog(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
  await importFixture(page, FIXTURE);
}

test("AC-P3-T06-1…3: a reload restores the import, its viewport and its selection", async ({
  page,
}) => {
  await importBlog(page);
  const name = await schemaName(page).innerText();
  const tableCount = await page.getByTestId("toolbar-schema-name").textContent();
  await clickTable(page, "posts");
  await page.getByTestId("inspector-tab-relations").click();
  await panAndZoom(page);
  await page.waitForTimeout(600); // the wheel zoom settles, then the viewport is saved
  const before = await viewport(page);
  await waitForSaved(page, ["ui", "viewport"]);

  await page.goto("/");
  await expect(tableNode(page, "posts")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("canvas-restoring")).toHaveCount(0);
  await expect(schemaName(page)).toHaveText(name);
  await expect(page.getByTestId("toolbar-schema-name")).toHaveText(tableCount ?? "");
  await expect(page.getByTestId("inspector-tab-relations")).toHaveAttribute("data-state", "active");
  const after = await viewport(page);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.zoom - before.zoom)).toBeLessThan(0.001);
  // Restoring never moves focus.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
});

test("AC-P3-T06-2: a new import still fits the view", async ({ page }) => {
  await importBlog(page);
  await panAndZoom(page);
  await page.waitForTimeout(500);
  await page.goto("/");
  await expect(tableNode(page, "posts")).toBeVisible();
  const restored = await viewport(page);
  await importFixture(page, "sql/shop.mysql.sql");
  await expect.poll(async () => (await viewport(page)).zoom).not.toBeCloseTo(restored.zoom, 3);
});

test("AC-P3-T06-4: ?sample= shows the sample and leaves the session alone", async ({ page }) => {
  await importBlog(page);
  await waitForSaved(page);
  const record = await readRecord(page);
  await page.goto("/?sample=synthetic&tables=10&seed=2");
  await expect(page.getByTestId("toolbar-schema-name")).toContainText("10 tables");
  expect(await readRecord(page)).toEqual(record);
  await page.goto("/");
  await expect(tableNode(page, "posts")).toBeVisible();
});

test("AC-P3-T06-7: the stored record has the documented fields", async ({ page }) => {
  await importBlog(page);
  await expect.poll(() => readRecord(page)).not.toBeNull();
  const record = await readRecord(page);
  expect(Object.keys(record ?? {}).sort()).toEqual(["format", "name", "savedAt", "text", "v"]);
  expect(record).toMatchObject({ v: 1, format: "sqlite" });
  expect(record?.text).toContain("CREATE TABLE authors");
});

test.describe("Clear saved data", () => {
  async function clearFromSettings(page: Page): Promise<void> {
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-clear-data").click();
    await expect(page.getByTestId("clear-data-dialog")).toBeVisible();
    await page.getByTestId("clear-data-confirm").click();
    await expect(page.getByTestId("clear-data-dialog")).toBeHidden();
  }

  test("AC-P3-T06-5: wipes the session, shows the sample and stays cleared after a reload", async ({
    page,
  }) => {
    await importBlog(page);
    await waitForSaved(page);
    await clearFromSettings(page);
    await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
    await expect(page.getByTestId("clear-data-status")).toHaveText("Saved data cleared");
    await expect.poll(() => readRecord(page)).toBeNull();
    await page.goto("/");
    await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
    expect(await readRecord(page)).toBeNull();
  });

  test("AC-P3-T06-5: Escape cancels and focus returns to Settings", async ({ page }) => {
    await importBlog(page);
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-clear-data").click();
    await expect(page.getByTestId("clear-data-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("clear-data-dialog")).toBeHidden();
    await expect(page.getByTestId("toolbar-settings")).toBeFocused();
    expect(await readRecord(page)).not.toBeNull();
  });

  test("amendment 1: clearing right after a selection leaves nothing behind", async ({ page }) => {
    await importBlog(page);
    await waitForSaved(page);
    await listItem(page, "posts").click();
    await clearFromSettings(page); // well inside the 300 ms selection debounce
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => localStorage.getItem("schemaflow:session-ui:v1"))).toBeNull();
    expect(await readRecord(page)).toBeNull();
    await page.goto("/");
    await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
  });

  test("amendment 1: another tab stops saving after a clear", async ({ context }) => {
    const first = await context.newPage();
    await importBlog(first);
    await waitForSaved(first);
    const second = await context.newPage();
    await second.goto("/");
    await expect(tableNode(second, "posts")).toBeVisible();
    await clearFromSettings(first);
    await expect(first.getByTestId(SAMPLE_TABLE)).toBeVisible();
    // The second tab still shows the old import; selecting must not write the session back.
    await second.waitForTimeout(300);
    await clickTable(second, "authors");
    await second.waitForTimeout(800);
    expect(
      await second.evaluate(() => localStorage.getItem("schemaflow:session-ui:v1")),
    ).toBeNull();
    expect(await readRecord(second)).toBeNull();
  });
});

test.describe("unavailable storage (amendment 4)", () => {
  const variants = {
    "indexedDB.open throws": () => {
      IDBFactory.prototype.open = () => {
        throw new Error("blocked");
      };
    },
    "indexedDB.open never answers": () => {
      IDBFactory.prototype.open = () => ({}) as IDBOpenDBRequest;
    },
  };

  for (const [label, script] of Object.entries(variants)) {
    test(`${label}: the sample shows, import works, a reload shows the sample`, async ({
      page,
    }) => {
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(e.message));
      page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
      await page.addInitScript(script);
      await page.goto("/");
      await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
      await importFixture(page, FIXTURE);
      await expect(tableNode(page, "posts")).toBeVisible();
      await page.goto("/");
      await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
      expect(problems).toEqual([]);
    });
  }
});

test.describe("phone (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("AC-P3-T06-6: the selection comes back without opening a sheet over the canvas", async ({
    page,
  }) => {
    await importBlog(page);
    await clickTable(page, "posts");
    await waitForSaved(page, ["ui"]);
    await page.goto("/");
    await expect(tableNode(page, "posts")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("schema-canvas")).toBeVisible();
    await expect(page.getByTestId("inspector-sheet")).toHaveCount(0);
    await expect(page.getByTestId("table-list-sheet")).toHaveCount(0);
  });

  test("AC-P3-T06-6: More → Clear saved data works without horizontal overflow", async ({
    page,
  }) => {
    await importBlog(page);
    await waitForSaved(page);
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId("more-clear-data").click();
    await expect(page.getByTestId("clear-data-dialog")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByTestId("clear-data-confirm").click();
    await expect(page.getByTestId(SAMPLE_TABLE)).toBeVisible();
  });
});
