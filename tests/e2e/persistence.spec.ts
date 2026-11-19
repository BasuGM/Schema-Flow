import { expect, test, type Page } from "@playwright/test";
import { importFixture, openSample } from "./support/app";

// P3-T01: layout and the neighbourhood depth survive a reload. AC-P3-T01-1…5.

type Pos = { x: number; y: number };

/** The sample's orders table (ids are schema-qualified). */
const ORDERS = "public.orders";

/** Flow position of a table node, rounded like the saved one (independent of pan and zoom). */
async function flowPosition(page: Page, tableId: string): Promise<Pos> {
  return page.evaluate((id) => {
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el?.style.transform ?? "");
    if (!m) throw new Error(`no transform for ${id}`);
    return { x: Math.round(Number(m[1])), y: Math.round(Number(m[2])) };
  }, tableId);
}

const firstTableId = (page: Page) =>
  page.locator(".react-flow__node").first().getAttribute("data-id") as Promise<string>;

/** A point on the table that is really on top (the side panels can cover part of the canvas). */
async function grabPoint(page: Page, tableId: string): Promise<Pos> {
  const point = await page.evaluate((id) => {
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    for (let dy = 8; dy < r.height; dy += 16)
      for (let dx = 8; dx < r.width; dx += 16) {
        const x = r.left + dx;
        const y = r.top + dy;
        if (el.contains(document.elementFromPoint(x, y))) return { x, y };
      }
    return null;
  }, tableId);
  if (!point) throw new Error(`${tableId} has no visible point`);
  return point;
}

/** Drags a table by (dx, dy) screen pixels with the real mouse. */
async function dragTable(page: Page, tableId: string, dx: number, dy: number): Promise<void> {
  // The fit-view animation moves every node on screen for a moment after load.
  const node = page.locator(`.react-flow__node[data-id="${tableId}"]`);
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await node.boundingBox());
      const settled = box === last;
      last = box;
      return settled;
    })
    .toBe(true);
  const { x, y } = await grabPoint(page, tableId);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - dx / 2, y - dy / 2, { steps: 5 });
  await page.mouse.move(x - dx, y - dy, { steps: 5 });
  await page.mouse.up();
}

/** Waits for the debounced save to reach localStorage, then reloads. */
async function reloadAfterSave(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Object.keys(localStorage).some((k) => k.includes("layout:v1"))))
    .toBe(true);
  await page.reload();
}

test("AC-P3-T01-1: a dragged table keeps its position after a reload", async ({ page }) => {
  await openSample(page);
  const before = await flowPosition(page, ORDERS);
  await dragTable(page, ORDERS, 160, 120);
  const moved = await flowPosition(page, ORDERS);
  expect(moved).not.toEqual(before);
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(localStorage).includes("positions")))
    .toBe(true);
  await page.waitForTimeout(500);
  await reloadAfterSave(page);
  await expect(page.getByTestId("table-node-orders")).toBeVisible();
  expect(await flowPosition(page, ORDERS)).toEqual(moved);
});

test("AC-P3-T01-2: re-importing the same file after a reload restores its positions", async ({
  page,
}) => {
  await openSample(page);
  await importFixture(page, "sql/blog.sqlite.sql");
  const id = await firstTableId(page);
  await dragTable(page, id, 140, 90);
  const moved = await flowPosition(page, id);
  await page.waitForTimeout(500);
  await reloadAfterSave(page);
  await openSample(page);
  await importFixture(page, "sql/blog.sqlite.sql");
  expect(await flowPosition(page, id)).toEqual(moved);
});

test("AC-P3-T01-3: Layout resets the positions and the reset survives a reload", async ({
  page,
}) => {
  await openSample(page);
  const auto = await flowPosition(page, ORDERS);
  await dragTable(page, ORDERS, 160, 120);
  await page.waitForTimeout(500);
  await page.getByTestId("toolbar-layout").click();
  await expect.poll(() => flowPosition(page, ORDERS)).toEqual(auto);
  await page.waitForTimeout(500);
  await reloadAfterSave(page);
  await expect(page.getByTestId("table-node-orders")).toBeVisible();
  expect(await flowPosition(page, ORDERS)).toEqual(auto);
});

test("AC-P3-T01-4: the neighbourhood depth survives a reload", async ({ page }) => {
  await openSample(page);
  await page.getByTestId("toolbar-settings").click();
  await page.getByTestId("settings-neighbourhood-2").click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("table-node-orders")).toBeVisible();
  await page.getByTestId("toolbar-settings").click();
  await expect(page.getByTestId("settings-neighbourhood-2")).toBeChecked();
});

const BLOCKED: [string, string][] = [
  [
    "the localStorage getter throws",
    `Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });`,
  ],
  ["getItem throws", `Storage.prototype.getItem = () => { throw new Error("blocked"); };`],
  ["setItem throws", `Storage.prototype.setItem = () => { throw new Error("blocked"); };`],
];

for (const [name, script] of BLOCKED) {
  test(`AC-P3-T01-5: the app works with storage blocked (${name})`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning")
        problems.push(`${m.type()}: ${m.text().slice(0, 200)}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
    await page.addInitScript(script);
    await openSample(page);
    const before = await flowPosition(page, ORDERS);
    await dragTable(page, ORDERS, 120, 80);
    expect(await flowPosition(page, ORDERS)).not.toEqual(before);
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-neighbourhood-2").click();
    await page.keyboard.press("Escape");
    await page.getByTestId("toolbar-layout").click();
    await expect(page.getByTestId("table-node-orders")).toBeVisible();
    expect(problems).toEqual([]);
  });
}
