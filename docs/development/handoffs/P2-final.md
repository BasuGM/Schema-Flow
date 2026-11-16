# P2-final handoff — P2-T10 Phase 2 hardening + Phase 2 regression pass

**Task:** P2-T10 (Phase 2 hardening), with the approved amendments 1–17, and a final regression
pass over Phase 2 (P2-T01…T09) using the new real-world fixtures.

## Pushed commits

| Commit    | Contents                                                                                                                                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2be3530` | Real-world fixtures (GitLab `structure.sql`, Sakila, generated `mysqldump-180` and `large-200.prisma`) with `SOURCES.md`; parser: partitions folded, `DELIMITER`, `/*! */` executable comments, `CREATE DEFINER`, `ALTER INDEX`; qualified table names; import busy state (ADR-019) |
| `70bdf99` | Error boundaries per region, `app/error.tsx`, `app/global-error.tsx`, build-time QA hooks (ADR-020)                                                                                                                                                                                 |
| `9a53579` | Phone table-list sheet (one sheet at a time), Enter on resize separators, `aria-expanded` on panel toggles (ADR-021)                                                                                                                                                                |
| `418c542` | Large-schema frame costs: `scripts/headless/large-schema-perf.mjs`, row level of detail when zoomed out, no centring animation on large zoom jumps, memoized rows and edge paths (ADR-022)                                                                                          |
| `5a92986` | Plain count in the busy label; dialog tests load the lazy parsers up front (fixes a flake under load)                                                                                                                                                                               |
| docs      | README, ARCHITECTURE (ADR-019…022, Phase 2 limitations), ROADMAP, VERIFICATION, QA_LOG, this file (hash in the chat handoff; `git ls-remote origin` shows `main` there, the same as local `HEAD`)                                                                                   |

## Environment

- http://localhost:3000 is the **normal** production static build of `5a92986` (no QA hooks).
- **QA-hook build** (for steps 6–7), from the project root:

  ```sh
  # stop the server on :3000 first
  NEXT_PUBLIC_QA_HOOKS=1 npm run build && npm run start
  # afterwards, restore the normal build:
  npm run build && npm run start
  ```

  In that build the console has `schemaflowQa.crash("<region>")` and `schemaflowQa.heal()`;
  regions: `root`, `app`, `canvas`, `table-list`, `inspector`, `issues`, `search`, `import`.

- Fixtures: `tests/fixtures/real/` (with `SOURCES.md`), `tests/fixtures/sql/`,
  `tests/fixtures/prisma/`, `tests/fixtures/large/`.
- Frame-cost harness: `node scripts/headless/large-schema-perf.mjs` (needs Chrome and the server).

**Acceptance criteria:** AC-P2-T10-1…8 in `docs/development/VERIFICATION.md`, plus the listed
revisions to verified behaviour.

## Fixture counts (from the source files; recount commands in `SOURCES.md`)

| Fixture                         | Tables                                                      | Columns | Relationships                         | Issues by kind (all warnings)                                                                                                             | Parse / layout (M1, Node)       |
| ------------------------------- | ----------------------------------------------------------- | ------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `gitlab-structure.postgres.sql` | 992 (+434 partitions folded into 19 parents; 1426 if shown) | 9982    | 1720 (1726 if partitions were tables) | 140: expression index ×120 · CREATE VIEW ×15 · EXCLUDE ×2 · unsupported ALTER TABLE action ×1 · partitions folded ×1 · skipped summary ×1 | 406 ms / 2521 ms (+ flow 10 ms) |
| `sakila-schema.mysql.sql`       | 16                                                          | 90      | 22                                    | 8: CREATE VIEW ×7 · skipped summary ×1                                                                                                    | 14 ms / 19 ms                   |
| `mysqldump-180.mysql.sql`       | 180                                                         | 1625    | 306 (9 composite)                     | 1: skipped summary (DROP, LOCK/UNLOCK, INSERT)                                                                                            | 57 ms / 236 ms                  |
| `large-200.prisma`              | 220 (200 models + 20 implicit)                              | 1692    | 354                                   | none                                                                                                                                      | 57 ms / 371 ms                  |

GitLab's file is 2.8 MB, under the 5 MB limit, so it is imported whole (not trimmed; the
"over 5 MB" test of amendment 3 doesn't apply). Before ADR-019 it produced 1426 tables and 2,536
warnings (1,871 of them `ALTER INDEX … ATTACH PARTITION`).

## Steps → expected results

### P2-T10

1. **Real fixtures (AC-P2-T10-1).** Import each file in `tests/fixtures/real/` (Choose file).
   → The dialog shows the format and counts above; Import works; the issues panel lists the issues
   above; the console stays empty. On GitLab, select `issue_search_data` → the inspector shows
   "Partitioned · 64 partitions folded in" (expand it: `gitlab_partitions_static.issue_search_data_00`
   …). Search `issue_search_data_00` → no table result (it is folded).
2. **Busy state (AC-P2-T10-2).** Import GitLab. → After Import, the button reads "Laying out 992
   tables…" with a spinner, Cancel is disabled, the dialog can't be closed; after about 3 s (M1)
   the diagram appears. Import `sql/shop.mysql.sql` → it imports instantly as before.
3. **Qualified names.** Import `sql/edge-cases.postgres.sql`. → The canvas and the table list
   show `billing.invoices` (`table-node-billing.invoices`, `table-list-item-billing.invoices`);
   filtering the list with `billing.` shows only it. (Revision: was `invoices`.)
4. **Phone table list (AC-P2-T10-5)**, 390×844, light and dark:
   - tap the table-list toggle → a sheet ≤ 20 rem wide opens over the canvas (not a 0 px panel),
     the toggle has `aria-expanded="true"`, no horizontal scroll;
   - tap `orders` → the sheet closes, `orders` is selected, centred and visible, the inspector
     stays closed, focus is on the toggle;
   - reopen, type in the filter, press Escape → the sheet closes and the selection stays; reopen →
     the filter text is still there; "Close tables" closes it too;
   - open the list, then the inspector → the list closes (and the other way round);
   - at 700 px wide open the list, then widen to 820 px → the list is docked, focus on the toggle,
     no overflow;
   - `node scripts/headless/toolbar-width.mjs` → PASS light and dark.
5. **Enter on separators (AC-P2-T10-6)**, 1280×720: focus "Resize inspector" (Tab), press ← once
   (wider), then Enter → the inspector collapses (content `inert`, `toolbar-toggle-right`
   `aria-expanded="false"`), focus stays on the separator; Enter → it comes back at the wider
   width, not 240 px. Same on "Resize table list" (→ to widen) and, with the issues panel open,
   "Resize issues panel". Arrow keys, Home and End still resize (re-run of AC-P1-T06-10).
6. **Region errors (AC-P2-T10-3)**, QA-hook build. For each region, run
   `schemaflowQa.crash("<region>")` in the console (open the issues panel, search dialog or import
   dialog first for those three; for the inspector select a table):
   - the region shows "The <region> could not be displayed." + message + Try again (`<id>-error`);
     toolbar and other panels keep working;
   - press Try again without healing → the fallback shows again, no freeze or loop;
   - `schemaflowQa.heal()` then Try again → the region is back;
   - inspector sheet (390 px), issues panel/sheet, search and import dialogs: Close and Escape close
     them; focus is on Try again when the region had focus;
   - crash `table-list`, heal, then import any fixture → the list comes back by itself;
   - console: exactly two errors per crash — `Error: QA hook: simulated render error in the
<region> region.` and `SchemaFlow: the <region> could not be displayed.`
7. **App and root errors (AC-P2-T10-4)**, QA-hook build: `crash("app")` → `app-error` page
   ("SchemaFlow hit an unexpected error.", Try again, Reload, in the app's theme); `heal()` + Try
   again → the workspace returns. `crash("root")` → `global-error` (plain page, OS colour scheme);
   `heal()` + Try again → back. Then, in the **normal** build: `typeof schemaflowQa` is
   `"undefined"`.
8. **Frame costs (AC-P2-T10-7).** Run `node scripts/headless/large-schema-perf.mjs` (or measure by
   hand on `tests/fixtures/large/neighbourhood-2000.postgres.sql`). Compare **1 hop against your own
   Off baseline**, not against the M1 numbers. Visual check: at the fitted zoom of that fixture,
   rows show as light bars (`schema-canvas` has `data-zoomed-out`); zoom in past 0.3 → row text
   returns; the sample schema at any zoom, including a phone's fitted 0.23, keeps its row text.
   Picking a far table from the list in that fixture jumps without animation; on the sample,
   centring still animates (reduced motion: no animation anywhere).
9. **README (AC-P2-T10-8).** README describes the features, formats and limits.

### Phase 2 regression pass (one or two checks per task)

10. **P2-T01…T03 (SQL):** import `real/sakila-schema.mysql.sql` → 16 tables, no stray tables from
    the procedures (`DELIMITER`), `address` has a `location` column; import `sql/shop.mysql.sql`
    → still "No issues" (AC-P2-T05 table).
11. **P2-T04 (Prisma):** import `real/large-200.prisma` → 220 tables, no issues; select
    `BillingTransfer` → two relations to `BillingAccount` (named relations).
12. **P2-T05 (dialog):** paste GitLab (it becomes a file card above 1 MB) → parsed counts as above;
    Cancel keeps the draft.
13. **P2-T06 (issues):** after GitLab, the issues panel lists 140 warnings; "Show table" on an
    expression-index warning centres that table.
14. **P2-T07 (search):** in GitLab, search `p_ci_builds` → the exact table ranks first, fuzzy matches after; choosing
    a column centres its row (jump without animation from a zoomed-out view).
15. **P2-T08 (inspector):** in GitLab, select `projects` → Columns / Keys / Relations counts; follow
    an FK link and Back.
16. **P2-T09 (neighbourhood):** in GitLab, select `namespaces` at 1 hop → unrelated tables dim;
    Off → nothing dims. On the sample, the P2-T09 expected sets still hold (`orders` / 1 hop).
17. **Console:** empty throughout steps 1–5 and 8–16 (normal build).

## Claude Code's checks (production build, headless Chrome on the M1; not independent verification)

- `npm run check` passed 3× in a row: 58 files, 399 tests, build ✔ (`5a92986` code).
- QA-hook build: all 8 regions showed their fallback, recovered after `heal()` + Try again; focus
  moved to Try again in the table list, inspector, canvas, search and import (issues kept the
  user's focus, which wasn't in it); two console errors per crash, as listed. `app/error.tsx` and
  `global-error.tsx` both work under static export. The normal build contains neither
  `NEXT_PUBLIC_QA_HOOKS` nor the hook code.
- Enter: inspector 300 → ← → 364 px → Enter → 0 (inert, `aria-expanded="false"`, focus on the
  separator) → Enter → 364 px; table list 260 → 324 → 0 → 324 px; End/Home still resize.
- Phone: list sheet 320 px, 12 items, focus on the sheet, page 390 px wide, light and dark;
  picking `orders` closed it, `orders` fully inside the canvas, inspector sheet absent, focus on
  `toolbar-toggle-left`. Widening 700 → 820 px docked the list at 200 px, not inert, focus on the
  toggle, page 820 px. `toolbar-width.mjs` PASS light and dark.
- Bundle (initial JS): 1,147,345 B raw / 362,838 B gzip, **+12,494 B raw / +4,897 B gzip** since
  P2-T09 (1,134,851 / 357,941). The parsers stay a lazy chunk (39 KB raw / 13 KB gzip).

### Frame costs, raw harness output (M1)

Before (`9a53579` code, built with source maps for profiling):

| Measurement                   | Off                                                                 | 1 hop                                                               |
| ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| select hub                    | 59 ms (worst 59 ms) · 47 ms (worst 47 ms) · 32 ms (worst 32 ms)     | 57 ms (worst 57 ms) · 58 ms (worst 58 ms) · 61 ms (worst 61 ms)     |
| deselect                      | 39 ms (worst 39 ms) · 50 ms (worst 50 ms) · 48 ms (worst 48 ms)     | 67 ms (worst 67 ms) · 60 ms (worst 60 ms) · 47 ms (worst 47 ms)     |
| hub → other                   | 43 ms (worst 43 ms) · 43 ms (worst 43 ms) · 40 ms (worst 40 ms)     | 53 ms (worst 53 ms) · 48 ms (worst 48 ms) · 54 ms (worst 54 ms)     |
| pan, fitted, nothing selected | 30 fps (worst 346 ms) · 30 fps (worst 57 ms) · 29 fps (worst 87 ms) | 30 fps (worst 51 ms) · 32 fps (worst 52 ms) · 34 fps (worst 43 ms)  |
| pan, fitted, hub selected     | 33 fps (worst 45 ms) · 33 fps (worst 41 ms) · 33 fps (worst 41 ms)  | 27 fps (worst 187 ms) · 28 fps (worst 45 ms) · 30 fps (worst 44 ms) |
| list select (centre)          | 25 ms (worst 143 ms) · 25 ms (worst 122 ms) · 21 ms (worst 140 ms)  | 60 ms (worst 351 ms) · 52 ms (worst 267 ms) · 60 ms (worst 230 ms)  |
| pan, zoom 1, t_1500 selected  | 60 fps (worst 22 ms) · 60 fps (worst 23 ms) · 60 fps (worst 23 ms)  | 60 fps (worst 22 ms) · 60 fps (worst 24 ms) · 60 fps (worst 22 ms)  |
| pan, zoom 1, hub selected     | 60 fps (worst 26 ms) · 60 fps (worst 25 ms) · 60 fps (worst 32 ms)  | 60 fps (worst 24 ms) · 60 fps (worst 24 ms) · 60 fps (worst 24 ms)  |

`FAIL` all four budgets (61 ms, 67 ms, 351 ms, 27 fps).

After (`5a92986` code, normal build):

| Measurement                   | Off                                                                | 1 hop                                                               |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| select hub                    | 54 ms (worst 54 ms) · 45 ms (worst 45 ms) · 43 ms (worst 43 ms)    | 52 ms (worst 52 ms) · 53 ms (worst 53 ms) · 68 ms (worst 68 ms)     |
| deselect                      | 49 ms (worst 49 ms) · 48 ms (worst 48 ms) · 37 ms (worst 37 ms)    | 56 ms (worst 56 ms) · 58 ms (worst 58 ms) · 64 ms (worst 64 ms)     |
| hub → other                   | 40 ms (worst 61 ms) · 41 ms (worst 41 ms) · 38 ms (worst 38 ms)    | 47 ms (worst 47 ms) · 50 ms (worst 50 ms) · 40 ms (worst 40 ms)     |
| pan, fitted, nothing selected | 51 fps (worst 99 ms) · 58 fps (worst 38 ms) · 58 fps (worst 39 ms) | 58 fps (worst 40 ms) · 58 fps (worst 39 ms) · 57 fps (worst 38 ms)  |
| pan, fitted, hub selected     | 59 fps (worst 39 ms) · 58 fps (worst 39 ms) · 59 fps (worst 40 ms) | 58 fps (worst 39 ms) · 58 fps (worst 39 ms) · 58 fps (worst 36 ms)  |
| list select (centre)          | 54 ms (worst 54 ms) · 50 ms (worst 50 ms) · 49 ms (worst 49 ms)    | 52 ms (worst 52 ms) · 81 ms (worst 81 ms) · 68 ms (worst 68 ms)     |
| pan, zoom 1, t_1500 selected  | 60 fps (worst 23 ms) · 60 fps (worst 22 ms) · 60 fps (worst 22 ms) | 60 fps (worst 24 ms) · 58 fps (worst 152 ms) · 60 fps (worst 21 ms) |
| pan, zoom 1, hub selected     | 60 fps (worst 32 ms) · 60 fps (worst 25 ms) · 60 fps (worst 32 ms) | 60 fps (worst 25 ms) · 60 fps (worst 48 ms) · 60 fps (worst 26 ms)  |

```
FAIL hub select, first frame ≤ 40 ms (measured 68, 1 hop, worst of 3)
FAIL deselect, first frame ≤ 40 ms (measured 64, 1 hop, worst of 3)
PASS list select, worst centring frame ≤ 100 ms (measured 81, 1 hop, worst of 3)
PASS pan at fitted zoom with hub selected ≥ 45 fps (measured 58, 1 hop, worst of 3)
Console: empty
```

Why select/deselect still miss 40 ms (ADR-022): profiles put ~3 ms in edge re-renders and ~5 ms in
Radix Tabs' style read; the rest is style, paint and layerizing ~500 re-coloured edges and ~150
dimmed tables. The CSS-driven edge state of amendment 13 was therefore **not** done, and
`data-edge-state` / `data-dimmed` are unchanged.

## Known limitations

- The two select/deselect budgets above are not met (52–68 ms at 1 hop on the M1).
- Parsing and layout are on the main thread (GitLab ≈ 3 s behind the busy state; a 2,000-table
  linear FK chain can take over 90 s).
- Views, functions, triggers, expression indexes and EXCLUDE constraints are skipped (reported);
  partition bounds are not shown.
- Intentional changes to verified behaviour: Escape closes the phone inspector sheet;
  non-default-schema tables are named `schema.table` on the canvas and in the list.

## Report format

- For each step and AC: PASS / FAIL / NOT TESTED, with a reason.
- For step 8, the harness output (or your measurements) with your own Off baseline.
- New defects as `QA-018…`, with severity, repro, expected vs actual, and a screenshot.
- Keep what you verified in the running app separate from what you inferred.
- A Phase 2 close-out recommendation: Verified / Verified with known issues (which ones).
