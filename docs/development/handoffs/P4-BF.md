# P4-BF — QA-041 / QA-042 bug-fix

**Summary:** Two deferred Low defects fixed at the root. `npm run check` green (862 tests).

**Commits:** see `git log` (`P4-BF: ...`).

**Files changed:** `relationship-edge.tsx` (non-scaling stroke for on-path edges in overview), `schema-canvas.tsx` and `search-dialog.tsx` (`aria-keyshortcuts` via `keyShortcutsFor`), tests in `path-highlight.test.tsx`, `shortcuts-dialog.test.tsx`; QA_LOG, ROADMAP.

**How to test**

| Step                                                                         | Expected                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| saas-300 → path billing.t097_link → analytics.t031_entity → zoom out to ~0.1 | on-path edges stay ~2px, not hairlines (QA-041)                    |
| Inspect `toolbar-search` and `canvas-reset-view`                             | `aria-keyshortcuts` = "Control+K /" (Meta on Mac) and "F" (QA-042) |

**ACs met:** QA-041 yes, QA-042 yes (automated only).

**Open items:** Awaiting Cowork verification. Next: P4-T06.
