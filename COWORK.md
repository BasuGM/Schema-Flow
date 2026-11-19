# COWORK — instructions for Claude Cowork chats

Cowork verifies in the browser; it does not edit the repo. Claude Code implements and fixes.

## Start of every chat

Read, in order: this file, the **Now** block at the top of `docs/development/ROADMAP.md`, the
**Backlog** table at the top of `docs/development/QA_LOG.md`, and the latest handoff named in the
Now block. Do **not** read `docs/development/handoffs/archive/` unless asked.

## Each verification round

1. Run the e2e suite first: `npm run e2e` against the served build (see tooling below). Record
   `N passed / N failed / N skipped`.
2. Then targeted checks of what changed (the handoff's step table and the ACs it lists).
3. Mark every step and AC **PASS / FAIL / NOT TESTED** (say why); never PASS what you did not run.
4. New defects get the next `QA-###` (see the Backlog table for the last number), a severity
   (blocker / major / minor / cosmetic, or High / Medium / Low as in the log), a one-line repro, and
   a triage:
   - **fix now** only if it is **blocking**: High severity, a crash or data loss, it breaks what
     the next task builds on, or it stops verification;
   - otherwise (Medium, Low, non-blocking a11y) **deferred → target** (a bug-fix task ID or the
     phase-end bug-bash). Log it, don't hold the round: the verdict is "Verified with known
     issues" and the next task starts.
5. Reply with: verdict, a compact step table, the defects, and **one paste block** for Claude Code
   (start it with `/qa` so the report is handled by the fix-qa-round skill).

## Planning and models

- Planning stays in Claude Code (Plan mode). Cowork reviews only large or risky plans.
- Cowork runs on **Opus** for every round (verification, re-verification and plan reviews).
  Token savings come from Claude Code's side (Sonnet for implementing well-specified plans).

## Verification tooling (Cowork cloud)

- npm install doesn't work in Cowork's cloud. Run e2e by shimming @playwright/test onto the
  preinstalled Playwright: in the cloud clone, symlink node_modules/playwright and
  node_modules/playwright-core to /opt/npm-tools/node_modules/…, add
  node_modules/@playwright/test/index.js = `module.exports = require('playwright/test')`, then
  `E2E_BASE_URL=http://localhost:3100/ node node_modules/playwright/cli.js test` (error regions:
  `E2E_QA_HOOKS=1`, out-qa/ on :3101).
- Builds: on the Mac, tar out/ and out-qa/ (fresher than src/), stage, delete the tarball; in the
  cloud, serve with `python3 -m http.server 3100 --directory out` (and 3101 for out-qa).
- Harnesses: `node scripts/headless/<name>.mjs http://localhost:3100/ /tmp/claude-0/chw.sh`
  (chw.sh = Playwright's Chromium with --no-sandbox). Real input only; compare timings to Off on
  the same machine (cloud ≈ 2–3× slower than the M1). Harnesses: `large-schema-perf.mjs`;
  `toolbar-width.mjs` (must print PASS in light and dark at 390×844).
- Parser checks: run TS sources with `node --experimental-transform-types` + a resolve hook for
  `@/` and `.ts`.
- e2e now covers QA-020 edge stroke/fill-opacity (`neighbourhood.spec.ts`) and zoomed-out
  rendering (`zoomed-out.spec.ts`).
- Key selectors (`data-testid`): `toolbar-import`, `toolbar-search`, `toolbar-issues`,
  `toolbar-settings`, `toolbar-more`, `toolbar-theme`, `import-dialog`, `import-textarea`,
  `import-confirm`, `import-status`, `issues-panel`, `table-list-item-<name>`,
  `table-node-<name>`, `inspector-title`, `inspector-columns`, `search-status`.
