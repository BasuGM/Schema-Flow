import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openImport, openSample, pasteText, importDialog } from "./support/app";

// P3-T03: image export. AC-P3-T03-1…6.

const dialog = (page: Page) => page.getByTestId("export-image-dialog");

async function openFromSettings(page: Page): Promise<void> {
  await page.getByTestId("toolbar-settings").click();
  await page.getByTestId("settings-export-image").click();
  await expect(dialog(page)).toBeVisible();
}

/** Clicks Download and returns the saved file's bytes and suggested name. */
async function download(page: Page): Promise<{ bytes: Buffer; name: string }> {
  const [saved] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-download").click(),
  ]);
  const path = await saved.path();
  await expect(dialog(page)).toBeHidden();
  return { bytes: readFileSync(path), name: saved.suggestedFilename() };
}

/** Picks a radio by clicking its label, like a user (the input itself is visually hidden). */
const choose = (page: Page, testId: string) => page.getByTestId(testId).locator("xpath=..").click();

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });
const PNG_SIGNATURE = "89504e470d0a1a0a";

async function sizeLine(page: Page, id: "export-size" | "export-output") {
  const el = page.getByTestId(id);
  return {
    width: Number(await el.getAttribute("data-width")),
    height: Number(await el.getAttribute("data-height")),
  };
}

async function exportSvg(page: Page, theme?: "light" | "dark"): Promise<string> {
  await openFromSettings(page);
  await choose(page, "export-format-svg");
  if (theme) await choose(page, `export-theme-${theme}`);
  return (await download(page)).bytes.toString("utf8");
}

test.describe("export image", () => {
  test.beforeEach(async ({ page }) => {
    await openSample(page);
  });

  test("AC-P3-T03-2: the SVG has every table and relationship, named after the schema", async ({
    page,
  }) => {
    const tables = await page.locator(".react-flow__node").count();
    const edges = await page.locator(".react-flow__edge").count();
    await openFromSettings(page);
    await choose(page, "export-format-svg");
    const { bytes, name } = await download(page);
    const svg = bytes.toString("utf8");
    expect(name).toMatch(/^[a-z0-9-]+\.svg$/);
    expect(count(svg, /data-table-id=/g)).toBe(tables);
    expect(count(svg, /data-relationship-id=/g)).toBe(edges);
    expect(svg).toContain("<svg");
  });

  test("AC-P3-T03-3: the PNG is valid at the size line (1×) and twice that at 2×", async ({
    page,
  }) => {
    await openFromSettings(page);
    const diagram = await sizeLine(page, "export-size");
    await choose(page, "export-scale-1");
    const one = await download(page);
    expect(one.bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
    expect(pngSize(one.bytes)).toEqual(diagram);

    await openFromSettings(page);
    await expect(page.getByTestId("export-scale-2")).toBeChecked();
    const output = await sizeLine(page, "export-output");
    const two = await download(page);
    const { width, height } = pngSize(two.bytes);
    expect(Math.abs(width - 2 * diagram.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(height - 2 * diagram.height)).toBeLessThanOrEqual(1);
    expect({ width, height }).toEqual(output);
  });

  test("AC-P3-T03-2: Keys on all tables leaves only key rows in the SVG", async ({ page }) => {
    await page.getByTestId("toolbar-settings").click();
    await page.getByTestId("settings-collapse-all-keys").click();
    await expect(page.getByTestId("settings-collapse-all-keys")).toHaveCount(0);
    const svg = await exportSvg(page);
    expect(count(svg, /data-key="(pk|fk)"/g)).toBeGreaterThan(0);
    expect(count(svg, /data-key="none"/g)).toBe(0);
    expect(count(svg, /data-mode="keys"/g)).toBeGreaterThan(0);
  });

  test("AC-P3-T03-3: light and dark exports differ in background, card and text colours", async ({
    page,
  }) => {
    const light = await exportSvg(page, "light");
    const dark = await exportSvg(page, "dark");
    const colours = (svg: string) => ({
      canvas: /<\/title><rect[^>]*?fill="([^"]+)"/.exec(svg)?.[1],
      card: /data-table-id[^>]*><rect[^>]*?fill="([^"]+)"/.exec(svg)?.[1],
      text: /<text[^>]*?fill="([^"]+)"/.exec(svg)?.[1],
    });
    const l = colours(light);
    const d = colours(dark);
    for (const key of ["canvas", "card", "text"] as const) {
      expect(l[key], `light ${key}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(d[key], `dark ${key}`).toBeTruthy();
      expect(d[key]).not.toBe(l[key]);
    }
    // The dark border keeps its alpha.
    expect(dark).toMatch(/stroke="rgba\(\d+,\d+,\d+,0\.\d+\)"/);
  });

  test("AC-P3-T03-2/3: a table name with <, &, quotes and a control character exports to SVG and PNG", async ({
    page,
  }) => {
    await openImport(page);
    await pasteText(page, 'CREATE TABLE "a<b&\u0001c" (id int PRIMARY KEY);');
    await page.getByTestId("import-confirm").click();
    await expect(importDialog(page)).toBeHidden();
    const svg = await exportSvg(page);
    expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(svg).toContain("a&lt;b&amp;c");
    await openFromSettings(page);
    await choose(page, "export-scale-1");
    const png = await download(page);
    expect(png.bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
  });

  test("AC-P3-T03-1/6: Settings → dialog → Escape returns focus to Settings; no overflow", async ({
    page,
  }) => {
    await openFromSettings(page);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId("toolbar-settings")).toBeFocused();
  });

  test("AC-P3-T03-6: a radio shows a visible focus ring on its label", async ({ page }) => {
    await openFromSettings(page);
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const label = document.activeElement?.closest("label");
      return label ? getComputedStyle(label).boxShadow : "none";
    });
    expect(ring).not.toBe("none");
  });
});

test.describe("export image on a phone (390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("AC-P3-T03-1/6: More → dialog fits, no overflow, Escape returns focus to More", async ({
    page,
  }) => {
    await openSample(page);
    await page.getByTestId("toolbar-more").click();
    await page.getByTestId("more-export-image").click();
    await expect(dialog(page)).toBeVisible();
    const overflow = await page.evaluate(() => {
      const d = document.querySelector<HTMLElement>('[data-testid="export-image-dialog"]')!;
      return {
        dialog: d.scrollWidth - d.clientWidth,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(overflow.dialog).toBe(0);
    expect(overflow.page).toBe(0);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId("toolbar-more")).toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });
});
