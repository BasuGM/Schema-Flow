### Claude Cowork Verification Handoff

**Task:** BB-P2, the Phase 2 bug-bash (plan [plans/bug-bash-p2.md](../plans/bug-bash-p2.md)), plus
the QA-023 re-check. Claude Code explored; nothing here is independently verified.

**Pushed commits:** see the reply (one batch, `origin/main` = local `HEAD`).

**Steps → expected**

1. **e2e.** `npm run e2e` on a served normal build: 137 passed, 0 failed, 20 skipped (Claude Code's
   run). New: `bug-bash.spec.ts` (console, viewport × theme, focus). Record your own counts.
2. **QA-023.** GitLab import preview reads `992 tables · 9,982 columns · 1,720 relationships`.
3. **QA-024.** Choose a file of 5,242,881 bytes: the message says
   `This file is 5,242,881 bytes; the limit is 5.0 MB.`
4. **QA-025.** Import `sql/edge-cases.postgres.sql`, focus "Close issues", press Enter: the panel
   closes and focus is on the toolbar Issues button (Enter reopens it).
5. **QA-026.** Select a table, focus the inspector X ("Clear selection"), press Enter: the
   selection clears and focus is on the "Select a table to inspect it" area, not on `body`.
6. **Exploration (≤ 20 min), rows 1 and 4 of the charter.**
   - Row 1: import over every state you can set up (selection, search highlight, inspector Back
     history, issues open, 2 hops, a typed table filter) and look for anything stale.
   - Row 4: do every Phase 2 feature with the keyboard only; note any place focus is lost,
     invisible, or trapped.
   - Log new defects as `QA-027…`.

**Known issues (accepted):** QA-018 → P3-T07; hub select/deselect over 40 ms; main-thread parsing;
skipped DDL kinds.

**Next:** P3-T01.
