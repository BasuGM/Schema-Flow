# Roadmap

Status vocabulary (exact): `Not started | In progress | Self-checked | Awaiting Cowork verification |
Verified | Verified with known issues | Blocked`. `Verified*` is set only after a Cowork report has
been pasted into a session and logged in [QA_LOG.md](QA_LOG.md).

## Phase 1 — Foundation, model, interactive canvas

| ID     | Task                                  | Status       | Notes                                     |
| ------ | ------------------------------------- | ------------ | ----------------------------------------- |
| P1-T01 | Inspect & scaffold                    | Self-checked | Shell-verifiable only; handoff P1-T01-T05 |
| P1-T02 | Documentation & agent rules           | Self-checked | Docs; handoff P1-T01-T05                  |
| P1-T03 | Domain model                          | Self-checked | Unit tests in src/domain                  |
| P1-T04 | Sample schemas                        | Self-checked | Unit tests; browser check after P1-T06    |
| P1-T05 | Graph transform & layout              | Self-checked | Unit tests in src/graph                   |
| P1-T06 | App shell                             | Not started  |                                           |
| P1-T07 | Custom node & edge                    | Not started  |                                           |
| P1-T08 | Canvas interactions & basic inspector | Not started  |                                           |
| P1-T09 | Hardening                             | Not started  |                                           |

## Phase 2 — Import, search, full inspector (summary)

P2-T01 SQL import · P2-T02 Prisma import · P2-T03 Import dialog · P2-T04 Search ·
P2-T05 Full inspector · P2-T06 Focus/neighbourhood highlighting · P2-T07 Import issue panel.

## Phase 3 — Persistence & export (summary)

P3-T01 Layout persistence (localStorage, keyed by fingerprint) · P3-T02 Per-table collapse modes ·
P3-T03 Image export (PNG/SVG via `html-to-image`) · P3-T04 Schema generators (SQL DDL, Prisma,
Mermaid, JSON) · P3-T05 Export dialog · P3-T06 Session restore.

## Phase 4 — Analysis & polish (summary)

P4-T01 Schema health checks (missing PKs, unindexed FKs, orphan tables, naming) · P4-T02 Path
finder between tables · P4-T03 Subject-area grouping/filtering · P4-T04 Keyboard shortcuts & command
palette · P4-T05 Performance pass for 500+ tables · P4-T06 Accessibility audit & docs site.
