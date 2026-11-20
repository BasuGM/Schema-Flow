// Session restore cost (P3-T06, ADR-030): imports tests/fixtures/real/gitlab-structure.postgres.sql
// (992 tables), waits for the session to be saved, then reloads "/" and prints the time until the
// "Restoring…" status is gone and a table node is on screen. Informational: over ~4 s on an M1 is a
// known issue; the exit code is 0 unless the run could not complete (2).
//
// Usage (needs a running server, e.g. `npm run start`): node scripts/headless/restore-perf.mjs [url]
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { checkLoad, cleanupOnExit } from "./perf-guard.mjs";

const url = process.argv[2] ?? "http://localhost:3000/";
const fixture = fileURLToPath(
  new URL("../../tests/fixtures/real/gitlab-structure.postgres.sql", import.meta.url),
);
checkLoad();
const browser = await chromium.launch();
cleanupOnExit(() => void browser.close());
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url);
  await page.getByTestId("toolbar-import").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByText("Choose file…").click();
  await (await chooser).setFiles(fixture);
  const confirm = page.getByTestId("import-confirm");
  await confirm.waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="import-confirm"]')?.hasAttribute("disabled"),
    undefined,
    { timeout: 60_000 },
  );
  await confirm.click();
  await page.getByTestId("import-dialog").waitFor({ state: "hidden", timeout: 60_000 });
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("schemaflow");
        open.onsuccess = () => {
          const get = open.result.transaction("session").objectStore("session").get("current");
          get.onsuccess = () => resolve(Boolean(get.result));
        };
        open.onerror = () => resolve(false);
      }),
    undefined,
    { timeout: 30_000 },
  );
  for (let run = 1; run <= 3; run++) {
    const start = Date.now();
    await page.goto(url);
    await page
      .locator('[data-testid="canvas-overview"], [data-testid^="table-node-"]')
      .first()
      .waitFor({ timeout: 60_000 });
    await page.getByTestId("canvas-restoring").waitFor({ state: "detached" });
    console.log(
      `restore ${run}: ${Date.now() - start} ms (reload → first table node, or the overview canvas, on screen)`,
    );
  }
  console.log(`tables: ${await page.getByTestId("toolbar-schema-name").textContent()}`);
} catch (error) {
  console.error(error);
  process.exitCode = 2;
} finally {
  await browser.close();
}
