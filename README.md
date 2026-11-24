# SchemaFlow

A browser-based, interactive database schema explorer. Import SQL DDL or a Prisma schema and
explore it as a 2D entity relationship diagram. Everything runs locally in the browser: imported
SQL is parsed as text, never executed, and schema data is never sent anywhere.

> Status: Phases 1 and 2 are built: interactive canvas, import, search, full inspector and
> neighbourhood highlighting. Phase 2's final verification is in progress; export and layout
> persistence come in Phase 3. See [docs/development/ROADMAP.md](docs/development/ROADMAP.md).

## What it does

- **Import** SQL DDL (PostgreSQL, MySQL, SQLite — including `pg_dump` and `mysqldump` output) or a
  Prisma schema: paste it, choose a file or drop one (up to 5 MB). The text is tokenized by
  SchemaFlow's own tolerant parsers. It is never executed and never leaves the browser.
  Statements that don't matter for a diagram (data, grants, functions, …) are skipped and
  summarised; problems are listed in an issues panel with line numbers, and one bad statement
  never blocks the rest. PostgreSQL partitions are folded into their partitioned table.
- **Explore** the schema as an auto-laid-out diagram: tables with their columns, keys and
  nullability, and relationships with cardinality. Select a table in the list or on the canvas
  to see its columns, keys and relations in the inspector, follow foreign keys, and dim everything
  outside its 1- or 2-hop neighbourhood.
- **Search** tables and columns (⌘K / Ctrl+K or `/`) and jump to the result; the same dialog runs
  commands (type a few letters, or start with `>`).
- **Keyboard shortcuts** (press `?` for the list): `F` reset view, `L` layout, `[` / `]` table list
  and inspector, `H` health, `E` export, `I` import. Single keys are ignored while typing in a field
  or with a dialog open. On some keyboard layouts `[` and `]` need AltGr.
- **Pick up where you left off.** A reload restores the last schema you imported, the pan and zoom and the selected table.
  `?sample=…` URLs always show that sample.
- Light and dark themes, keyboard navigation, and a phone layout with the panels as sheets.
- Tested on real schemas: GitLab's `structure.sql` (992 tables after folding partitions),
  Sakila, and generated 180-table `mysqldump` and 200-model Prisma files
  (see [tests/fixtures/real/SOURCES.md](tests/fixtures/real/SOURCES.md)).

Large schemas are laid out on the main thread: GitLab's 992 tables take about 3 s on an M1
(the Import button shows "Laying out N tables…" meanwhile).

## Accessibility

- **Keyboard:** Tab reaches every control and every table on the diagram; Enter or Space selects a
  table; `?` lists the shortcuts. A "Skip to diagram" link is the first Tab stop.
- **Screen readers:** panels, dialogs and the diagram are labelled landmarks; tables and
  relationships have accessible names; toolbar buttons keep their names on a phone.
- **Reduced motion** is honoured (animations and viewport transitions are switched off).
- **Automated audit:** an axe-core suite (WCAG 2.0/2.1 A and AA) runs on the main screens in light
  and dark, with zero violations (as of `6230bea`, 2026-11-24; source: `tests/e2e/a11y.spec.ts`).
  It does not replace a manual screen-reader pass, which has not been done.
- **Known limitations:** relationship lines can't be focused with the keyboard (the inspector's
  Relations and Path tabs give the same information), the diagram's spatial layout has no
  non-visual equivalent, and reduced motion is covered by a unit test only.

## Local data

Nothing is uploaded. To restore your work, SchemaFlow keeps on this device only: the text of your last import (IndexedDB), table
positions, collapse modes and pan/zoom per schema, the selected table, and preferences (localStorage). Settings → **Clear saved
data…** (More on phones) removes all of it. If your browser has `BroadcastChannel`, other open tabs stop saving after a clear;
without it, a tab that was already open can write its state back.

## Getting started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script                  | What it does                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Next.js dev server                                                                                                           |
| `npm run build`         | Static export to `out/`                                                                                                      |
| `npm run start`         | Serve the static export in `out/` on port 3000 via `python3 -m http.server` (run `npm run build` first; stop the dev server) |
| `npm run typecheck`     | `tsc --noEmit`                                                                                                               |
| `npm run lint`          | ESLint (flat config)                                                                                                         |
| `npm run format`        | Prettier (with Tailwind class sorting)                                                                                       |
| `npm run test`          | Vitest, single run                                                                                                           |
| `npm run test:coverage` | Vitest with V8 coverage                                                                                                      |
| `npm run check`         | typecheck → lint → test → build, failing fast                                                                                |

Headless checks (need Chrome and a running server): `node scripts/headless/toolbar-width.mjs`
(phone toolbar) and `node scripts/headless/large-schema-perf.mjs` (frame costs on a
2,000-table schema).

### Sample schemas

- `/` loads the built-in e-commerce sample (12 tables).
- `/?sample=synthetic&tables=200` generates a synthetic schema for performance testing
  (`tables` is clamped to 1–1000; add `&seed=7` for a different deterministic graph).

## Documentation

- [Architecture](docs/development/ARCHITECTURE.md)
- [Roadmap](docs/development/ROADMAP.md)
- [Verification](docs/development/VERIFICATION.md) and [QA log](docs/development/QA_LOG.md)
