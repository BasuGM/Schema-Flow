// Large-schema frame costs (P2-T10): imports tests/fixtures/large/neighbourhood-2000.postgres.sql
// (2,000 tables; `hub` is referenced by 499 of them) and measures, 3 runs each, with neighbourhood
// highlighting Off and at 1 hop (the default):
//   - select `hub` on the canvas, deselect (empty canvas), and switch from `hub` to another table,
//     with real mouse input (CDP Input.dispatchMouseEvent pressed/released, so React Flow's
//     pointerdown path runs; QA-019): pointerdown → the first frame after the click, the worst
//     frame in the following 800 ms, and the longest task;
//   - select a table from the list, which centres it (zoom 0.05 → 1): the worst frame;
//   - pan for ~90 frames over the content at the fitted zoom and at zoom 1, with nothing and with
//     `hub` selected: frames per second and the worst frame.
// Budgets (development machine, M1 8 GB, at 1 hop): first frame ≤ 40 ms for hub select/deselect,
// worst centring frame ≤ 100 ms, ≥ 45 fps panning at the fitted zoom with `hub` selected. Other
// machines should compare 1 hop against the Off baseline measured on the same machine.
//
// Usage (needs Google Chrome and a running server, e.g. `npm run start`):
//   node scripts/headless/large-schema-perf.mjs [url] [chrome-path]
// Exit code 0 = within budget, 1 = over budget, 2 = could not run. Dependency-free: Chrome
// DevTools Protocol over Node's global WebSocket (Node 22+).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.argv[2] ?? "http://localhost:3000/";
const chromePath =
  process.argv[3] ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fixture = readFileSync(
  new URL("../../tests/fixtures/large/neighbourhood-2000.postgres.sql", import.meta.url),
  "utf8",
);
const RUNS = 3;
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "schemaflow-perf-"));
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
const consoleLines = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === "Runtime.consoleAPICalled")
    consoleLines.push(`${m.params.type}: ${m.params.args[0]?.value ?? ""}`);
  if (m.method === "Runtime.exceptionThrown") consoleLines.push("exception");
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
const mouse = async (type, x, y, buttons = 0) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });
const realClick = async (selector) => {
  const c = await evaluate(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
  );
  await mouse("mousePressed", c[0], c[1], 1);
  await mouse("mouseReleased", c[0], c[1]);
  await sleep(300);
};

/** Runs `action` in the page, then records rAF frame gaps for `ms`. */
const frames = (action, ms = 800) =>
  evaluate(`new Promise((resolve) => {
    const gaps = []; const t0 = performance.now(); let last = t0;
    ${action};
    const loop = () => {
      const now = performance.now(); gaps.push(now - last); last = now;
      if (now - t0 < ${ms}) requestAnimationFrame(loop);
      else resolve({ first: Math.round(gaps[0]), worst: Math.round(Math.max(...gaps)) });
    };
    requestAnimationFrame(loop);
  })`);
/** A point inside the node's header (the node may be only a few pixels wide when zoomed out). */
const nodePoint = (tableId) => `(() => {
  const el = document.querySelector('.react-flow__node[data-id="${tableId}"]');
  const r = el.getBoundingClientRect();
  const p = [r.left + r.width / 2, r.top + Math.min(r.height / 2, Math.max(1, r.height * 0.05))];
  return el.contains(document.elementFromPoint(p[0], p[1])) ? p : null;
})()`;
/** A point on the empty canvas. */
const panePoint = `(() => {
  const pane = document.querySelector('.react-flow__pane').getBoundingClientRect();
  for (let y = pane.top + 20; y < pane.bottom - 20; y += 23)
    for (let x = pane.left + 20; x < pane.right - 20; x += 23) {
      const el = document.elementFromPoint(x, y);
      if (el && el.classList.contains('react-flow__pane')) return [x, y];
    }
  return null;
})()`;
/**
 * Real click at the point `where` evaluates to: arms a probe (pointerdown time, click time, rAF
 * timestamps, long tasks), then sends pressed/released through CDP like a real mouse.
 */
async function realInput(where, ms = 800) {
  const point = await evaluate(where);
  if (!point) throw new Error(`No clickable point for ${where.slice(0, 80)}`);
  await evaluate(`(() => {
    const probe = (window.__probe = { down: 0, click: 0, frames: [], tasks: [], on: true });
    addEventListener('pointerdown', () => { probe.down ||= performance.now(); }, { capture: true, once: true });
    addEventListener('click', () => { probe.click ||= performance.now(); }, { capture: true, once: true });
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) probe.tasks.push(e.duration);
    });
    observer.observe({ type: 'longtask' });
    probe.observer = observer;
    const loop = (t) => { probe.frames.push(performance.now()); if (probe.on) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  })()`);
  await mouse("mousePressed", point[0], point[1], 1);
  await mouse("mouseReleased", point[0], point[1]);
  await sleep(ms);
  return evaluate(`(() => {
    const p = window.__probe; p.on = false; p.observer.disconnect();
    const after = p.frames.filter((t) => t > p.down);
    const next = after.find((t) => t > p.click) ?? after.at(-1);
    let worst = 0;
    for (let i = 1; i < after.length; i++) worst = Math.max(worst, after[i] - after[i - 1]);
    worst = Math.max(worst, (after[0] ?? p.down) - p.down);
    return { first: Math.round(next - p.down), worst: Math.round(worst), task: Math.round(Math.max(0, ...p.tasks)) };
  })()`);
}
const escape = `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`;
const selectedTable = () =>
  evaluate(`document.querySelector('.table-node[data-selected="true"]')?.dataset.testid ?? null`);
/** Measures `action` from a known selection state and checks the state it leads to. */
async function measured(name, depth, action, expected, ms) {
  const result = typeof action === "function" ? await action() : await frames(action, ms);
  const now = await selectedTable();
  if (now !== expected) throw new Error(`${name}: expected ${expected}, got ${now}`);
  record(depth, name, result);
  await sleep(300);
}
/** A rendered table other than `hub` that is far enough on screen to click. */
const otherNode = () =>
  evaluate(
    `[...document.querySelectorAll('.react-flow__node')].find((n) => { if (n.dataset.id === 'public.hub') return false; const r = n.getBoundingClientRect(); const c = document.querySelector('.react-flow__pane').getBoundingClientRect(); return r.left > c.left + 8 && r.right < c.right - 8 && r.top > c.top + 8 && r.bottom < c.bottom - 8 && n.contains(document.elementFromPoint(r.left + r.width / 2, r.top + Math.max(1, r.height * 0.05))); })?.dataset.id`,
  );

/** Drags the empty canvas back and forth (so it stays over the content) for ~90 frames. */
async function pan() {
  const start = await evaluate(`(() => {
    const pane = document.querySelector('.react-flow__pane').getBoundingClientRect();
    for (let y = pane.top + 20; y < pane.bottom - 20; y += 23)
      for (let x = pane.left + 20; x < pane.right - 20; x += 23) {
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('react-flow__pane')) return [x, y];
      }
    return null;
  })()`);
  if (!start) return { fps: 0, worst: 0 };
  await evaluate(
    `window.__gaps = []; window.__last = performance.now(); window.__rec = true; (function loop() { const now = performance.now(); window.__gaps.push(now - window.__last); window.__last = now; if (window.__rec) requestAnimationFrame(loop); })()`,
  );
  let [x, y] = start;
  await mouse("mousePressed", x, y, 1);
  for (let i = 0; i < 90; i++) {
    x += i % 30 < 15 ? 8 : -8;
    y += i % 20 < 10 ? 3 : -3;
    await mouse("mouseMoved", x, y, 1);
    await sleep(14);
  }
  await mouse("mouseReleased", x, y);
  return evaluate(`(() => { window.__rec = false; const g = window.__gaps.slice(2);
    return { fps: Math.round(1000 / (g.reduce((a, b) => a + b, 0) / g.length)), worst: Math.round(Math.max(...g)) }; })()`);
}

async function setDepth(depth) {
  await realClick('[data-testid="toolbar-settings"]');
  await realClick(`[data-testid="settings-neighbourhood-${depth}"]`);
  await evaluate(
    `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
  );
  await sleep(300);
}

async function importFixture() {
  await send("Page.navigate", { url });
  // A background tab may not run requestAnimationFrame, which the import's busy state waits for.
  await send("Page.bringToFront");
  await sleep(2500);
  await evaluate(`${q("toolbar-import")}.click()`);
  await sleep(600);
  await evaluate(
    `(() => { const t = ${q("import-textarea")}; t.value = ${JSON.stringify(fixture)}; t.dispatchEvent(new Event('input', { bubbles: true })); })()`,
  );
  for (let k = 0; k < 60; k++) {
    await sleep(500);
    if (await evaluate(`/Import 2,?000 tables/.test(${q("import-confirm")}?.textContent ?? '')`))
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
  return evaluate(`document.querySelectorAll('.react-flow__node').length > 20`);
}

const fit = async () => {
  await evaluate(`document.querySelector('.react-flow__controls-fitview')?.click()`);
  await sleep(800);
};

await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
});
let imported = false;
for (let attempt = 0; attempt < 3 && !imported; attempt++) imported = await importFixture();
if (!imported) {
  console.error("Could not import the fixture:", consoleLines);
  ws.close();
  done(2);
  await new Promise(() => {});
}
const rendered = await evaluate(
  `({ nodes: document.querySelectorAll('.react-flow__node').length, edges: document.querySelectorAll('.react-flow__edge').length })`,
);
console.log(
  `Imported neighbourhood-2000; rendered at the fitted zoom: ${JSON.stringify(rendered)}`,
);

const results = {};
const record = (depth, name, value) => ((results[depth] ??= {})[name] ??= []).push(value);
for (const depth of [0, 1]) {
  await setDepth(depth);
  for (let run = 0; run < RUNS; run++) {
    await fit();
    await frames(escape);
    const hub = () => realInput(nodePoint("public.hub"));
    await measured("select hub", depth, hub, "table-node-hub");
    await measured("deselect", depth, () => realInput(panePoint), null);
    await hub();
    const other = await otherNode();
    await measured(
      "hub → other",
      depth,
      () => realInput(nodePoint(other)),
      `table-node-${other.replace("public.", "")}`,
    );
    await frames(escape);
    record(depth, "pan, fitted, nothing selected", await pan());
    await hub();
    record(depth, "pan, fitted, hub selected", await pan());
    await frames(escape);
    await evaluate(`${q("table-list-item-t_1500")}.scrollIntoView({ block: 'center' })`);
    await measured(
      "list select (centre)",
      depth,
      `${q("table-list-item-t_1500")}.click()`,
      "table-node-t_1500",
      1200,
    );
    record(depth, "pan, zoom 1, t_1500 selected", await pan());
    await evaluate(`${q("table-list-item-hub")}.scrollIntoView({ block: 'center' })`);
    await frames(`${q("table-list-item-hub")}.click()`, 1200);
    record(depth, "pan, zoom 1, hub selected", await pan());
    await frames(escape);
  }
}

const fmt = (runs) =>
  runs
    .map((r) =>
      r.fps !== undefined
        ? `${r.fps} fps (worst ${r.worst} ms)`
        : `${r.first} ms (worst ${r.worst} ms${r.task !== undefined ? `, task ${r.task} ms` : ""})`,
    )
    .join(" · ");
console.log("\n| Measurement | Off | 1 hop |\n|---|---|---|");
for (const name of Object.keys(results[1]))
  console.log(`| ${name} | ${fmt(results[0][name])} | ${fmt(results[1][name])} |`);

const at1 = results[1];
const max = (name, key) => Math.max(...at1[name].map((r) => r[key]));
const min = (name, key) => Math.min(...at1[name].map((r) => r[key]));
const checks = [
  ["hub select, first frame ≤ 40 ms", max("select hub", "first") <= 40, max("select hub", "first")],
  ["deselect, first frame ≤ 40 ms", max("deselect", "first") <= 40, max("deselect", "first")],
  [
    "list select, worst centring frame ≤ 100 ms",
    max("list select (centre)", "worst") <= 100,
    max("list select (centre)", "worst"),
  ],
  [
    "pan at fitted zoom with hub selected ≥ 45 fps",
    min("pan, fitted, hub selected", "fps") >= 45,
    min("pan, fitted, hub selected", "fps"),
  ],
];
console.log("");
for (const [label, ok, value] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (measured ${value}, 1 hop, worst of ${RUNS})`);
console.log(`Console: ${consoleLines.length ? JSON.stringify(consoleLines) : "empty"}`);
ws.close();
done(checks.every(([, ok]) => ok) ? 0 : 1);
