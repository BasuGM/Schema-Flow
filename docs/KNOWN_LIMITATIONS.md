# Known limitations

Things SchemaFlow does not do, or does only in part, **by design or by scope**. These are not bugs
waiting for a fix. Open bugs are in [KNOWN_ISSUES](KNOWN_ISSUES.md). Sources are the project rules
([CLAUDE.md](../CLAUDE.md)), the [engineering roadmap](development/ROADMAP.md) and the
[architecture decisions](development/ARCHITECTURE.md#decision-index). Stamped 2026-11-24.

## Scope

| Limit                               | Why                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2D only**                         | The diagram is a flat canvas. No 3D view is planned.                                                                                                   |
| **No backend, accounts or sharing** | Everything runs in the browser and schema data never leaves it ([BACKEND_ARCHITECTURE](BACKEND_ARCHITECTURE.md), [AUTHENTICATION](AUTHENTICATION.md)). |
| **No collaboration**                | One person, one tab. There is no live editing, comments or shared links.                                                                               |
| **No live database connection**     | You import SQL or Prisma text. SchemaFlow never connects to a database and never runs the SQL.                                                         |
| **No AI features**                  | None are built.                                                                                                                                        |
| **No schema editing**               | You can move tables, collapse them and re-layout. The diagram shows what you imported; there are no tools to edit tables, columns or relationships.    |
| **No hosted demo**                  | There is no deployment; you run it locally ([DEPLOYMENT](DEPLOYMENT.md)).                                                                              |

## Size

- **Design target: about 300 tables** on a MacBook Air M1 with 8 GB of RAM
  ([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)).
  Above that the app shows a dismissible notice and makes no speed promise.
- **Import is capped at 5 MB.** Larger files are refused with a message.
- **Layout runs on the main thread.** A very large schema blocks the tab while it lays out. A
  2,000-table linear foreign-key chain took over 90 seconds in a test. A guard for this was
  considered and marked **won't do** (scope).
- **Large selections miss the frame goal.** Selecting or deselecting a hub on a 2,000-table stress
  fixture took 34 to 66 ms against a 40 ms goal. This is outside the design target
  ([SCALABILITY](SCALABILITY.md)).
- **Saved layouts are bounded.** Over 1.5 million characters, saved edge routes are dropped and only
  table positions are kept. Export previews are cut at 200,000 characters (the file you download is
  complete).

## Import

- **Dialects:** PostgreSQL, MySQL, SQLite and Prisma. Other databases may partly work but are not
  supported.
- **Skipped on import, and reported:** views, functions, triggers, data statements, expression
  indexes and EXCLUDE constraints. Statements the parser can't read are reported in the Issues
  panel instead of failing the import.
- **Hand-written parsers are tolerant, not complete.** They aim at the DDL that real dumps contain
  ([ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13)),
  not at every corner of each grammar.

## Export

- **Generated SQL is a best effort.** Types are mapped between PostgreSQL, MySQL and SQLite with
  warnings. PostgreSQL-only expressions that can't be rewritten safely are dropped with a warning
  rather than guessed ([ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)).
  Treat the output as a starting point and review it.
- **Four text formats and two images:** SQL, Prisma, Mermaid and JSON; PNG and SVG. PNG size is
  lowered to the browser's canvas limits on big diagrams.

## Canvas

- **A composite foreign key draws as one edge,** anchored at the first column pair; the label lists
  all pairs.
- **Edges can't be focused with the keyboard.** The inspector's Relations and Path tabs give the
  same information.
- **Long-edge routes are not recomputed** when a table in the middle moves, so a route may cross
  it. Top-to-bottom layouts have no routes.
- **Nodes overlap until you press Layout** after changing collapse modes. On the
  GitLab sample the first Headers-only takes about a quarter of a second on an M1.
- **Saved positions are rounded** to whole pixels, so a reload can move a table by up to half a
  pixel.
- **Side-panel widths change** after the window crosses the 900 px breakpoint.

## Accessibility and testing

- No manual screen-reader pass was done, and the diagram's spatial layout has no non-visual
  equivalent beyond the inspector and the table list.
- Tested on desktop Chromium; layout checked at phone width in headless Chromium. Safari, Firefox
  and real phones were not tested ([VERSION_COMPATIBILITY](VERSION_COMPATIBILITY.md)).
- Reduced-motion handling is covered by a unit test only; Cowork couldn't emulate it.

## Project

- **Closed.** Phases 1 to 4 are built and no further work is planned ([ROADMAP](ROADMAP.md)).
  There are no tagged releases ([RELEASE_NOTES](RELEASE_NOTES.md)).
