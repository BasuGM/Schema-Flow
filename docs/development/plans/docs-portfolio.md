# DOC-01 — Portfolio and interview documentation (plan)

Status: **Approved with amendments** (Cowork review at `0ed57d9` + user decisions, 2026-11-24).
Order: P4 bug-fix (QA-041/042) → P4-T06 → **DEPLOY-01** → **DOC-01**. Don't start writing until
the P4 bug-fix and P4-T06 are done.

## Context

SchemaFlow is feature-complete through P4-T04 (Cowork round 28 at `72e2caf`). The engineering
record lives in `docs/development/` (ROADMAP, ARCHITECTURE with ADR-001…037, VERIFICATION, QA_LOG,
plans, handoffs). It is accurate but written for agents, not for a recruiter or interviewer. This
task adds a short, honest public layer on top of it. **Docs only:** no changes to `src/`, `tests/`
or config. The one code addition is `scripts/headless/docs-screenshots.mjs` (docs tooling, decision 4).
New docs summarise and link to `docs/development/`; they never copy long passages.

Ground rules for every file:

- Only things that exist. No backend, API, DB, auth, server caching or logging sections. The one
  "no backend" discussion lives in ARCHITECTURE_OVERVIEW.
- Honesty rule: QA claims only from QA_LOG and actual check runs. Nothing says "verified" unless
  QA_LOG does.
- **Stamps (amendment A):** only volatile numbers (test/e2e counts, QA totals, bundle size, timings)
  carry `(as of <hash at writing time>, <date>; source: <file#anchor> | <command>)`. Stable facts
  (ADR decisions, the 300-table target, thresholds that are constants) carry no stamp.
- **Public wording (amendment B):** name the verifier once per doc as "an independent verification
  pass (Claude Cowork, a separate agent)", then "verification". No internal paths (scratchpad,
  `/home/claude`, `/Users/...`), no session links, no email.
- **Voice (decision 7):** interview docs and LESSONS_LEARNED are first person, in the author's
  voice. Process framing: I planned, directed and reviewed; Claude Code implemented; an independent
  verification pass tested in a browser; every defect was logged and fixed at its root cause.
  Product docs (FEATURES, ARCHITECTURE_OVERVIEW, …) are neutral third person.

## Decisions (user, 2026-11-24)

1. License: **MIT** (holder: Basavachetan Mathapati, year 2026).
2. Live demo: yes, through a separate task, **DEPLOY-01**, before DOC-01: the workflow on Node 22,
   basePath tested with assets + IndexedDB, Pages URL confirmed. Docs link the demo only once it works.
3. README identity: Basavachetan Mathapati · GitHub `BasuGM` · LinkedIn **URL to be supplied by
   the user before WS-A** · no email.
4. Screenshot script is committed as `scripts/headless/docs-screenshots.mjs`.
5. Markdown lint: Prettier only.
6. Placement: DOC-01 after the P4 bug-fix and P4-T06 (DEPLOY-01 in between).
7. AI disclosure: open, framed as above.
8. CONTRIBUTING / CODE_OF_CONDUCT: dropped.

## Corrections to the original proposal (confirmed by review)

1. No "overview mode": ADR-031 rejected the canvas overview. What exists is the lighter zoomed-out
   rendering below `ROW_DETAIL_MIN_ZOOM` = 0.3 (ADR-023 mechanics, `tests/e2e/zoomed-out.spec.ts`).
2. No enforced bundle budget: docs report a measured initial-JS figure (ADR-014 method), stamped,
   and say there's no budget. AC-P2-T05-10 (parsers not in the initial bundle) is the enforced part.
3. QA_LOG severity vocabulary is mixed (format line: blocker/major/minor/cosmetic; Backlog:
   High/Medium/Low; QA-001…017 only in dated entries). QA_REPORT reports totals as recorded, with
   "unclassified" where needed, and doesn't re-grade anything.
4. Deploy issues (Node 20 vs `engines >= 22`, untested basePath) are handled in DEPLOY-01.
5. TECH_STACK is one table + "deliberately not used"; the "why" lives in DECISIONS/ADRs.

## DEPLOY-01 (separate task, own plan via /next; listed here only for ordering)

Workflow on Node 22; basePath with static assets, fixtures/sample URLs and IndexedDB/localStorage
restore tested on the deployed URL; Pages URL confirmed by Cowork. Output: a confirmed URL that
DOC-01 links in README and DEMO_GUIDE. If DEPLOY-01 isn't Verified when DOC-01 starts, the docs
leave the demo out (no placeholder).

## Final file list, outlines and sources

ARCH = `docs/development/ARCHITECTURE.md`, RM = ROADMAP, QA = QA_LOG, VER = VERIFICATION,
HO = `docs/development/handoffs/`.

### 1. `README.md` (rewrite, ≤ ~150 lines)

Title + one-line pitch + hero (`<picture>` light/dark) · live demo link (only if DEPLOY-01 is
Verified) · the problem · key features (8–10 bullets → FEATURES anchors) · privacy model + "Local
data" (kept from the current README) · tech stack line → TECH_STACK · quick start + scripts table
(kept) · status & verification paragraph → QA_REPORT / KNOWN_ISSUES · documentation map (table
of every doc + `docs/development/`) · author (name, GitHub, LinkedIn) · license (MIT).

### 2. `docs/FEATURES.md`

Import & parsers · Canvas (layouts, packed layout, collapse modes, neighbourhood dimming, zoomed-out
rendering) · Inspector · Search + commands · Keyboard shortcuts (from the single shortcut table in
code, ADR-037) · Health checks · Path finder · Subject areas · Export · Session restore & local
data · Themes, accessibility (incl. P4-T06 results), phone layout · Not supported.
Each section: 2–5 bullets + decision link + the verification round link.
Sources: RM, ARCH ADR-012…037, VER, `src/components/*`.

### 3. `docs/USER_FLOWS.md` — 5 journeys, Mermaid each

First look · Import own schema (issues + large-schema notice branch) · Understand a schema (search →
inspector → path → areas) · Review quality (Health → Show table, desktop vs phone branch) · Take it
away & come back (export → reload → restore / clear). Each links its e2e spec.

### 4. `docs/DEMO_GUIDE.md`

- Setup (live demo URL if verified, else production build + `npm run start`; Clear saved data to reset)
- 5-minute script: ecommerce sample → inspect → ⌘K → import `saas-300` → Health → Path → Export Mermaid
- 15-minute script, **≤ 300 tables only** (amendment C): adds an import with issues (Sakila or
  `tests/fixtures/sql` fixture), subject areas, collapse modes, keyboard-only segment, phone layout,
  reload restore
- Appendix "Optional stress demo": GitLab 992 tables (notice, packed layout, ~3 s layout, Reset view
  clipping), labelled outside the envelope and risky live
- If something goes wrong: relevant known issues

### 5. `docs/TECH_STACK.md`

One table: package · version (package.json at writing time) · role · ADR link; "deliberately not
used" (SQL/Prisma parser libs, cmdk, html-to-image, Web Worker) with ADR links; Node ≥ 22.

### 6. `docs/ARCHITECTURE_OVERVIEW.md`

Layers · normalized `Schema` + `schemaToFlow()` · three stores (ADR-008/009) · import pipeline (lazy
parsers, ADR-014) and export pipeline (generators, own SVG renderer, ADR-027) · persistence
(ADR-025/030) · error handling (ImportIssue, boundaries, ADR-020) · **Why there is no backend** ·
diagrams D1, D2, D3, D5 inline. Sources: ARCH "Data flow", "Module boundaries", "Data model",
"State slices"; `src/` tree.

### 7. `docs/DECISIONS.md` — 12 ADR entries

Context · decision · alternatives rejected · trade-off · full ADR link. Candidates: ADR-002,
008+009, 012, 013, 014, 016, 019, 022+023, 024, 025+030, 027, 031, 035, 037. Trimmed to 12,
preferring the ones with measured trade-offs.

### 8. `docs/PERFORMANCE_AND_LIMITS.md`

Envelope (~300 tables, M1 8 GB, `DESIGN_TABLE_LIMIT`) · what keeps it fast (`LARGE_SCHEMA_THRESHOLD`
= 80 → `onlyRenderVisibleElements`, zoomed-out rendering < 0.3, memoed nodes with IDs, per-node
selectors, stroke-opacity dimming, lazy parsers, save on drag stop) · stamped measurements (GitLab
layout, hub select on 2,000 tables, initial JS) · beyond the envelope (notice, known slow cases,
won't-do) · scaling discussion (worker layout, canvas/WebGL, incremental layout: not built, and why)
· how to reproduce (`scripts/headless/large-schema-perf.mjs`, cleanup + load rule).

### 9. `docs/TESTING.md`

Pyramid (unit, jsdom component, perf budgets, Playwright e2e (20+ specs, not in `check`), headless
toolbar-width PASS at 390×844) · how to run each · test rules · verification loop (D4) · stamped
counts (`npx vitest run --reporter=json` → `numTotalTests`; e2e summary line; spec count).

### 10. `docs/QA_REPORT.md`

Method and status vocabulary · per-phase table (rounds, tasks, defects found / verified /
deferred) · **total number of verification rounds** (1–28 + 25b, counted from QA_LOG headings) ·
totals by severity as recorded · **defects found by verification vs by Claude Code / automated
checks** (amendment F), using the Backlog "Found in" column (Cowork round N vs Claude Code bug-bash
vs subagent/tooling). For QA-001…017, if the dated entries don't say who found the defect, report
them as "source not recorded" · notable bugs (5–7) · process defects (round 18 NOT CLOSED,
QA-019 harness gap) · stamp.

### 11. `docs/KNOWN_ISSUES.md`

Open backlog at writing time · accepted known issues per phase close-out (RM) · unsupported by
design · "source of truth: QA_LOG Backlog" · stamp.

### 12. `CHANGELOG.md` (Keep a Changelog)

Phase milestones, not semver (note at the top). `[Unreleased]` = work after the last close-out; one
section per closed phase, **dated from the QA_LOG round that closed it** (amendment E: Phase 1 =
the round that verified `c9c49a3`; Phase 2 = round 13; Phase 3 = round 23; Phase 4 = its close-out
round if it exists by then). Added / Changed / Fixed (QA IDs). Sources: RM, QA headings, `git log`.

### 13. `docs/interview/INTERVIEW_GUIDE.md` (first person)

2-minute pitch · 10-minute walkthrough (demo + architecture beats) · talking points by theme ·
what I'd do next (honestly labelled as not built).

### 14. `docs/interview/PROJECT_QA.md` (first person, sayable aloud; amendment D)

~30 questions in 6 groups. Answers are 2–5 short sentences, each with a source, and claim nothing
I couldn't defend from the code. **5 marked "hard follow-up":** why no backend · why own parsers ·
how do you know it works · what breaks at 1,000 tables · what did AI do vs you.

### 15. `docs/interview/TECHNICAL_CHALLENGES.md` (first person) — 7 stories

Problem → how it showed up → root cause → fix → evidence → lesson: QA-039/040 phone sheet ·
path tie-break determinism (ADR-035) · GitLab tall layout → packed (QA-018/034/035, ADR-031) ·
real-input selection cost and dimmed-edge paint (QA-019/020) · session restore re-parse (ADR-030) ·
cross-dialect export (QA-030/031, ADR-033) · focus loss (QA-027/028, ADR-032). Backup: QA-013.

### 16. `docs/interview/LESSONS_LEARNED.md` (first person)

Technical lessons · process lessons (the decision 7 framing; builder/verifier separation; honesty
rule; batching QA fixes; cutting the overview after prototyping) · what didn't work · what I'd do
differently.

### 17. `LICENSE` — MIT, "Copyright (c) 2026 Basavachetan Mathapati".

## Diagrams (Mermaid, rendered by GitHub, inline)

D1 layers (ARCHITECTURE_OVERVIEW) · D2 import data flow · D3 stores ↔ components · D4 verification
loop sequence (TESTING; LESSONS links to it) · D5 persistence/restore · U1–U5 user journeys.
No backticks or emoji in node labels (QA-032).

## Screenshots (amendment G)

- `scripts/headless/docs-screenshots.mjs` (committed): Playwright Chromium from the installed
  `@playwright/test`, against a production build on a free port, after `scripts/cleanup.sh` and
  load < 4. One browser. Waits on testids/state, never fixed timeouts. **Fixtures and built-in samples
  only, no real schemas** (ecommerce sample, `tests/fixtures/synthetic/saas-300.postgres.sql`,
  `tests/fixtures/sql|prisma`). Writes to `docs/images/`. Usage documented in its header and in TESTING.
- Set: `hero-light.png` + `hero-dark.png` (1440×900, ecommerce, table selected) ·
  `import-issues.png` (a fixture with issues) · `health.png` · `path-finder.png` ·
  `subject-areas.png` (saas-300, 1440×900, mix of light/dark) · `phone.png` (390×844 @2x).
- Total ≤ 1.5 MB; alt text on every image. Cowork checks that the README `<picture>` light/dark
  switch renders on GitHub.

## Keeping numbers from going stale

Volatile numbers live only in TESTING, QA_REPORT, PERFORMANCE_AND_LIMITS and KNOWN_ISSUES, stamped
with the hash at writing time and the date. README and the interview docs link to them and don't
repeat them. Versions appear only in TECH_STACK.

## Workstreams (one commit each; implement on Sonnet; push after each)

Each WS ends with (a) a link check: a throwaway Node script, outside the repo, that resolves every
relative link + `#anchor` in the changed `.md` files using GitHub slug rules; (b) `npx prettier
--check` on the changed files; (c) `git diff --stat`, which may show only `README.md`, `CHANGELOG.md`,
`LICENSE`, `docs/`, `scripts/headless/docs-screenshots.mjs`.

| WS                                                                                            | Commit                                                                   | Files                                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| WS-A                                                                                          | `DOC-01 WS-A: README, features, user flows, demo guide`                  | README.md, docs/FEATURES.md, USER_FLOWS.md, DEMO_GUIDE.md                               |
| WS-B                                                                                          | `DOC-01 WS-B: tech stack, architecture overview, decisions, performance` | docs/TECH_STACK.md, ARCHITECTURE_OVERVIEW.md, DECISIONS.md, PERFORMANCE_AND_LIMITS.md   |
| WS-C                                                                                          | `DOC-01 WS-C: testing, QA report, known issues, changelog`               | docs/TESTING.md, QA_REPORT.md, KNOWN_ISSUES.md, CHANGELOG.md (+ counted vitest/e2e run) |
| WS-D                                                                                          | `DOC-01 WS-D: interview guide, Q&A, challenges, lessons`                 | docs/interview/*.md                                                                     |
| WS-E                                                                                          | `DOC-01 WS-E: screenshots, README images, license, final link check`     | scripts/headless/docs-screenshots.mjs, docs/images/*, README.md, LICENSE                |
| Close                                                                                         | `DOC-01: handoff and bookkeeping`                                        | HO/DOC-01.md, ROADMAP, QA_LOG "Pending — not independently verified"                    |
| `npm run check` runs once before the WS-E commit (it lints the new script) and must be green. |

## Handoff for Cowork (amendment H)

The handoff includes: **20 sampled claims** in a table (claim · doc#section · source file#anchor or
ADR), spread across all docs and including every hard-follow-up answer; the full link-check output;
the Prettier result; the stamped counts and the commands that produced them; the screenshot sizes
(`du -ch`); and `git diff --stat <start>..HEAD`.

## Verification (what Cowork checks)

1. Facts: the 20 claims against their sources, plus a spot check of FEATURES against the production
   build (and the live demo if linked). No backend/API/DB/auth claims, no "overview mode", and the
   shortcut table matches the `?` dialog.
2. Numbers: every volatile number is stamped. Re-running vitest/e2e matches, or differs only by
   later commits. QA_REPORT totals match the QA_LOG Backlog.
3. Honesty: nothing called Verified that QA_LOG doesn't list. Known issues match the Backlog + RM
   close-outs. The demo is linked only if DEPLOY-01 is Verified. The wording rules (amendment B) hold:
   no internal paths, session links or email.
4. Links resolve on GitHub, including into `docs/development/`.
5. All Mermaid blocks render on GitHub. D2 matches the code path.
6. Screenshots are current, fixtures only, ≤ 1.5 MB with alt text, and the `<picture>` switch works on GitHub.
7. Scope: the diff touches only the paths listed above.
   Status after the handoff: "Awaiting Cowork verification".

## Still needed from the user

- LinkedIn URL (before WS-A).

## Done when

All 16 docs, LICENSE, the screenshot script and ≤ 1.5 MB of screenshots are committed and pushed;
every WS link check and Prettier check passes; `npm run check` is green; the diff is in scope; the
handoff (with 20 claims), ROADMAP and QA_LOG are updated; status is "Awaiting Cowork verification".

## On approval (now)

Save this file as `docs/development/plans/docs-portfolio.md`; add DEPLOY-01 and DOC-01 to the
ROADMAP Phase 4 summary in the order P4 bug-fix → P4-T06 → DEPLOY-01 → DOC-01 (status Not started)
and update the Now block "Next" line; commit `DOC-01: plan (approved with amendments)` and push.
No docs writing until the P4 bug-fix and P4-T06 are done.
