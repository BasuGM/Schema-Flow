# DOC-01 — full documentation set (approved plan)

Status: **Approved** (2026-11-24). Replaces the file list in [docs-portfolio.md](docs-portfolio.md);
every other rule there still applies (amendments A–H, honesty rule, stamps on volatile numbers,
first person in the interview docs, no work email, no demo link: there is no deploy).
Docs only. The one non-docs file is `scripts/headless/docs-screenshots.mjs`, excluded by name from
the docs-only diff check.

## Placement

- Repo root: README.md, CHANGELOG.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md.
- `docs/` (flat; diagrams in `docs/diagrams/`, images in `docs/images/`), all `.md`:
  PROJECT_OVERVIEW, FEATURES, USER_FLOWS, DEMO_GUIDE, ROADMAP, TECH_STACK, DEPENDENCIES,
  TECHNICAL_DECISIONS, TRADE_OFFS, VERSION_COMPATIBILITY, ARCHITECTURE, SYSTEM_DESIGN,
  FRONTEND_ARCHITECTURE, BACKEND_ARCHITECTURE, DATABASE_DESIGN, API_DOCUMENTATION, DATA_FLOW,
  AUTHENTICATION, SCALABILITY, SECURITY, PROJECT_STRUCTURE, CODING_STANDARDS, ERROR_HANDLING,
  LOGGING_AND_MONITORING, CACHING_STRATEGY, PERFORMANCE, TESTING, CI_CD, DEPLOYMENT,
  ENVIRONMENT_SETUP, INTERVIEW_GUIDE, PROJECT_Q&A, TECHNICAL_CHALLENGES, DESIGN_DECISIONS,
  TRADE_OFF_ANALYSIS, SCALABILITY_DISCUSSION, KNOWN_LIMITATIONS, LESSONS_LEARNED, QA_REPORT,
  KNOWN_ISSUES, RELEASE_NOTES.
- `docs/ROADMAP.md` and `docs/ARCHITECTURE.md` are public summaries; `docs/development/` stays the
  engineering source of truth and public docs link to it instead of copying it.
- In links, write PROJECT_Q&A.md as `PROJECT_Q%26A.md`.

## File → outline → sources

ARCH = development/ARCHITECTURE.md, RM = development/ROADMAP.md, QA = development/QA_LOG.md,
VER = VERIFICATION.md, HO = handoffs/.

| File                   | Outline                                                                                                                                                    | Sources                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| README.md              | Intro, problem, features, screenshots, stack, architecture, quick start, scripts, Accessibility (honest about QA-043/044/045), docs map linking every file | current README, package.json, RM                             |
| CHANGELOG.md           | Per phase/task, dated from the QA round that closed it, QA IDs; `[Unreleased]`                                                                             | RM, QA headings, `git log`                                   |
| LICENSE                | MIT, © 2026 Basavachetan Mathapati                                                                                                                         | Q2                                                           |
| CONTRIBUTING.md        | Short; solo portfolio project, issues welcome; `npm run check`                                                                                             | CLAUDE.md                                                    |
| CODE_OF_CONDUCT.md     | Short; Contributor Covenant 2.1 by reference; contact: open a GitHub issue or contact the maintainer via GitHub (@BasuGM)                                  | Q3                                                           |
| PROJECT_OVERVIEW       | What, problem, scope, status                                                                                                                               | README, RM                                                   |
| FEATURES               | By area, with ADR links                                                                                                                                    | RM, ARCH, `src/components`                                   |
| USER_FLOWS             | 5 Mermaid journeys, each with its e2e spec                                                                                                                 | `tests/e2e`                                                  |
| DEMO_GUIDE             | Local setup, 5- and 15-minute scripts (≤ 300 tables), stress appendix                                                                                      | fixtures, samples                                            |
| ROADMAP                | Public phase summary linking development/ROADMAP                                                                                                           | RM                                                           |
| TECH_STACK             | One table (package, version, role, ADR) + "deliberately not used"                                                                                          | package.json, ARCH                                           |
| DEPENDENCIES           | Policy, runtime vs dev, what is deliberately absent                                                                                                        | package.json                                                 |
| TECHNICAL_DECISIONS    | Short index of every ADR, one line each                                                                                                                    | ARCH decision index                                          |
| TRADE_OFFS             | Per-choice pros/cons tables                                                                                                                                | ARCH                                                         |
| VERSION_COMPATIBILITY  | Node ≥ 22, major versions, browser support                                                                                                                 | package.json engines                                         |
| ARCHITECTURE           | 10-minute overview with diagrams, including why there is no backend                                                                                        | ARCH, `src/` tree                                            |
| SYSTEM_DESIGN          | Requirements, constraints, components, principles                                                                                                          | CLAUDE.md, ARCH                                              |
| FRONTEND_ARCHITECTURE  | Component tree, three Zustand stores, canvas, single-page routing, feature boundaries                                                                      | `src/components`, `src/stores`, `src/app`                    |
| BACKEND_ARCHITECTURE   | Not applicable (see rules)                                                                                                                                 | ARCH                                                         |
| DATABASE_DESIGN        | Normalized Schema model; localStorage per fingerprint; IndexedDB source text                                                                               | `src/domain/schema/types.ts`, ADR-025/030                    |
| API_DOCUMENTATION      | Not applicable; internal module interfaces and import/export formats                                                                                       | `src/parsers`, `src/generators`, `src/graph`, `src/analysis` |
| DATA_FLOW              | Import → normalize → schemaToFlow → render; export; persistence as sequence diagrams                                                                       | ARCH data flow                                               |
| AUTHENTICATION         | None, why, what Clear saved data does                                                                                                                      | ADR-025/030                                                  |
| SCALABILITY            | Facts: ~300 tables, thresholds, stamped measured numbers                                                                                                   | ARCH, HO, perf scripts                                       |
| SECURITY               | Threat model: untrusted SQL text, 5 MB cap, QA-013 backtracking, no eval, XSS in names, shared-machine storage, dependencies                               | ARCH, QA                                                     |
| PROJECT_STRUCTURE      | Annotated tree                                                                                                                                             | file tree                                                    |
| CODING_STANDARDS       | Condensed project rules                                                                                                                                    | CLAUDE.md                                                    |
| ERROR_HANDLING         | ImportIssue, error boundaries, never throw                                                                                                                 | ADR-020                                                      |
| LOGGING_AND_MONITORING | Not applicable; ImportIssues, error boundaries, issues/health panels, how to debug                                                                         | `src/components`                                             |
| CACHING_STRATEGY       | WeakMap memoisation per schema, lazy parser chunks, browser storage                                                                                        | ADR-014/025                                                  |
| PERFORMANCE            | Techniques, stamped measurements, reproduction                                                                                                             | ADR-022/023/031, perf scripts                                |
| TESTING                | Pyramid, commands, verification loop diagram, stamped counts                                                                                               | vitest/e2e runs, VER                                         |
| CI_CD                  | Local `npm run check` + e2e + Cowork loop; `.github/workflows/nextjs.yml` unused                                                                           | `.github/workflows`                                          |
| DEPLOYMENT             | Static export to `out/`, local serving, how it could be hosted                                                                                             | next config, package.json                                    |
| ENVIRONMENT_SETUP      | Versions from package.json/engines; no env vars                                                                                                            | package.json                                                 |
| INTERVIEW_GUIDE        | First person: 2-minute pitch, 10-minute walkthrough, talking points                                                                                        | README, ARCH                                                 |
| PROJECT_Q&A            | ~30 questions, 5 hard follow-ups (no backend, own parsers, how I know it works, 1,000 tables, AI vs me)                                                    | code, ARCH                                                   |
| TECHNICAL_CHALLENGES   | 7 stories: problem → cause → fix → evidence → lesson                                                                                                       | QA entries, ADRs                                             |
| DESIGN_DECISIONS       | ~10 ADRs in interview form                                                                                                                                 | ARCH                                                         |
| TRADE_OFF_ANALYSIS     | Cross-cutting essay (performance vs maintainability vs scope)                                                                                              | ARCH                                                         |
| SCALABILITY_DISCUSSION | Interview 10× / 100× (worker layout, canvas/WebGL, virtualised list), labelled not built                                                                   | ARCH, perf data                                              |
| KNOWN_LIMITATIONS      | By-design limits (2D only, views/functions skipped, ~300 tables, no collaboration)                                                                         | CLAUDE.md, RM                                                |
| LESSONS_LEARNED        | First person; technical and process lessons                                                                                                                | QA, HO                                                       |
| QA_REPORT              | Method, per-phase and per-severity totals as recorded, found-by split, notable bugs, rounds incl. 25b and 29                                               | QA Backlog and headings                                      |
| KNOWN_ISSUES           | Open QA_LOG items incl. QA-043, QA-044, QA-045 (Open — won't fix, project closed)                                                                          | QA Backlog                                                   |
| RELEASE_NOTES          | One "v0.1.0 — portfolio snapshot" note                                                                                                                     | RM, git                                                      |

## Rules for topics SchemaFlow doesn't have

BACKEND_ARCHITECTURE, API_DOCUMENTATION, AUTHENTICATION, LOGGING_AND_MONITORING, CACHING_STRATEGY,
DEPLOYMENT, CI_CD: each is short and honest. Say what does NOT exist and why (privacy, SQL parsed as
text and never executed, data never leaves the browser, no hosted demo by choice), describe the real
nearest equivalent, and say what it would take if the app ever needed it. Never invent endpoints,
tokens, servers, pipelines or metrics. Equivalents:

- DATABASE_DESIGN = the normalized Schema model and browser storage (ADR-025/030).
- API_DOCUMENTATION = internal module interfaces (parsers, generators, findPath, getSubjectAreas,
  schemaToFlow) and the import/export formats.
- AUTHENTICATION = none, why, what Clear saved data does.
- CACHING_STRATEGY = WeakMap memoisation per schema, lazy parser chunks, browser storage.
- LOGGING_AND_MONITORING = ImportIssues, error boundaries, issues/health panels, how to debug.
- CI_CD = local `npm run check` + e2e + the Cowork verification loop; the unused
  `.github/workflows/nextjs.yml` (Node 20 vs engines >= 22, never confirmed working) is described as unused.
- DEPLOYMENT = static export (`out/`), serving it locally, how it could be hosted.

## Pair splits

- TECHNICAL_DECISIONS = index of every ADR; DESIGN_DECISIONS = deep dive into ~10, interview form.
- TRADE_OFFS = per-choice pros/cons tables; TRADE_OFF_ANALYSIS = cross-cutting essay.
- SCALABILITY = factual limits; SCALABILITY_DISCUSSION = "10× / 100×", labelled as not built.
- KNOWN_ISSUES = open bugs; KNOWN_LIMITATIONS = by-design limits.
- CHANGELOG = per phase/task; RELEASE_NOTES = one v0.1.0 snapshot (no tagged releases exist).
- ARCHITECTURE = 10-minute overview; SYSTEM_DESIGN = requirements, constraints, components,
  principles; FRONTEND_ARCHITECTURE = component tree, stores, canvas, routing, boundaries;
  DATA_FLOW = import → normalize → schemaToFlow → render, export, persistence as sequence diagrams.

## Content rules

README, VERSION_COMPATIBILITY and ENVIRONMENT_SETUP read versions from package.json (ENVIRONMENT_SETUP
lists no env vars and says so). Diagrams: Mermaid in `docs/diagrams/*.md` when used in 2+ docs, else
inline; no backticks or emoji in node labels (QA-032). Screenshots: fixtures only, ≤ 1.5 MB total,
light/dark hero.

## Commits (6–10 files each, pushed)

1. **Done, `97bffee`:** README, PROJECT_OVERVIEW, FEATURES, USER_FLOWS, DEMO_GUIDE, ROADMAP, TECH_STACK, DEPENDENCIES.
2. **Done, `fedbb67`:** TECHNICAL_DECISIONS, TRADE_OFFS, VERSION_COMPATIBILITY, ARCHITECTURE, SYSTEM_DESIGN, FRONTEND_ARCHITECTURE, PROJECT_STRUCTURE, `docs/diagrams/*`.
3. **Done, `f97e849`:** BACKEND_ARCHITECTURE, DATABASE_DESIGN, API_DOCUMENTATION, DATA_FLOW, AUTHENTICATION, LOGGING_AND_MONITORING, CACHING_STRATEGY.
4. **Done, `3e871fb`:** SECURITY, SCALABILITY, PERFORMANCE, ERROR_HANDLING, CODING_STANDARDS, TESTING, CI_CD, DEPLOYMENT, ENVIRONMENT_SETUP.
5. INTERVIEW_GUIDE, PROJECT_Q&A, TECHNICAL_CHALLENGES, DESIGN_DECISIONS, TRADE_OFF_ANALYSIS, SCALABILITY_DISCUSSION, LESSONS_LEARNED.
6. QA_REPORT, KNOWN_ISSUES, KNOWN_LIMITATIONS, CHANGELOG, RELEASE_NOTES, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT.
7. `scripts/headless/docs-screenshots.mjs`, `docs/images/*`, README images and the full docs map, `npm run check`; then handoff `handoffs/DOC-01.md` (20 claims with sources, link-check and Prettier output, screenshot sizes, `npm run check` result) and the ROADMAP Now block "Project closed — DOC-01 Awaiting Cowork verification".

Each commit: link + anchor check, Prettier on the changed `.md`, `git diff --stat` showing docs paths
only (the screenshot script excepted), and a 3-line summary. The README docs map grows as files land.

## Answers (2026-11-24)

- **Q1:** Cowork round 29 logged first (done, `72bb28c`); QA-043/044/045 are Open — won't fix.
- **Q2:** LICENSE MIT, © 2026 Basavachetan Mathapati.
- **Q3:** No email anywhere. CODE_OF_CONDUCT contact: "open a GitHub issue or contact the maintainer
  via GitHub (@BasuGM)". README: GitHub link only, no LinkedIn.
- **Q4:** `scripts/headless/docs-screenshots.mjs` is allowed as the only non-docs file.

Accepted deviations: no demo link (DEPLOY-01 dropped), round counts from QA_LOG headings including
25b and 29, flat `docs/`, no work email or internal paths.
