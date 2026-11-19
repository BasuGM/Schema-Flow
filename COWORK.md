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
   - **fix now** if High or Medium, if it blocks the next feature, if it is an accessibility
     blocker, or if the fix is cheap;
   - otherwise **deferred → target** (a ROADMAP task ID).
5. Reply with: verdict, a compact step table, the defects, and **one paste block** for Claude Code
   (start it with `/qa` so the report is handled by the fix-qa-round skill).

## Planning and models

- Planning stays in Claude Code (Plan mode). Cowork reviews only large or risky plans.
- Use **Opus** for a feature's first verification, big plan reviews and phase close-outs; use
  **Sonnet** for re-verification.

## Verification tooling

- Stage `out/` (normal build) or `out-qa/` (QA-hook build, `NEXT_PUBLIC_QA_HOOKS=1`) as a tarball
  and serve it on `:3100`, e.g. `python3 -m http.server 3100 --directory out`, driven by headless
  Playwright. The suite never starts a server: set `E2E_BASE_URL=http://localhost:3100`.
- QA-hook build: `E2E_QA_HOOKS=1 E2E_BASE_URL=<out-qa server> npm run e2e -- error-regions.spec.ts`.
- Harnesses run as `<harness> <url> /tmp/claude-0/chw.sh`. Performance harness:
  `scripts/headless/large-schema-perf.mjs`; phone toolbar: `scripts/headless/toolbar-width.mjs`
  (must print PASS in light and dark at 390×844).
- Use **real input** (mouse and keyboard through Playwright/CDP), not synthetic `click` events; the
  only synthetic input is the file drop. Compare timings to **Off** (neighbourhood setting Off) on
  the same machine in the same run; never against numbers from another machine.
- Key selectors (`data-testid`): `toolbar-import`, `toolbar-search`, `toolbar-issues`,
  `toolbar-settings`, `toolbar-more`, `toolbar-theme`, `import-dialog`, `import-textarea`,
  `import-confirm`, `import-status`, `issues-panel`, `table-list-item-<name>`,
  `table-node-<name>`, `inspector-title`, `inspector-columns`, `search-status`.
- Details of `chw.sh` and the cloud harness setup are not recorded in the repo yet: add them here
  from the Cowork notes.
