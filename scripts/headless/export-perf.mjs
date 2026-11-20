// Export cost (P3-T03 image, P3-T05 text tabs): imports tests/fixtures/real/gitlab-structure.postgres.sql (992 tables),
// opens Settings → "Export image…" and measures, with real mouse input over CDP, the time from the
// Download click until the file is handed to the browser (SVG ×2, PNG ×1 at the reduced scale),
// the file size and the longest main-thread task. Then, for the SQL and JSON tabs, the time from the
// tab click until the preview is on screen (P3-T05; informational, ~1 s on an M1 is the guide). The download itself is intercepted at the
// anchor click, so no file is written.
// Informational: over ~3 s on an M1 is noted as a known issue (P3-T03 plan); nothing is optimised
// there, so the exit code is 0 unless the run could not complete (2).
//
// Usage (needs Google Chrome and a running server, e.g. `npm run start`):
//   node scripts/headless/export-perf.mjs [url] [chrome-path]
// Dependency-free: Chrome DevTools Protocol over Node's global WebSocket (Node 22+).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLoad, cleanupOnExit } from "./perf-guard.mjs";

const url = process.argv[2] ?? "http://localhost:3000/";
const chromePath =
  process.argv[3] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fixture = readFileSync(
  new URL("../../tests/fixtures/real/gitlab-structure.postgres.sql", import.meta.url),
  "utf8",
);
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "schemaflow-export-"));
checkLoad();
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
cleanupOnExit(() => chrome.kill());
const done = (code) => {
  chrome.kill();
  setTimeout(() => {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    process.exit(code);
  }, 300);
};
const fail = (message) => {
  console.error(message);
  done(2);
  return new Promise(() => {});
};

let target;
for (let k = 0; k < 50 && !target; k++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === "page");
  } catch {
    // Chrome is still starting.
  }
}
if (!target) await fail(`Could not start Chrome at ${chromePath}`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result
    ?.result?.value;
const q = (testid) => `document.querySelector('[data-testid="${testid}"]')`;
const mouse = (type, x, y, buttons = 0) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });
const centre = (testid) =>
  evaluate(
    `(() => { const el = ${q(testid)}; if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
  );

async function click(testid) {
  const p = await centre(testid);
  if (!p) throw new Error(`No element ${testid}`);
  await mouse("mousePressed", p[0], p[1], 1);
  await mouse("mouseReleased", p[0], p[1]);
}

async function importFixture() {
  await send("Page.navigate", { url });
  for (let k = 0; k < 60; k++) {
    await sleep(250);
    if (await evaluate(`!!${q("toolbar-import")}`)) break;
  }
  await evaluate(`${q("toolbar-import")}.click()`);
  await sleep(500);
  await evaluate(
    `(() => { const t = ${q("import-textarea")}; t.value = ${JSON.stringify(fixture)}; t.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  for (let k = 0; k < 120; k++) {
    await sleep(500);
    if (await evaluate(`/Import [\\d,]+ tables/.test(${q("import-confirm")}?.textContent ?? '')`))
      break;
  }
  await evaluate(`${q("import-confirm")}.click()`);
  for (let k = 0; k < 120; k++) {
    await sleep(500);
    if (
      await evaluate(
        `!${q("import-dialog")} && document.querySelectorAll('.react-flow__node').length > 0`,
      )
    )
      break;
  }
  await sleep(1500);
  return evaluate(`document.querySelectorAll('.react-flow__node').length > 0`);
}

/** Clicks a segmented-control radio through its label (the input itself is visually hidden). */
async function clickLabelOf(testid) {
  const p = await evaluate(
    `(() => { const el = ${q(testid)}?.parentElement; if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
  );
  if (!p) throw new Error(`No element ${testid}`);
  await mouse("mousePressed", p[0], p[1], 1);
  await mouse("mouseReleased", p[0], p[1]);
}

/** Opens the dialog, picks the format, clicks Download and waits for the file to be handed over. */
async function exportOnce(format) {
  await click("toolbar-settings");
  await sleep(400);
  await click("settings-export-image");
  for (let k = 0; k < 40 && !(await evaluate(`!!${q("export-dialog")}`)); k++) await sleep(100);
  await clickLabelOf(`export-format-${format}`);
  const note = await evaluate(`${q("export-reduced-note")}?.textContent ?? ''`);
  const size = await evaluate(`${q("export-size")}?.textContent ?? ''`);
  await evaluate(`(() => {
    window.__dl = null;
    window.__tasks = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__tasks.push(e.duration); })
      .observe({ type: 'longtask' });
    addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
    HTMLAnchorElement.prototype.click = function () {
      const t = performance.now();
      fetch(this.href).then((r) => r.blob()).then((b) => { window.__dl = { t, bytes: b.size, name: this.download }; });
    };
  })()`);
  await click("export-download");
  for (let k = 0; k < 600; k++) {
    await sleep(250);
    if (await evaluate(`!!window.__dl`)) break;
  }
  const r = await evaluate(
    `window.__dl ? { ms: Math.round(window.__dl.t - window.__t0), mb: +(window.__dl.bytes / 1048576).toFixed(2), name: window.__dl.name, task: Math.round(Math.max(0, ...window.__tasks)) } : null`,
  );
  await sleep(500);
  return { ...r, note, size: size.trim() };
}

await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
});
if (!(await importFixture())) await fail("Could not import the GitLab fixture");
const tables = await evaluate(`${q("toolbar-schema-name")}?.textContent ?? ''`);
console.log(`Imported GitLab structure.sql (${tables.trim()})`);

let slow = false;
for (const format of ["svg", "svg", "png"]) {
  const r = await exportOnce(format);
  if (!r.name) await fail(`${format.toUpperCase()}: no download within 150 s`);
  console.log(
    `${format.toUpperCase()}: ${r.ms} ms, ${r.mb} MB, longest task ${r.task} ms (${r.size}${r.note ? `; ${r.note}` : ""})`,
  );
  if (r.ms > 3000) slow = true;
  // The dialog closes itself after a successful download.
}
/** Opens Export…, clicks a text tab and times the click until the preview is visible. */
async function textTabOnce(tab) {
  await click("toolbar-export");
  for (let k = 0; k < 40 && !(await evaluate(`!!${q("export-dialog")}`)); k++) await sleep(100);
  await sleep(300);
  await evaluate(`(() => {
    window.__t0 = null;
    addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
  })()`);
  await click(`export-tab-${tab}`);
  for (let k = 0; k < 600; k++) {
    if (await evaluate(`!!${q("export-preview")}`)) break;
    await sleep(50);
  }
  const ms = await evaluate(`Math.round(performance.now() - window.__t0)`);
  const info = await evaluate(
    `(${q("export-text-size")}?.textContent ?? '') + (${q("export-preview-truncated")} ? ' (preview truncated)' : '')`,
  );
  await evaluate(
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
  );
  await sleep(500);
  return { ms, info: info.trim() };
}

for (const tab of ["sql", "json"]) {
  const r = await textTabOnce(tab);
  console.log(`${tab.toUpperCase()} tab: ${r.ms} ms to preview (${r.info})`);
  if (r.ms > 1000) slow = true;
}
console.log(slow ? "NOTE: over ~3 s (known issue)" : "Within ~3 s");
ws.close();
done(0);
