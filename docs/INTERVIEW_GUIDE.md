# Interview guide

This is my own prep sheet for talking about SchemaFlow. It is in first person on purpose. Every
claim in it can be checked in the repo. Stamped 2026-11-24; numbers drift as the code changes.

Related: [PROJECT_Q&A](PROJECT_Q%26A.md) (questions and answers),
[TECHNICAL_CHALLENGES](TECHNICAL_CHALLENGES.md) (seven stories),
[DESIGN_DECISIONS](DESIGN_DECISIONS.md) (ten decisions),
[LESSONS_LEARNED](LESSONS_LEARNED.md), [DEMO_GUIDE](DEMO_GUIDE.md).

## How I describe my role

I say this early and plainly, so nobody has to ask.

- **I** planned the work, set the scope, made the calls and reviewed the results.
- **Claude Code** implemented the code and ran the automated checks.
- **Claude Cowork**, a separate agent, verified the app in a real browser and reported defects.
- Every defect was logged in the [QA log](development/QA_LOG.md) and fixed at the root cause, or
  recorded as a known issue ([KNOWN_ISSUES](KNOWN_ISSUES.md)).

I do not say "I wrote every line". I say "I directed it, and I can explain and defend it".

## The 2-minute pitch

SchemaFlow is a database schema explorer that runs in the browser. You paste SQL or a Prisma
schema, and you get an interactive diagram of the tables and their relationships.

The SQL is read as text. It is never executed. Nothing leaves the browser. There is no backend,
by choice. That is the privacy story.

I wrote my own parsers for SQL and Prisma, because the library I tried rejected whole tables from
a normal `pg_dump`. They are tolerant: a bad statement becomes a warning with a line number, not a
lost import.

You can search, inspect a table, find the shortest path between two tables, group tables into
subject areas, run health checks, and export the diagram as an image or as SQL, Prisma, Mermaid or
JSON. It is built for about 300 tables, on a MacBook Air M1.

I built it with AI. I planned and reviewed. Claude Code wrote the code. A second agent, Cowork,
tested it in a browser. The test record is public: 29 verification rounds and 45 logged QA items.
Three accessibility issues are still open, and I say so in the README.

## The 10-minute walkthrough

| Minutes | What I show or say                                                                         | Where it is in the repo                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–1     | The problem and the privacy choice. Load the sample.                                       | [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md)                                                                                                       |
| 1–3     | Import a SQL file. Show the issues panel with a line-numbered warning.                     | [DATA_FLOW](DATA_FLOW.md), [ERROR_HANDLING](ERROR_HANDLING.md)                                                                                |
| 3–5     | Click a table: neighbourhood highlight, inspector tabs, relations. Search with `Cmd+K`.    | [FEATURES](FEATURES.md)                                                                                                                       |
| 5–6     | Path finder between two tables. Subject areas. Health checks.                              | [ADR-035](development/ARCHITECTURE.md#adr-035--path-finder-in-an-inspector-tab-2026-11-23-p4-t02)                                             |
| 6–7     | Export: image, then SQL for another dialect, and the warning it shows.                     | [ADR-028](development/ARCHITECTURE.md#adr-028--text-generators-sql-prisma-mermaid-json-with-warnings-and-fixed-point-tests-2026-11-19-p3-t04) |
| 7–8     | Architecture on one slide: pure TypeScript core, three stores, React Flow only renders.    | [ARCHITECTURE](ARCHITECTURE.md), [diagrams](diagrams/module-boundaries.md)                                                                    |
| 8–9     | How I know it works: `npm run check`, unit tests, e2e, Cowork rounds.                      | [TESTING](TESTING.md)                                                                                                                         |
| 9–10    | The limits, said first: about 300 tables, three open accessibility issues, no hosted demo. | [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md), [KNOWN_ISSUES](KNOWN_ISSUES.md)                                                                    |

The step-by-step demo scripts (5 and 15 minutes) are in [DEMO_GUIDE](DEMO_GUIDE.md).

## Talking points

- **Why no backend?** Privacy and simplicity. Schema text can be sensitive. A static export means
  nothing to secure or run ([ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)).
- **Why my own parsers?** The library I probed failed whole `CREATE TABLE`s on enum types,
  identity columns and column-less `REFERENCES`. I chose tolerant parsing
  ([ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13)).
- **Why a pure core?** `src/domain`, `src/graph`, `src/parsers`, `src/analysis` and
  `src/generators` have no React or browser imports. They are easy to test, and they are
  [checked by module boundaries](ARCHITECTURE.md).
- **How do I know it works?** Layers: `npm run check` (typecheck, lint, 863 unit tests, build),
  254 e2e tests, and independent browser verification. See [TESTING](TESTING.md).
- **What did the process catch?** A regex that froze the tab on blank lines (QA-013). Edges drawn
  behind tables (QA-001). Icon-only buttons with no accessible name. Stories in
  [TECHNICAL_CHALLENGES](TECHNICAL_CHALLENGES.md).
- **What is honest about the limits?** Built for about 300 tables. Beyond that it works but is not
  tuned. The 40 ms selection goal at 2,000 tables was **not met**
  ([SCALABILITY](SCALABILITY.md)).
- **What would I do next?** Move layout off the main thread, then a virtualised table list. Both
  are labelled "not built" in [SCALABILITY_DISCUSSION](SCALABILITY_DISCUSSION.md).

## Numbers I can quote

All stamped 2026-11-24, from the project's own records.

| Fact                               | Value                                                                      | Source                                          |
| ---------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Build period                       | 2026-11-13 to 2026-11-24, 143 commits                                      | `git log`                                       |
| Unit tests                         | 863 in 107 files, passing at `f66a33c`                                     | [TESTING](TESTING.md#counts)                    |
| e2e tests                          | 254; Cowork round 29 at `64c5aa7`: 233 passed, 1 flaky failure, 20 skipped | [TESTING](TESTING.md#counts)                    |
| QA items logged                    | 45 (QA-001 to QA-045); 3 open, won't fix                                   | [QA log Backlog](development/QA_LOG.md#backlog) |
| Source size (non-test TypeScript)  | about 17,900 lines in `src/`                                               | `src/`, counted 2026-11-24                      |
| Design target                      | about 300 tables                                                           | [SCALABILITY](SCALABILITY.md)                   |
| GitLab sample (992 tables), layout | about 3–4.6 s, packed to about 20,480 × 17,688 px                          | ADR-031                                         |

## Things I never say

- That a person tested it. The record shows Cowork reports, not a user study.
- That it is accessible "everywhere". Axe found zero violations on ten covered states; QA-043,
  QA-044 and QA-045 are open.
- That it scales to thousands of tables. It does not claim to.
- That a feature exists when it is only in [SCALABILITY_DISCUSSION](SCALABILITY_DISCUSSION.md).
