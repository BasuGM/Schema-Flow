# Handoff history

One line per handoff, oldest first: file · tasks · outcome. Reconstructed from
[QA_LOG.md](../../QA_LOG.md), [ROADMAP.md](../../ROADMAP.md) and `git log`. Files listed under
"in place" are still in `docs/development/handoffs/`; the rest are in this folder.

1. `P1-T01-T05.md` (in place) · P1-T01…T05 foundation, domain, samples, layout · T04 verified by Cowork 2026-11-13; T01/T02/T03/T05 internal, Self-checked.
2. `P1-final.md` · P1-T06…T09 + T04 browser checks · Cowork 2026-11-13: pass with defects QA-001…003; Phase 1 closed Verified with known issues at `c9c49a3`.
3. `P1-fix-QA-001-003.md` · QA-001/002/003 re-verification · Cowork 2026-11-13: fixes confirmed; new QA-004 found.
4. `P1-fix-QA-004.md` · QA-004 + production build (AC-P1-T09-7) · Cowork round 3: fix confirmed; new QA-005 found.
5. `P1-QA-005.md` · QA-005 + edge selection · fixed; verified at `c9c49a3` (relayed 2026-11-16).
6. `P2-T01-T03.md` · SQL tokenizer, PostgreSQL/MySQL/SQLite parsers · Cowork at `ca08df3`: QA-006/007/008 found.
7. `P2-fix-QA-006-008.md` · QA-006…008 re-verification · Cowork round 5 at `3806424`: fixed; QA-009 found; P2-T01/T02/T03 Verified.
8. `P2-T04.md` · Prisma parser + QA-009 · Cowork round 6 at `c9c49a3`: all pass; QA-010 found; P2-T04 Verified.
9. `P2-T05.md` · Import dialog + QA-010/011/012 · Cowork round 7 at `3a17db4`: all 15 steps pass; QA-013 found; P2-T05 Verified.
10. `P2-fix-QA-013.md` · QA-013 blank-line backtracking · fixed and verified at `83558da`.
11. `P2-T06.md` · Import issues panel · Cowork round 8 at `83558da`: steps 1–14 pass; QA-014/015 found; P2-T06 Verified.
12. `P2-fix-QA-014-015.md` · QA-014/015 re-verification · fixed and verified at `ac91200`.
13. `P2-T07.md` · Search · Cowork round 9 at `ac91200`: steps 1–14 pass; QA-016 found; P2-T07 Verified.
14. `P2-T08.md` · Full inspector + QA-016 · Cowork round 10 at `30260fe`: steps 1–12 pass; QA-017 found; P2-T08 Verified.
15. `P2-T09.md` · Neighbourhood highlighting + QA-017 · Cowork round 11 at `c82ba77`: steps 1–14 pass; QA-017 fixed; P2-T09 Verified.
16. `P2-final.md` (in place) · P2-T10 Phase 2 hardening + regression pass · Cowork round 12 at `40f0d16`: not closed; QA-018 (deferred to P3-T07), QA-019/020/021 found.
17. `P2-T10-r12.md` (in place) · QA-019/020/021 fixes, steps 6–7 on `out-qa/` · Pending — not independently verified.
18. `E2E-01.md` (in place) · Playwright e2e suite (tooling) · Self-checked; Pending — not independently verified.

TODO – verify: the date and commit for entries 3–5 (QA_LOG gives the Cowork round but not every commit); whether QA-011 and QA-012 (found by Claude Code in entry 9) were confirmed by Cowork in round 7.
