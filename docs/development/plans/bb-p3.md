# Plan: BB-P3, Phase 3 bug-bash

## Context

ROADMAP Now: P3-T08 Verified (round 22); **Next: BB-P3**. Scope (2026-11-20): everyday flows only
(import, search, inspect, export, restore) on schemas up to ~300 tables; no extreme-size or perf
sweeps. Six Backlog rows are deferred → BB-P3 (QA-031…036). BB-P3 fixes those, runs a short
exploratory charter on the Phase 3 features, and hands off to Cowork. Copied to
`docs/development/plans/bb-p3.md` at the start of implementation (implement-plan).

Root causes found during planning:

| ID | Root cause | Fix |
| --- | --- | --- |
| QA-031 (Med) | `generate-sql.ts:209` copies source CHECK expressions verbatim; non-literal defaults go through `renderDefault` (`src/generators/sql/defaults.ts`) unchanged. GitLab → SQLite: 1,602 CHECKs, 1,008 use `char_length`, others `num_nonnulls`, `jsonb_typeof`, `cardinality`, `::text` casts, `~`. sqlite3 fails at `char_length`. | New pure `src/generators/sql/portable-expr.ts`: outside string literals, strip `::type` casts (multi-word types, `(n)`, `[]`); SQLite maps `char_length(` → `length(`. Expression is **unportable** if it still contains `::`, `~`/`!~`/`~*`, `[`/`ARRAY`, or a PG-only function (`num_nonnulls`, `num_nulls`, `jsonb_typeof`, `json_typeof`, `cardinality`, `array_position`, `array_length`, `date_trunc`; `octet_length` for SQLite only). Applied only cross-dialect (`!ctx.faithful`): unportable CHECKs are left out; unportable non-literal defaults are left out. One aggregated warning per kind: "N CHECK constraints use PostgreSQL-only syntax and were left out (e.g. table.name)." ADR-033. |
| QA-032 (Low) | `mermaidString` (`src/generators/text/escape.ts:51`) keeps `\` inside quoted entity names; mmdc rejects it. | Replace `\` with `/` in `mermaidString`. |
| QA-033 (Low) | `detectSqlDialect` (`src/parsers/detect-format.ts:27`) recognises MySQL only for `` `\w+` ``, so `` `we'ird` `` is parsed as PostgreSQL and `'` opens a string. The tokenizer itself is fine. | Regex `` /`[^`\r\n]+`/ ``. |
| QA-034 (Low) | `shelfPack` (`src/graph/layout-packed.ts:274`): each shelf is as tall as its tallest box, so one tall thin component leaves an empty band beside it. | Column stacking inside a shelf: after the first box sets the shelf height H, a box goes under the current column when `bottom + gap + h ≤ H` (column width = max of its boxes); otherwise a new column, and a new shelf past `rowWidth`. Measure GitLab box sizes first to confirm. |
| QA-035 (Low) | `minZoom={0.05}` (`src/components/canvas/schema-canvas.tsx:232`); GitLab needs ~0.035 at 718×752. | `minZoom` 0.03 (named constant). Nothing else depends on 0.05 (`ROW_DETAIL_MIN_ZOOM` is 0.3). Re-measure after QA-034; it may fit anyway. |
| QA-036 (Low) | react-resizable-panels 4.22 copies a Panel's `id` into `data-testid`; `workspace.tsx:73/87/92` use ids `tables`, `canvas`, `inspector`. | Rename to `tables-panel`, `canvas-panel`, `inspector-panel`. No code depends on the ids (no saved panel layout). |
| QA-037 (Low, new) | `scripts/headless/generate.ts` header shows the command without `--experimental-transform-types`; as written it crashes (`parse-sql.ts` parameter properties). Handoffs already use the right command. | Fix the header comment. |

## Amendments (Cowork plan review, approved with amendments)

1. **QA-034 is GitLab-only (out of scope):** time-box ~1 h. If column stacking gets complicated →
   "won't do (scope)", keep only QA-035. Whatever lands must not worsen in-scope packed layouts:
   test on a 200–300-table packed schema (saas-300): no overlaps, height and area ≤ before.
2. **New in-scope fixture:** deterministic generator `scripts/fixtures/gen-saas-300.mjs` (seeded,
   pure Node) plus committed output `tests/fixtures/synthetic/saas-300.postgres.sql`: 300 tables in
   3 schemas, 4 wide tables (60–150 columns), ~15% isolated, a composite PK, a self-reference,
   inline and `ALTER TABLE … ADD FOREIGN KEY`, a few `char_length` / `::text` CHECKs. A test asserts
   the generator reproduces the committed file. Used in the WS3 sweep and one e2e smoke (import,
   search, inspect, export, reload).
3. **portable-expr scanner** skips `'…'` strings (with `''` escapes and `E'…'`), `"…"`
   identifiers and `$tag$…$tag$` bodies. Uncertain → leave the CHECK out with a warning; never
   output a half-rewritten expression. `char_length` → `length` only for SQLite. Guard: PG → PG
   (faithful) output byte-identical to before for every fixture (SHA-256 hashes recorded before
   WS3 and asserted in a test). MySQL and SQLite outputs re-imported: table count kept, 0 errors.
4. **SQLite check in vitest via `node:sqlite`** (Node 22.23.5); filter the ExperimentalWarning, no
   CLI fallback.
5. **Charter:** Claude Code automates rows 4–5 and spends at most ~30 min on rows 1–3; Cowork does
   the hands-on exploration of rows 2–3. Non-blocking findings → Deferred → P4 bug-fix task.
6. **Handoff:** exact gen → SQLite command using `node:sqlite` (Cowork's cloud has no sqlite3 CLI;
   ship `scripts/headless/sqlite-load.mjs` that reads DDL from stdin and runs it), fixture paths,
   expected counts (CHECKs left out per dialect, exact warning text). mmdc check for QA-032.

## Workstreams (one commit each, `BB-P3: …`)

0. **Baseline** — record PG → PG output hashes for every fixture (amendment 3) and the current
   packed height/area for saas-300 and GitLab (amendment 1), before any code change. Add the
   saas-300 generator + fixture (amendment 2).

1. **QA-036, QA-035** — panel ids; minZoom constant. Tests: workspace render has exactly one
   `getAllByTestId("inspector")`; e2e strict `page.getByTestId("inspector")` (in WS5 spec).
2. **QA-032, QA-033, QA-037** — escape, detection regex, comment. Tests: `escape.test.ts` (backslash
   → no `\` in entity), `detect-format.test.ts` + parse: `` `we'ird` `` and `` `back\slash` `` →
   mysql, 1 table, 0 errors.
3. **QA-031** — `portable-expr.ts` + wire into CHECK emission and `renderDefault`; warnings.
   Tests: `portable-expr.test.ts` (casts incl. multi-word, casts inside strings untouched like
   `'::/0'`, `char_length` mapping, each unportable marker); new `src/generators/cross-dialect.test.ts`:
   every `tests/fixtures/real/*` plus the e-commerce sample → `sqlite` DDL executes in
   `node:sqlite` `DatabaseSync(':memory:')` with no error; GitLab mysql/sqlite output has no `::`
   or `~` outside strings; re-importing each SQL output keeps the table count with 0 import errors.
   Sweep includes saas-300; PG → PG hash guard; ExperimentalWarning filtered.
4. **QA-034** (time-boxed ~1 h, amendment 1) — shelf stacking; saas-300 no-worse test. Tests: synthetic case (one tall thin box + several short boxes →
   short boxes stacked beside it, total height ≈ tall box); GitLab packed layout: no full-width empty
   horizontal band > 2,000 px, height not larger than before, no node overlap (existing checks stay
   green). QA-035 check in the same test: fit zoom for GitLab bounds at 718×752 ≥ 0.03.
5. **Exploratory charter** (time-boxed, production build on a free port; findings recorded per row
   in the plan file; triage per CLAUDE.md: fix blocking or cheap same-area items, defer the rest →
   P4 bug-fix task):

   | # | Session | What to try |
   | --- | --- | --- |
   | 1 | Cross-dialect export | Covered by the WS3 sweep; also Prisma/Mermaid/JSON re-import of each fixture. |
   | 2 | Export × state | Export after import and re-import, with collapse modes and a selection; preview refreshes; image export on the 180- and 200-table fixtures. |
   | 3 | Restore × import | Reload after import, after importing a different file, after Clear saved data, with `?sample=`; positions, collapse modes, inspector tab; nothing stale. |
   | 4 | Keyboard-only Phase 3 | Export dialog (tabs, Copy, Download, close), Clear saved data dialog, collapse controls; focus returns, visible focus. |
   | 5 | Console + viewports | Console listener on the Phase 3 journey; Export and Clear dialogs at 390 and 1280, light/dark, no overflow. |

   Rows 4–5 (and the QA-036 strict lookup) automated in `tests/e2e/bug-bash-p3.spec.ts` as
   `AC-BB-P3-<n>`; follow `tests/e2e/bug-bash.spec.ts` patterns (console allowlist empty).
6. **Docs** — QA_LOG (entry + Backlog rows → "fixed – pending QA", new rows), VERIFICATION
   `AC-BB-P3-<n>`, ADR-033 + Decision index, ROADMAP Now + BB-P3 line, handoff
   `handoffs/BB-P3.md` (Cowork steps: `npm run e2e`, gen → sqlite3 for GitLab, GitLab Reset view at
   1280 with panels open, mmdc check if available, ≤ 20 min exploration on rows 2–3). Status
   "Awaiting Cowork verification".

## Acceptance criteria

- AC-BB-P3-1 (QA-031): GitLab and every real fixture → SQLite DDL loads in SQLite with no error; a
  warning counts left-out CHECKs; MySQL/SQLite output has no `::`/`~` outside strings.
- AC-BB-P3-2 (QA-032): Mermaid entity names never contain `\`.
- AC-BB-P3-3 (QA-033): backtick names with `'` or `\` import as MySQL, 1 table, 0 errors.
- AC-BB-P3-4 (QA-034): GitLab packed layout has no empty band > 2,000 px, and saas-300 packed is
  no taller/larger with no overlaps — or QA-034 marked "won't do (scope)" after the time-box.
- AC-BB-P3-5 (QA-035): Reset view fits GitLab at 1280 wide with both panels open.
- AC-BB-P3-6 (QA-036): exactly one `data-testid="inspector"`.
- AC-BB-P3-7+: charter rows 4–5 (focus returns; console empty; no overflow); saas-300 e2e smoke
  (import, search, inspect, export, reload).

## Verification (definition of done)

- `npm run check` exit 0 (via check-runner).
- `scripts/cleanup.sh`, `uptime` load < 4, then `npm run e2e` 0 failures (one browser).
- `scripts/headless/toolbar-width.mjs` PASS at 390×844, light and dark.
- `gen tests/fixtures/real/gitlab-structure.postgres.sql sqlite | node scripts/headless/sqlite-load.mjs`
  exits 0 (also with the sqlite3 CLI locally).
- Docs per Workflow rules; commit `BB-P3: …`, push; no stray servers (one dev server at most).

## Checklist

- [ ] WS0 baseline hashes + packed metrics; saas-300 generator + fixture
- [ ] WS1 QA-036, QA-035
- [ ] WS2 QA-032, QA-033, QA-037
- [ ] WS3 QA-031 portable-expr, sweep, PG→PG hash guard, sqlite-load.mjs
- [ ] WS4 QA-034 (time-box ~1 h) or won't do
- [ ] WS5 e2e bug-bash-p3.spec.ts + charter rows 1–3 (≤ 30 min)
- [ ] WS6 docs, ADR-033, handoff, push
- [ ] DoD: check green, e2e 0 failures, toolbar-width PASS, gitlab→sqlite loads
