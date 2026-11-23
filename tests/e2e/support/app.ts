import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

const FIXTURE_ROOT = resolve(__dirname, "../../fixtures");

/** Absolute path of a fixture under `tests/fixtures`, e.g. `fixturePath("sql/blog.sqlite.sql")`. */
export function fixturePath(relative: string): string {
  return resolve(FIXTURE_ROOT, relative);
}

export function fixtureText(relative: string): string {
  return readFileSync(fixturePath(relative), "utf8");
}

/**
 * Opens the app on the default e-commerce sample and waits until the canvas shows its tables.
 * `?sample=` skips the session restore (P3-T06), so a test that imported earlier starts clean.
 */
export async function openSample(page: Page): Promise<void> {
  await page.goto("/?sample=ecommerce");
  await expect(page.getByTestId("table-node-orders")).toBeVisible();
}

export const importDialog = (page: Page): Locator => page.getByTestId("import-dialog");

export async function openImport(page: Page): Promise<void> {
  await page.getByTestId("toolbar-import").click();
  await expect(importDialog(page)).toBeVisible();
}

/** Types into the textarea like a paste of the whole text (one input event). */
export async function pasteText(page: Page, text: string): Promise<void> {
  const area = page.getByTestId("import-textarea");
  await area.focus();
  await page.evaluate((value) => {
    const el = document.querySelector<HTMLTextAreaElement>('[data-testid="import-textarea"]');
    if (!el) throw new Error("textarea missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
  }, text);
}

/** Chooses a file through the real file picker (a native chooser event, not a synthetic one). */
export async function chooseFile(page: Page, relative: string): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Choose file…").click();
  await (await chooser).setFiles(fixturePath(relative));
}

/**
 * Drops a file on the dialog. The browser offers no way to start an OS drag from a test, so this
 * dispatches real `dragenter`/`dragover`/`drop` events carrying a `DataTransfer` with the file.
 */
export async function dropFile(page: Page, relative: string): Promise<void> {
  const name = basename(relative);
  const bytes = Array.from(readFileSync(fixturePath(relative)));
  const zone = page.getByTestId("import-dropzone");
  const transfer = await page.evaluateHandle(
    ({ fileName, content }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(content)], fileName));
      return dt;
    },
    { fileName: name, content: bytes },
  );
  for (const type of ["dragenter", "dragover", "drop"]) {
    await zone.dispatchEvent(type, { dataTransfer: transfer });
  }
}

/** Real fixtures (GitLab: ~10 s under load) need far more than the default 10 s expect timeout. */
const IMPORT_TIMEOUT = 60_000;

/**
 * Imports a fixture through the dialog (file picker) and waits for the dialog to close. Tests that
 * import `real/` fixtures also need `test.setTimeout(120_000)`: the config's 30 s caps the test.
 */
export async function importFixture(page: Page, relative: string): Promise<void> {
  await openImport(page);
  await chooseFile(page, relative);
  const confirm = page.getByTestId("import-confirm");
  await expect(confirm).toBeEnabled({ timeout: IMPORT_TIMEOUT });
  await confirm.click();
  await expect(importDialog(page)).toBeHidden({ timeout: IMPORT_TIMEOUT });
}

export const tableNode = (page: Page, name: string): Locator =>
  page.getByTestId(`table-node-${name}`);

export const listItem = (page: Page, name: string): Locator =>
  page.getByTestId(`table-list-item-${name}`);

/** Clicks the title area of a table node on the canvas (real mouse input). */
export async function clickTable(page: Page, name: string): Promise<void> {
  await tableNode(page, name).click({ position: { x: 20, y: 12 } });
  await expect(tableNode(page, name)).toHaveAttribute("data-selected", "true");
}

/** The schema name in the toolbar (the badge with the table count is a sibling). */
export const schemaName = (page: Page): Locator =>
  page.getByTestId("toolbar-schema-name").locator("span").first();

/** After the centring animation settles, the selected table's header lies between toolbar and sheet. */
export async function expectSelectedHeaderAboveSheet(page: Page): Promise<void> {
  const sheet = page.getByTestId("issues-sheet");
  const node = page.locator('[data-testid^="table-node-"][data-selected="true"]').first();
  let last = "";
  await expect
    .poll(async () => {
      const box = await node.boundingBox();
      const now = JSON.stringify(box);
      const settled = now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  const box = await node.boundingBox();
  const sheetBox = await sheet.boundingBox();
  const toolbarBox = await page.getByTestId("toolbar-more").boundingBox();
  expect(box && sheetBox && toolbarBox).toBeTruthy();
  const header = box!.y + 20;
  expect(header).toBeLessThan(sheetBox!.y);
  expect(header).toBeGreaterThan(toolbarBox!.y + toolbarBox!.height);
  await expect(sheet).toBeVisible();
}
