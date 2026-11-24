# QA report

What testing found, who found it, and what happened to it. Everything here is counted from the
[QA log](development/QA_LOG.md) as recorded; nothing is re-measured. Stamped 2026-11-24, after
Cowork round 29.

## Method

- **Claude Code** implemented each task and ran automated checks (`npm run check`, and `npm run e2e`
  where a task needed it).
- **Claude Cowork**, a separate agent, verified in a real browser against written acceptance
  criteria and reported defects. A task counts as **Verified** only after a Cowork report was pasted
  back and logged; until then it is "Awaiting Cowork verification" ([TESTING](TESTING.md)).
- **Claude Code also ran exploratory bug-bashes** (BB-P2, BB-P3) and a tooling smoke test.
- The log has **30 Cowork reports**: rounds 1 to 29 plus round 25b. Rounds 1 to 3 are not numbered
  in the log headings.
- No separate human QA is recorded in the log. Verification status comes from the Cowork reports
  that were pasted back.

## Totals

45 items, QA-001 to QA-045: **42 verified, 3 open** (QA-043, QA-044, QA-045, won't fix because the
project is closed). QA-042 is counted as verified, partly: its remainder became QA-043.

The log used two severity scales and this report keeps them as recorded. QA-001 to QA-017 were
rated blocker / major / minor / trivial; from QA-018 on, High / Medium / Low.

| Scale as recorded          | Count | Items                                                          |
| -------------------------- | ----: | -------------------------------------------------------------- |
| Early scale, QA-001 to 017 |    17 | major 4, minor 11 (two of them cosmetic), trivial 2, blocker 0 |
| Later scale, QA-018 to 045 |    28 | High 1, Medium 10 (three of them accessibility), Low 17        |

Accessibility items are tagged "(a11y)" in the log for QA-016, QA-017 and QA-025 to QA-029; QA-043
to QA-045 are accessibility defects too but carry no tag.

### By phase

The phase is the one under test when the defect was reported. The first two rounds sit in Phase 1;
round 4 covered Phase 1 and Phase 2 work, and QA-006 is counted in Phase 1 because it is about edge
labels from P1-T07.

| Phase                                   | Items            | Count | Open |
| --------------------------------------- | ---------------- | ----: | ---: |
| 1 Foundation, model, canvas             | QA-001 to QA-006 |     6 |    0 |
| 2 Import, search, inspector (and tools) | QA-007 to QA-029 |    23 |    0 |
| 3 Persistence and export                | QA-030 to QA-038 |     9 |    0 |
| 4 Analysis and polish                   | QA-039 to QA-045 |     7 |    3 |

Phase 2 includes the tooling item QA-022 and the bug-bash items QA-024 to QA-026.

### By severity, later scale (QA-018 to QA-045)

| Phase | High | Medium | Low | Total |
| ----- | ---: | -----: | --: | ----: |
| 2     |    0 |      7 |   5 |    12 |
| 3     |    1 |      1 |   7 |     9 |
| 4     |    0 |      2 |   5 |     7 |
| All   |    1 |     10 |  17 |    28 |

### Found by

| Who                                         | Count | Items                                                  |
| ------------------------------------------- | ----: | ------------------------------------------------------ |
| Claude Cowork (browser verification rounds) |    38 | all others                                             |
| Claude Code (own testing)                   |     7 | QA-011, QA-012, QA-022, QA-024, QA-025, QA-026, QA-037 |

QA-022 came from a subagent smoke test of the check runner, and QA-024 to QA-026 and QA-037 from
the Claude Code bug-bashes. QA-011 and QA-012 came from Claude Code's own testing while it built
P2-T05. Cowork's rounds found everything else, including one defect in code that was already
there (QA-033, the MySQL parser and backtick identifiers).

## Notable bugs

| ID             | Severity | What happened                                                                                                           | Outcome                                                                                                                                                                                                                    |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-013         | major    | Long runs of blank lines froze the tab through a backtracking regex in the tokenizer.                                   | Fixed, verified in round 8; led to an audit of all regexes ([LESSONS_LEARNED](LESSONS_LEARNED.md)).                                                                                                                        |
| QA-030         | High     | PostgreSQL defaults with a multi-word cast type were truncated, so every generated SQL target carried `DEFAULT (''::)`. | Fixed, verified in round 19. The only High item.                                                                                                                                                                           |
| QA-031         | Medium   | PostgreSQL casts and operators were copied into SQLite and MySQL exports, so GitLab to SQLite failed to load.           | Fixed in BB-P3 ([ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)), verified in round 23.                                                                |
| QA-007, QA-008 | major    | A leading byte-order mark broke parsing; one untyped column failed a whole table.                                       | Fixed, verified in round 5.                                                                                                                                                                                                |
| QA-011         | major    | Format detection looked only at the first 200,000 characters.                                                           | Fixed (whole text, about 1 ms per MB).                                                                                                                                                                                     |
| QA-019         | Medium   | The first performance harness used synthetic clicks and missed the real-input cost of select and deselect.              | Harness changed to real input; verified in round 13 ([ADR-023](development/ARCHITECTURE.md#adr-023--real-input-selection-costs-lighter-zoomed-out-canvas-edge-dimming-packed-layout-deferred-2026-11-19-p2-t10-round-12)). |
| QA-040         | Medium   | On a phone, Show table put a fitting table's header under the toolbar.                                                  | Fixed, verified in round 25b.                                                                                                                                                                                              |
| QA-044         | Medium   | Destructive button contrast 3.79 (light) and 4.28 (dark), below 4.5.                                                    | **Open, won't fix** ([KNOWN_ISSUES](KNOWN_ISSUES.md)).                                                                                                                                                                     |

## Rounds worth knowing

- **Round 18** (P3-T04) ended "NOT CLOSED": the generators had a High defect (QA-030) and a Medium
  one (QA-031). Round 19 verified the fix for QA-030 and closed P3-T04 and P3-T05.
- **Round 25b** re-verified P4-T07 after the fix for QA-040, which round 25 had found, and closed
  it.
- **Round 29** (P4-BF and P4-T06, at `64c5aa7`) verified QA-041 and QA-042 in part, passed the
  six accessibility acceptance criteria, and logged QA-043, QA-044 and QA-045. Its full end-to-end
  run was 233 passed, 1 failed (the flaky dark-mode dialog check of QA-045), 20 skipped. No code
  changed in that round.

## What this report does not claim

- **No manual screen-reader pass** was done; the accessibility result is axe-core plus Cowork's
  checks.
- **Chromium only.** No other browsers and no real mobile devices were tested.
- **The documentation set (DOC-01) is not covered** by any Cowork round. Its status is "Awaiting
  Cowork verification".
- The counts above come from the log's own headings and Backlog table. If the log is edited, this
  page can go stale.

## See also

[KNOWN_ISSUES](KNOWN_ISSUES.md) · [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md) ·
[TESTING](TESTING.md) · [QA log](development/QA_LOG.md) ·
[Verification procedure](development/VERIFICATION.md)
