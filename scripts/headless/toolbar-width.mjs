// Phone-width toolbar regression check (QA-012 and P2-T07): no horizontal overflow at 390×844,
// light and dark, with the Issues counts showing.
//
// Usage (needs Google Chrome and a running server, e.g. `npm run start`):
//   node scripts/headless/toolbar-width.mjs [url] [chrome-path]
// Exit code 0 = pass, 1 = overflow, 2 = could not run. Dependency-free: Chrome DevTools Protocol
// over Node's global WebSocket (Node 22+).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000/";
const chromePath =
  process.argv[3] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fixture = readFileSync(
  new URL("../../tests/fixtures/sql/edge-cases.postgres.sql", import.meta.url),
  "utf8",
);
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "schemaflow-toolbar-"));
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
const done = (code) => {
  chrome.kill();
  // Chrome may still be writing its profile for a moment after the kill.
  setTimeout(() => {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    process.exit(code);
  }, 300);
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
if (!target) {
  console.error("Could not start Chrome at", chromePath);
  done(2);
  await new Promise(() => {});
}

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
const q = (testid) => `document.querySelector('[data-testid=${testid}]')`;

let failed = false;
for (const scheme of ["light", "dark"]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: scheme }],
  });
  await send("Page.navigate", { url });
  await sleep(2500);
  await evaluate(`${q("toolbar-import")}.click()`);
  await sleep(600);
  await evaluate(
    `(() => { const t = ${q("import-textarea")}; t.value = ${JSON.stringify(fixture)}; t.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  await sleep(1200);
  await evaluate(`${q("import-confirm")}.click()`);
  await sleep(1000);
  const m = await evaluate(`({
    page: document.documentElement.scrollWidth,
    toolbar: ${q("toolbar")}.scrollWidth,
    viewport: innerWidth,
    issues: ${q("toolbar-issues")}?.getAttribute('aria-label'),
  })`);
  const ok = m && m.page <= m.viewport && m.toolbar <= m.viewport;
  console.log(`${ok ? "PASS" : "FAIL"} ${scheme}: ${JSON.stringify(m)}`);
  if (!ok) failed = true;
}
ws.close();
done(failed ? 1 : 0);
