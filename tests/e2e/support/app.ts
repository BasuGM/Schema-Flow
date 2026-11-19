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

/** Imports a fixture through the dialog (file picker) and waits for the dialog to close. */
export async function importFixture(page: Page, relative: string): Promise<void> {
  await openImport(page);
  await chooseFile(page, relative);
  const confirm = page.getByTestId("import-confirm");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(importDialog(page)).toBeHidden();
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
