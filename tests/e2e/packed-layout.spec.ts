import { expect, test, type Page } from "@playwright/test";
import { importFixture, listItem, openSample } from "./support/app";

// P3-T07 (ADR-031): packed layout and canvas overview. AC-P3-T07-1…8.
const GITLAB = "real/gitlab-structure.postgres.sql";
const canvas = (page: Page) => page.getByTestId("schema-canvas");
const overviewCanvas = (page: Page) => page.getByTestId("canvas-overview");

async function viewport(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  return page.locator(".react-flow__viewport").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
}

/** Counts DOM tables that were not on screen before; remembers the peak until the overview shows. */
async function observeNodes(page: Page, known: string[]): Promise<void> {
  await page.evaluate((ids) => {
    const w = window as unknown as { __peak: number; __seen: boolean };
    w.__peak = 0;
    w.__seen = false;
    const check = () => {
      if (w.__seen) return;
      if (
        document.querySelector('[data-testid="schema-canvas"]')?.getAttribute("data-overview") ===
        "true"
      ) {
        w.__seen = true;
        return;
      }
      const n = [...document.querySelectorAll<HTMLElement>(".react-flow__node")].filter(
        (el) => !ids.includes(el.dataset.id ?? ""),
      ).length;
      w.__peak = Math.max(w.__peak, n);
    };
    new MutationObserver(check).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }, known);
}

const peak = (page: Page) => page.evaluate(() => (window as unknown as { __peak: number }).__peak);

async function importGitlab(page: Page): Promise<void> {
  await openSample(page);
  const known = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".react-flow__node")].map((e) => e.dataset.id ?? ""),
  );
  await observeNodes(page, known);
  await importFixture(page, GITLAB);
  await expect(canvas(page)).toHaveAttribute("data-overview", "true", { timeout: 60_000 });
}

/** Wheel-zooms over the pane until `data-overview` equals `want`. */
async function wheelUntil(page: Page, want: "true" | "false", dy: number): Promise<void> {
  const box = (await page.locator(".react-flow__pane").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 80; i++) {
    if ((await canvas(page).getAttribute("data-overview")) === want) return;
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(40);
  }
  throw new Error(`overview never became ${want}`);
}

async function savedLayout(
  page: Page,
): Promise<{ key: string; layout: { positions: Record<string, { x: number; y: number }> } }> {
  return page.evaluate(() => {
    let best: { key: string; size: number } | null = null;
    for (const key of Object.keys(localStorage)) {
      if (!key.includes("layout:v1:")) continue;
      const size = Object.keys(JSON.parse(localStorage.getItem(key)!).positions ?? {}).length;
      if (!best || size > best.size) best = { key, size };
    }
    const key = best!.key;
    return { key, layout: JSON.parse(localStorage.getItem(key)!) };
  });
}

/** Screen point inside the header of a table, from the saved layout and the viewport. */
async function screenPoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  const { layout } = await savedLayout(page);
  const v = await viewport(page);
  const box = (await page.locator(".react-flow__pane").boundingBox())!;
  const p = layout.positions[id]!;
  return {
    x: box.x + p.x * v.zoom + v.x + 140 * v.zoom,
    y: box.y + p.y * v.zoom + v.y + 8 * v.zoom,
  };
}

test.describe("packed layout and canvas overview", () => {
  test.describe.configure({ timeout: 120_000 });

  test("AC-P3-T07-1/3: GitLab imports packed, draws on one canvas and never mounts its tables first", async ({
    page,
  }) => {
    await importGitlab(page);
    expect(await peak(page)).toBeLessThanOrEqual(5);
    await expect(overviewCanvas(page)).toHaveAttribute("data-tables-drawn", "992");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    const v = await viewport(page);
    expect(v.zoom).toBeGreaterThan(0.02);
    expect(v.zoom).toBeLessThan(0.28);
    // The whole diagram fits: the packed bounds are roughly square, not a 3,900 × 242,000 strip.
    const { layout } = await savedLayout(page);
    const xs = Object.values(layout.positions).map((p) => p.x);
    const ys = Object.values(layout.positions).map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(3);
    console.info(`GitLab packed extent ${w} × ${h}, fitted zoom ${v.zoom.toFixed(3)}`);
  });

  test("AC-P3-T07-3: a reload restores GitLab in the overview without mounting its tables", async ({
    page,
  }) => {
    await importGitlab(page);
    await expect.poll(async () => (await savedLayout(page).catch(() => null))?.key).toBeTruthy();
    await page.waitForTimeout(800);
    await page.addInitScript(() => {
      const w = window as unknown as { __peak: number; __seen: boolean };
      w.__peak = 0;
      w.__seen = false;
      new MutationObserver(() => {
        if (w.__seen) return;
        if (
          document.querySelector('[data-testid="schema-canvas"]')?.getAttribute("data-overview") ===
          "true"
        )
          w.__seen = true;
        else w.__peak = Math.max(w.__peak, document.querySelectorAll(".react-flow__node").length);
      }).observe(document, { childList: true, subtree: true, attributes: true });
    });
    await page.goto("/");
    await expect(canvas(page)).toHaveAttribute("data-overview", "true", { timeout: 60_000 });
    expect(await peak(page)).toBeLessThanOrEqual(5);
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("AC-P3-T07-4: click selects a drawn table, pane click clears, the list centres into DOM tables", async ({
    page,
  }) => {
    await importGitlab(page);
    await expect.poll(async () => (await savedLayout(page).catch(() => null))?.key).toBeTruthy();
    const { layout } = await savedLayout(page);
    const box = (await page.locator(".react-flow__pane").boundingBox())!;
    const v = await viewport(page);
    // Tables are only a few pixels wide here, so try tables that are on screen until one is hit.
    const onScreen = Object.keys(layout.positions).filter((k) => {
      const p = layout.positions[k]!;
      const sx = p.x * v.zoom + v.x;
      const sy = p.y * v.zoom + v.y;
      return sx > 20 && sx < box.width - 100 && sy > 20 && sy < box.height - 100;
    });
    let id = "";
    for (const candidate of onScreen.slice(0, 20)) {
      const at = await screenPoint(page, candidate);
      await page.mouse.click(at.x, at.y + 30 * v.zoom);
      const picked = await overviewCanvas(page).getAttribute("data-selected-id");
      if (picked) {
        id = picked;
        break;
      }
    }
    expect(id).not.toBe("");
    await page.keyboard.press("Escape");
    await expect(overviewCanvas(page)).toHaveAttribute("data-selected-id", "");
    await listItem(page, id.replace(/^public\./, "")).scrollIntoViewIfNeeded();
    await listItem(page, id.replace(/^public\./, "")).click();
    await expect(canvas(page)).toHaveAttribute("data-overview", "false");
    await expect(page.locator(`.react-flow__node[data-id="${id}"]`)).toBeVisible();
  });

  test("AC-P3-T07-4/R2: focus moves to the pane when tables hide; the band does not flicker", async ({
    page,
  }) => {
    await importGitlab(page);
    await expect.poll(async () => (await savedLayout(page).catch(() => null))?.key).toBeTruthy();
    const first = await page.evaluate(
      () =>
        (document.querySelector('[data-testid^="table-list-item-"]') as HTMLElement).dataset
          .testid!,
    );
    await page.getByTestId(first).click();
    await expect(canvas(page)).toHaveAttribute("data-overview", "false");
    const node = page.locator('.react-flow__node:has(.table-node[data-selected="true"])');
    await node.focus();
    await wheelUntil(page, "true", 300);
    const active = await page.evaluate(() => document.activeElement?.className ?? "");
    expect(active).toContain("react-flow__pane");
    await page.keyboard.press("Tab");
    const afterTab = await page.evaluate(
      () => document.activeElement?.closest(".react-flow__node") !== null,
    );
    expect(afterTab).toBe(false);

    // Wheel back and forth inside the band: count flips.
    await page.evaluate(() => {
      const w = window as unknown as { __flips: number };
      w.__flips = 0;
      const el = document.querySelector('[data-testid="schema-canvas"]')!;
      new MutationObserver(() => w.__flips++).observe(el, {
        attributes: true,
        attributeFilter: ["data-overview"],
      });
    });
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, i % 2 ? 60 : -60);
      await page.waitForTimeout(60);
    }
    expect(
      await page.evaluate(() => (window as unknown as { __flips: number }).__flips),
    ).toBeLessThanOrEqual(2);
  });

  test("AC-P3-T07-3/R3: the overview rect of a keys-only table is as tall as its DOM node", async ({
    page,
  }) => {
    await importGitlab(page);
    await expect.poll(async () => (await savedLayout(page).catch(() => null))?.key).toBeTruthy();
    const first = await page.evaluate(
      () =>
        (document.querySelector('[data-testid^="table-list-item-"]') as HTMLElement).dataset
          .testid!,
    );
    await page.getByTestId(first).click();
    await expect(canvas(page)).toHaveAttribute("data-overview", "false");
    await page.getByText("Keys", { exact: true }).click();
    // A collapse change re-fits the view, which for GitLab ends in the overview.
    await expect(canvas(page)).toHaveAttribute("data-overview", "true");
    await expect(overviewCanvas(page)).toHaveAttribute("data-selected-height", /\d+/);
    const drawn = Number(await overviewCanvas(page).getAttribute("data-selected-height"));
    await page.getByTestId(first).click();
    await expect(canvas(page)).toHaveAttribute("data-overview", "false");
    const node = page.locator('.react-flow__node:has(.table-node[data-selected="true"])');
    const dom = await node.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(Math.abs(drawn - dom)).toBeLessThanOrEqual(2);
  });

  test("AC-P3-T07-8: the minimap still shows the diagram in the overview", async ({ page }) => {
    await importGitlab(page);
    // The minimap is off by default; turn it on through settings.
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-minimap").click();
    await page.keyboard.press("Escape");
    const mini = page.getByTestId("canvas-overview-minimap");
    await expect(mini).toBeVisible();
    const painted = await mini.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
      return n;
    });
    expect(painted).toBeGreaterThan(500);
  });

  test("AC-P3-T07-6: a saved tall layout survives a reload; Layout packs and saves", async ({
    page,
  }) => {
    await importGitlab(page);
    await expect.poll(async () => (await savedLayout(page).catch(() => null))?.key).toBeTruthy();
    await page.waitForTimeout(800);
    const { key, layout } = await savedLayout(page);
    // Replace it with a tall single-column layout (what Dagre used to produce).
    const ids = Object.keys(layout.positions);
    const tall = Object.fromEntries(ids.map((id, i) => [id, { x: 0, y: i * 400 }]));
    await page.evaluate(
      ([k, value]) => localStorage.setItem(k!, value!),
      [key, JSON.stringify({ ...layout, positions: tall, edgeRoutes: {} })],
    );
    await page.goto("/");
    await expect(canvas(page)).toHaveAttribute("data-overview", "true", { timeout: 60_000 });
    const kept = await savedLayout(page);
    expect(Math.max(...Object.values(kept.layout.positions).map((p) => p.y))).toBeGreaterThan(
      300_000,
    );
    await page.getByTestId("toolbar-layout").click();
    await expect
      .poll(
        async () =>
          Math.max(...Object.values((await savedLayout(page)).layout.positions).map((p) => p.y)),
        { timeout: 60_000 },
      )
      .toBeLessThan(40_000);
  });

  test("AC-P3-T07-2: small and medium schemas never use the overview", async ({ page }) => {
    await openSample(page);
    await expect(canvas(page)).toHaveAttribute("data-overview", "false");
    await importFixture(page, "real/mysqldump-180.mysql.sql");
    await expect(canvas(page)).toHaveAttribute("data-overview", "false");
    await expect(page.getByTestId("canvas-overview")).toHaveCount(0);
  });
});
