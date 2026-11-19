# Plan: committed Playwright e2e suite (tooling task E2E-01)

Goal: a committed browser suite Cowork can run against a served build, covering the UI-observable
AC-P1-* and AC-P2-* ACs. Chromium only. Separate from `npm run check`.

## Requirements

- `tests/e2e/`, `@playwright/test`, Chromium only; `baseURL` = `E2E_BASE_URL` (default
  `http://localhost:3000`). The suite never starts a server.
- One spec per verified area: import (paste/file/drop, counts per fixture), issues panel + Show
  table, search, inspector tabs/links/Back, neighbourhood dimming sets, panels inert/Enter/keyboard,
  phone sheet at 390×844, error regions (only when `E2E_QA_HOOKS=1`, against `out-qa`).
- Assert on `data-testid` / `data-*` / ARIA state, not pixels. Real mouse and keyboard input. Wait on
  state (`expect(...).toHaveAttribute`, `toBeVisible`), never fixed timeouts.
- `npm run e2e` prints a compact summary (passed/failed counts + failing test names with a one-line
  reason). A JSON reporter writes `e2e-results.json` (git-ignored).
- Excluded from `npm run check`, tsc/eslint/prettier still cover the files.
- Documented in `docs/development/AGENT-REFERENCE.md`; dependency justified in ARCHITECTURE.md (ADR).
- Future handoffs list: e2e command, spec files added/changed, result.

## Checklist

- [x] ADR in ARCHITECTURE.md; `@playwright/test` devDependency
- [x] `playwright.config.ts`, compact reporter, `e2e` script, `.gitignore` entries
- [x] Shared helpers (`tests/e2e/support/`): fixtures path, importText/importFile/dropFile, selectors
- [x] `import.spec.ts`
- [x] `issues.spec.ts`
- [x] `search.spec.ts`
- [x] `inspector.spec.ts`
- [x] `neighbourhood.spec.ts`
- [x] `panels.spec.ts`
- [x] `phone.spec.ts`
- [x] `error-regions.spec.ts` (skipped unless `E2E_QA_HOOKS=1`)
- [x] AGENT-REFERENCE.md section; ROADMAP/VERIFICATION/QA_LOG bookkeeping via doc-keeper
- [ ] Handoff `docs/development/handoffs/E2E-01.md`

## Definition of done

- `npm run check` green (e2e excluded, new files typecheck/lint/format clean).
- `npm run build && npm run start` served; `npm run e2e` passes against it (record counts).
- `E2E_QA_HOOKS=1 E2E_BASE_URL=<out-qa server> npm run e2e` runs the error-region spec.
- `e2e-results.json` is produced; summary prints failing names with one-line reasons (verified by
  one deliberately failing run, then reverted).
