# Project overview

SchemaFlow is a browser-based database schema explorer. A user imports SQL DDL (PostgreSQL, MySQL,
SQLite) or a Prisma schema and explores it as an interactive 2D entity relationship diagram.

## The problem

Reading a real schema as text is slow. A `pg_dump` or `structure.sql` file lists hundreds of tables
and the relationships are buried in `ALTER TABLE … ADD FOREIGN KEY` statements. Typical diagram tools
either need a live database connection, upload the schema to a server, or lay out large schemas
into an unreadable tangle.

## What SchemaFlow does about it

- Parses the pasted or dropped file **as text** with its own tolerant parsers. Nothing is executed
  and nothing leaves the browser.
- Normalizes every input into one `Schema` model, so the canvas, inspector, search, health checks,
  path finder and exporters all work the same way for every dialect.
- Lays the schema out automatically (Dagre, with a packed layout for large, shallow schemas) and
  keeps the interaction smooth: neighbourhood dimming, a table list, search and keyboard commands.
- Lets the user take the result away again: PNG/SVG images and SQL, Prisma, Mermaid or JSON text.

## Scope

| In scope                                          | Out of scope (by design)             |
| ------------------------------------------------- | ------------------------------------ |
| Up to about 300 tables, on a MacBook Air M1, 8 GB | Live database connections            |
| Import, explore, search, inspect, analyse, export | Accounts, sync or collaboration      |
| Local-only storage, restore after a reload        | Any server, hosted demo or telemetry |
| Light/dark themes, keyboard use, phone layout     | 3D views, AI features                |

The reasoning for the size target is in
[ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07).

## Status

Phases 1 to 4 are built and the project is closed. Each task was implemented by Claude Code and
then tested in a browser by an independent verification pass (Claude Cowork, a separate agent);
defects are logged in the [QA log](development/QA_LOG.md) and the open ones are listed there under
Backlog. See the [roadmap](ROADMAP.md) for what each phase delivered.

## Where to go next

[FEATURES.md](FEATURES.md) · [USER_FLOWS.md](USER_FLOWS.md) · [DEMO_GUIDE.md](DEMO_GUIDE.md) ·
[TECH_STACK.md](TECH_STACK.md) · [engineering docs](development/ARCHITECTURE.md)
