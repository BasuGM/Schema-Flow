# Release notes

## v0.1.0 — portfolio snapshot (2026-11-24)

SchemaFlow's one release note. No git tag or published package exists; "v0.1.0" is the version in
`package.json`, and this page describes the project as it stands after Cowork round 29 and the
documentation set (DOC-01). The project is closed: Phases 1 to 4 are built and no further work is
planned. There is no hosted demo; you run it locally.

### What it is

A browser-only schema explorer. You import SQL or Prisma text and read it as an interactive
diagram. Imported SQL is parsed as text and never executed, and schema data never leaves the
browser. See the [README](../README.md) and [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md).

### What is in it

- **Import** PostgreSQL, MySQL, SQLite and Prisma, by paste, file or drop (5 MB cap), with a format
  override and an Issues panel for anything skipped or unreadable.
- **Explore** with a canvas of tables and relationships, search for tables and columns, a
  three-tab inspector, neighbourhood dimming, collapse modes, subject areas, a path finder between
  two tables, and health checks.
- **Export** SQL (three dialects), Prisma, Mermaid and JSON, plus PNG and SVG images.
- **Keep your place:** the layout and the last session are saved in your browser and restored on
  reload. Clear saved data removes them.
- **Use it your way:** keyboard shortcuts and a command palette, light and dark themes, phone-width
  layout, and an accessibility pass with axe-core.

The full list is in [FEATURES](FEATURES.md).

### How it was verified

Phases 1 to 4 are **Verified with known issues** by Claude Cowork in a real browser, across 30
reports in the [QA log](development/QA_LOG.md); the latest is round 29 at `64c5aa7`. Of 45
logged defects, 42 are verified and 3 are open ([QA_REPORT](QA_REPORT.md)). The documentation
added after round 29 has had automated link and format checks only, not a Cowork round.

### Known issues and limits

- Three open accessibility defects, won't fix: QA-043, QA-044, QA-045
  ([KNOWN_ISSUES](KNOWN_ISSUES.md)).
- By-design limits: 2D only, about 300 tables, no backend or collaboration, views and functions
  skipped on import ([KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)).
- Tested in desktop Chromium only.

### Run it

Node 22 or newer ([ENVIRONMENT_SETUP](ENVIRONMENT_SETUP.md)):

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # typecheck, lint, test, build
```

### More

[CHANGELOG](../CHANGELOG.md) · [LICENSE](../LICENSE) (MIT)
