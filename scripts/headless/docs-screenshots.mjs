// Regenerates docs/images/*.png from fixtures only (DOC-01 commit 7).
//
// Usage (needs a production build served on a free port):
//   npm run build && python3 -m http.server 3100 --directory out &
//   node scripts/headless/docs-screenshots.mjs [baseUrl]   (default http://localhost:3100)
// Waits on data-testid elements, never on fixed timeouts. One browser at a time.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { checkLoad, cleanupOnExit } from "./perf-guard.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const out = resolve(import.meta.dirname, "../../docs/images");
const fixtures = resolve(import.meta.dirname, "../../tests/fixtures");
mkdirSync(out, { recursive: true });
checkLoad();

const browser = await chromium.launch();
cleanupOnExit(() => browser.close());
const T = { timeout: 60_000 };

async function newPage(scheme, viewport) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  return page;
}

async function openSample(page) {
  await page.goto(`${base}/?sample=ecommerce`);
  await page.getByTestId("table-node-orders").waitFor(T);
}

async function importFixture(page, relative, { confirm = true } = {}) {
  await page.getByTestId("toolbar-import").click();
  await page.getByTestId("import-dialog").waitFor(T);
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Choose file…").click();
  await (await chooser).setFiles(resolve(fixtures, relative));
  await page.getByTestId("import-confirm").waitFor(T);
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="import-confirm"]')?.hasAttribute("disabled"),
    null,
    T,
  );
  if (confirm) {
    await page.getByTestId("import-confirm").click();
    await page.getByTestId("import-dialog").waitFor({ state: "hidden", ...T });
  }
}

const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const desktop = { width: 1280, height: 800 };

// Hero, light and dark: ecommerce sample with orders selected.
for (const scheme of ["light", "dark"]) {
  const page = await newPage(scheme, desktop);
  await openSample(page);
  await page.getByTestId("table-node-orders").click({ position: { x: 20, y: 12 } });
  await page.locator('[data-testid="table-node-orders"][data-selected="true"]').waitFor(T);
  await page.getByTestId("inspector-title").waitFor(T);
  await shot(page, `hero-${scheme}`);
  await page.context().close();
}

// Import issues: edge-cases fixture, confirm, open the Issues panel.
{
  const page = await newPage("light", desktop);
  await openSample(page);
  await importFixture(page, "sql/edge-cases.postgres.sql");
  // The panel may already be open after an import that has issues; the toolbar button toggles it.
  if (!(await page.getByTestId("issues-panel").isVisible())) {
    await page.getByTestId("toolbar-issues").click();
  }
  await page.getByTestId("issues-panel").waitFor(T);
  await page.getByTestId("issue-row").first().waitFor(T);
  await shot(page, "import-issues");
  await page.context().close();
}

// Health.
{
  const page = await newPage("light", desktop);
  await openSample(page);
  await importFixture(page, "sql/health.postgres.sql");
  if (!(await page.getByTestId("health-panel").isVisible())) {
    await page.getByTestId("toolbar-issues").click();
  }
  await page.getByTestId("health-panel").waitFor(T);
  await page.getByTestId("health-list").waitFor(T);
  await shot(page, "health");
  await page.context().close();
}

// Path finder: reviews → coupons on the sample.
{
  const page = await newPage("light", desktop);
  await openSample(page);
  await page.getByTestId("table-node-reviews").click({ position: { x: 20, y: 12 } });
  await page.getByTestId("inspector-tab-path").click();
  await page.getByTestId("path-target-input").fill("coupons");
  await page.getByTestId("path-target-option").first().click();
  await page.getByTestId("path-result").waitFor(T);
  await page.locator('[data-testid^="table-node-"][data-on-path="true"]').first().waitFor(T);
  await shot(page, "path-finder");
  await page.context().close();
}

// Subject areas: saas-300 with the billing area hidden.
{
  const page = await newPage("light", desktop);
  await openSample(page);
  await importFixture(page, "synthetic/saas-300.postgres.sql");
  await page.getByTestId("area-filter").click();
  await page.getByTestId("area-row-billing").waitFor(T);
  await page.getByTestId("area-toggle-billing").uncheck();
  await page.getByTestId("area-filter-notice").waitFor(T);
  await shot(page, "subject-areas");
  await page.context().close();
}

// Phone, 390×844.
{
  const page = await newPage("light", { width: 390, height: 844 });
  await openSample(page);
  await shot(page, "phone");
  await page.context().close();
}

await browser.close();
console.log("wrote docs/images");
