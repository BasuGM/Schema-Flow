// Collapse-all cost (P3-T02): imports tests/fixtures/real/gitlab-structure.postgres.sql (992 tables)
// and measures, with real mouse input over CDP (pointerdown → the first frame after the click, the
// worst frame in the next 1.5 s, and the longest task from a PerformanceObserver):
//   Settings → "Headers only", then Settings → "Show all columns", 3 runs each.
// Informational: ~200 ms on an M1 is the line above which a known issue is noted (P3-T02 plan);
// nothing is optimised in that task, so the exit code is 0 unless the run could not complete (2).
//
// Usage (needs Google Chrome and a running server, e.g. `npm run start`):
//   node scripts/headless/collapse-perf.mjs [url] [chrome-path]
// Dependency-free: Chrome DevTools Protocol over Node's global WebSocket (Node 22+).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000/";
const chromePath =
  process.argv[3] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fixture = readFileSync(
  new URL("../../tests/fixtures/real/gitlab-structure.postgres.sql", import.meta.url),
  "utf8",
);
const RUNS = 3;
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "schemaflow-collapse-"));
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

/** Real click on `testid` with a probe armed: pointerdown → next frame, worst frame, longest task. */
async function measuredClick(testid, ms = 1500) {
  const p = await centre(testid);
  if (!p) throw new Error(`No element ${testid}`);
  await evaluate(`(() => {
    const probe = (window.__probe = { down: 0, click: 0, frames: [], tasks: [], on: true });
    addEventListener('pointerdown', () => { probe.down ||= performance.now(); }, { capture: true, once: true });
    addEventListener('click', () => { probe.click ||= performance.now(); }, { capture: true, once: true });
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) probe.tasks.push(e.duration);
    });
    observer.observe({ type: 'longtask' });
    probe.observer = observer;
    const loop = () => { probe.frames.push(performance.now()); if (probe.on) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  })()`);
  await mouse("mousePressed", p[0], p[1], 1);
  await mouse("mouseReleased", p[0], p[1]);
  await sleep(ms);
  return evaluate(`(() => {
    const p = window.__probe; p.on = false; p.observer.disconnect();
    const after = p.frames.filter((t) => t > p.down);
    const next = after.find((t) => t > (p.click || p.down)) ?? after.at(-1);
    let worst = 0;
    for (let i = 1; i < after.length; i++) worst = Math.max(worst, after[i] - after[i - 1]);
    return { first: Math.round(next - p.down), worst: Math.round(worst), task: Math.round(Math.max(0, ...p.tasks)) };
  })()`);
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

await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
});
if (!(await importFixture())) await fail("Could not import the GitLab fixture");
await evaluate(`document.querySelector('.react-flow__controls-fitview')?.click()`);
await sleep(800);
const tables = await evaluate(`${q("toolbar-schema-name")}?.textContent ?? ''`);
console.log(`Imported GitLab structure.sql (${tables.trim()})`);

const results = { header: [], full: [] };
for (let run = 0; run < RUNS; run++) {
  for (const mode of ["header", "full"]) {
    await click("toolbar-settings");
    await sleep(400);
    results[mode].push(await measuredClick(`settings-collapse-all-${mode}`));
    await sleep(500);
  }
}
const label = { header: "Headers only", full: "Show all columns" };
let slow = false;
for (const mode of ["header", "full"]) {
  const runs = results[mode];
  console.log(
    `${label[mode]}: ${runs.map((r) => `first ${r.first} ms / worst ${r.worst} ms / task ${r.task} ms`).join(" | ")}`,
  );
  if (Math.max(...runs.map((r) => r.first)) > 200) slow = true;
}
console.log(slow ? "NOTE: over ~200 ms (known issue)" : "Within ~200 ms");
ws.close();
done(0);
