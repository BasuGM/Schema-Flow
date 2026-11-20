# BB-P3: Phase 3 bug-bash

**Summary:** Fixes QA-031…037 (cross-dialect SQL export, Mermaid, MySQL detection, packed layout, min zoom, duplicate testid, CLI usage), adds an in-scope 300-table fixture and automated Phase 3 rows. Status: **Awaiting Cowork verification** (not independently verified).

## Commits (pushed to origin/main)

`7f77306` WS0 fixture + hash guard · `3b431b6` QA-035/036 · `6eeb181` QA-032/033/037 · `94fc5bc` QA-031 (ADR-033) · `f13cc0a` QA-034 · `5faead4` e2e + ADR · docs commit follows (see ROADMAP).

## Files changed (new or notable)

`src/generators/sql/portable-expr.ts` (+ `defaults.ts`, `context.ts`, `generate-sql.ts`, `column-sql.ts`, `type-map.ts`), `src/generators/text/escape.ts`, `src/parsers/detect-format.ts`, `src/graph/layout-packed.ts` (`shelfPack`), `src/components/canvas/zoom-detail.tsx` (`CANVAS_MIN_ZOOM`), `src/components/workspace/workspace.tsx` (panel ids), `scripts/fixtures/gen-saas-300.mjs`, `tests/fixtures/synthetic/saas-300.postgres.sql`, `scripts/headless/sqlite-load.mjs`, `scripts/headless/packed-metrics.ts`, `tests/e2e/bug-bash-p3.spec.ts`.

## How to test

`gen() { node --experimental-transform-types --no-warnings --import ./scripts/headless/alias-hook.mjs scripts/headless/generate.ts "$@"; }` (no sqlite3 CLI needed; `sqlite-load.mjs` uses `node:sqlite`).

| Step                                                                                                                | Expected                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gen tests/fixtures/real/gitlab-structure.postgres.sql sqlite 2>/dev/null \| node scripts/headless/sqlite-load.mjs` | `993 tables created`, exit 0                                                                                                                                                                                                                                               |
| `gen tests/fixtures/synthetic/saas-300.postgres.sql sqlite 2>/dev/null \| node scripts/headless/sqlite-load.mjs`    | `300 tables created`, exit 0                                                                                                                                                                                                                                               |
| `gen <gitlab> sqlite 2>&1 >/dev/null \| grep PostgreSQL-only` (same for `mysql`)                                    | `warning: 218 CHECK constraints use PostgreSQL-only syntax and were left out (e.g. background_operation_jobs.check_22e75767e4).` and `warning: 3 column defaults use PostgreSQL-only syntax and were left out (e.g. namespace_descendants.self_and_descendant_group_ids).` |
| same for saas-300, `sqlite` and `mysql`                                                                             | `warning: 3 CHECK constraints use PostgreSQL-only syntax and were left out (e.g. t022_entity.t022_entity_status_check).`                                                                                                                                                   |
| `gen <gitlab> sqlite \| grep -c '::'`                                                                               | 1 (a `'0.0.0.0/0, ::/0'` string default, inside a literal)                                                                                                                                                                                                                 |
| `gen <gitlab> postgres` / ecommerce / pgdump                                                                        | no "PostgreSQL-only" warning; output unchanged (hashes in `faithful-output.test.ts`)                                                                                                                                                                                       |
| Table `` `back\slash` `` in MySQL → `gen f mermaid` → mmdc                                                          | no `\` in the entity name; mmdc parses (QA-032)                                                                                                                                                                                                                            |
| Import ``CREATE TABLE `we'ird` (id int);``                                                                          | 1 table, 0 errors, dialect MySQL (QA-033)                                                                                                                                                                                                                                  |
| Import GitLab, Reset view at 1280 wide, both panels open                                                            | whole diagram visible, not clipped (QA-035); layout about 20,920 × 14,690 px, the empty band under the first shelf is much smaller (QA-034)                                                                                                                                |
| Import saas-300, `getByTestId("inspector")`                                                                         | one element (QA-036)                                                                                                                                                                                                                                                       |
| `npm run e2e -- bug-bash-p3.spec.ts`                                                                                | 8 passed                                                                                                                                                                                                                                                                   |

Hands-on exploration left for Cowork (≤ 20 min): charter row 2 (export after import/re-import, collapse modes, selection, image export on 180/200 tables) and row 3 (reload after import, after another import, after Clear saved data, `?sample=`). Non-blocking findings → Deferred → P4 bug-fix task.

## ACs met

AC-BB-P3-1…9: yes by automated checks (see VERIFICATION.md); Cowork items: mmdc (AC-2), Reset view at 1280 (AC-5), rows 2–3.

## Results

`npm run check` green. `npm run e2e`: 196 passed, 1 failed, 20 skipped at load ~11 (`import.spec.ts` paste: page did not hydrate); that file plus the new spec re-run at load 4: 50 passed. `toolbar-width.mjs`: PASS light and dark. One unit perf test (`inspector-performance`, 50 ms) failed once at load 11 and passed on re-run.

## Deviations / open items

- QA-033: the first fix (`` `[^`]+` `` anywhere) made GitLab detect as MySQL; narrowed to backtick names after table keywords. Test added.
- Extra fix: `timestamp(6) without time zone` (precision inside the type name) mapped nothing and broke SQLite load.
- `||` is allowed in SQLite expressions only (MySQL: logical OR), so the existing test for `lower('A') || 'b'` now expects that default to be left out for MySQL.
- Whitelist is deliberately small: other functions (e.g. `octet_length`) cause the CHECK to be left out with a warning.
- No open questions for the user.
