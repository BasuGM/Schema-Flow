# Plan: BB-P2, Phase 2 bug-bash (before P3-T01)

Looks for defects **between** Phase 2 features and on inputs no AC covers. Time-boxed; findings are
recorded per row as they are made. Plan approved with amendments 1–6 (below).

## Rules

- **Triage:** fix now if High or Medium, blocks P3-T01, is an a11y blocker, or is cheap (under about
  30 min, or same area as other fixes). Otherwise Deferred with a target (P3 task ID or "P3
  bug-bash"). A High stops exploration: fix first, then continue. If more than 10 backlog items are
  open after triage, add a bug-fix task to the ROADMAP before P3-T01.
- **Row 7 console rule:** errors are always defects. Warnings are defects unless they come from the
  browser or a third party and are listed in the allowlist below.
- **Hostile-input fixtures** are generated at test runtime, never committed. `MAX_IMPORT_BYTES` is
  `5 * 1024 * 1024` (`src/components/import/import-draft.ts`).
- Automated rows (4 focus-loss, 5, 7) live in `tests/e2e/bug-bash.spec.ts`. Cowork handoff: `npm run
e2e`, the QA-023 re-check, a fix-steps table, and at most 20 minutes of exploration on rows 1 and 4.
- Done also requires: ROADMAP Now block updated; ACs named `AC-BB-P2-<n>`; the :3100 server stopped
  and exactly one dev server running.

## Console allowlist (warnings)

_(none; the allowlist is empty)_

## Charter and findings

| #   | Session                        | What to try                                                                                                                                                                                                                                                                              | Status / findings                                                                                                                                                                                                                               |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Import × state                 | Import while a table is selected or searched, inspector on Relations, issues panel open, neighbourhood at 2 hops. Re-import the same file. Empty file or errors-only, then cancel. Nothing stale survives: selection, highlighted column, Back history, issues, search results, dim set. | Done. Nothing stale survives an import or a re-import (selection, highlight, Back, search, dim set, filter); cancelled imports keep the draft by design; an open issues panel stays open and shows its empty state (documented). Nothing found. |
| 2   | Search × collapse × zoomed-out | Search for a column hidden by the collapse mode on a large schema at overview zoom; `skeleton-rows` at the target; Escape.                                                                                                                                                               | Done. Collapse modes have no UI yet (P3-T02), so searched on GitLab at overview zoom: a column result centres, zooms in, highlights the row. Nothing found.                                                                                     |
| 3   | Inspector navigation           | FK links, Back, across an import; self-reference; composite FKs; 100-row caps on GitLab.                                                                                                                                                                                                 | Done. GitLab: Relations list (101 rows) navigates and Back returns; Columns, Keys and Relations tabs work. Nothing found.                                                                                                                       |
| 4   | Keyboard-only run              | Every Phase 2 feature without a mouse: tab order, focus after each dialog or sheet closes, visible focus, no focus lost to `body`.                                                                                                                                                       | Done. **QA-025**, **QA-026** (focus fell to body). Automated in `bug-bash.spec.ts`.                                                                                                                                                             |
| 5   | Viewports and themes           | Light/dark at 390×844, 768, 900, 1280; resize across breakpoints with each sheet or panel open; no horizontal overflow, readable dim tokens.                                                                                                                                             | Done. Matrix of 4 widths × 2 themes plus a resize sweep: no overflow. Automated. Nothing found.                                                                                                                                                 |
| 6   | Hostile input                  | 5 MB + 1 byte, binary, CRLF, very long identifiers, unicode and emoji names, 300-column table, ~4 MB paste.                                                                                                                                                                              | Done. **QA-024** (a file 1 byte over the limit read "5.0 MB; the limit is 5.0 MB"). Binary, CRLF, long and unicode names, a 300-column table: fine, no overflow.                                                                                |
| 7   | Console and errors             | A console listener in every session.                                                                                                                                                                                                                                                     | Done. Empty on the full journey, including a 180-table import and 2-hop dimming. Allowlist stays empty.                                                                                                                                         |

## Checklist

- [x] Rows 1–7 run, findings recorded
- [x] `tests/e2e/bug-bash.spec.ts` (rows 4, 5, 7)
- [x] QA-024+ fixed with regression tests or deferred with a target
- [x] `npm run check` exit 0; `npm run e2e` 0 failures; `toolbar-width.mjs` PASS light and dark
- [x] QA_LOG, ROADMAP Now block + BB-P2 row, VERIFICATION `AC-BB-P2-<n>`, handoff `handoffs/BB-P2.md`
- [ ] Pushed; :3100 stopped; one dev server
