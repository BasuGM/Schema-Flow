### Claude Cowork Verification Handoff

**Task:** after Cowork round 13: QA-023 fix and two new e2e specs. Phase 2 closed as "Verified with
known issues".

**Pushed commits:** see the reply (docs and code in one batch).

**Steps → expected**

1. **QA-023.** Import `real/gitlab-structure.postgres.sql`: preview shows
   `992 tables · 9,982 columns · 1,720 relationships`. Sample import and small fixtures unchanged.
2. **e2e.** `npm run e2e` on a served normal build: 123 passed, 0 failed, 20 skipped (Claude Code's
   run). New: `neighbourhood.spec` QA-020 test, `zoomed-out.spec.ts` (2 tests).
3. `E2E_QA_HOOKS=1` run against `out-qa/` is unchanged (`out-qa/` is from `9168b2a`).

**Known issues (accepted):** QA-018 → P3-T07; hub select/deselect over 40 ms; main-thread parsing;
skipped DDL kinds.

**Next:** phase-end bug-bash, then P3-T01.
