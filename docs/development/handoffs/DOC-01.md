# DOC-01: full documentation set

**Summary:** 45 docs files, 7 commits, plus a screenshot script and 7 images. Docs only; the one
non-docs file is `scripts/headless/docs-screenshots.mjs`.
Status: **Awaiting Cowork verification** (not independently verified).

## Commits

1 `97bffee`, 2 `fedbb67`, 3 `f97e849`, 4 `3e871fb`, 5 `d0eedd2`, 6 `9f96fb3`, 7 = this commit
(hash in `git log`). Commits 1 to 6 are pushed.

## Files changed (commit 7)

`scripts/headless/docs-screenshots.mjs`, `docs/images/*.png` (7), `README.md` (hero `<picture>`,
Screenshots section), this handoff, ROADMAP Now block, plan status.

## Screenshots

Fixtures only, production build served on :3100, one Chromium, waits on testids. Captured at `1ba8bef`.

| Image                | Size      | Shows                             |
| -------------------- | --------- | --------------------------------- |
| hero-light/-dark.png | 144K each | ecommerce sample, orders selected |
| import-issues.png    | 100K      | edge-cases fixture, Issues panel  |
| health.png           | 108K      | health fixture, Health panel      |
| path-finder.png      | 144K      | reviews to coupons, 3 hops        |
| subject-areas.png    | 140K      | saas-300, billing hidden          |
| phone.png            | 32K       | 390×844                           |

`du -ch docs/images/*`: **812K total** (budget 1.5 MB). Each image has alt text and a caption with the
commit stamp in the README.

## Checks

| Check                                                                     | Result                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `npm run check` (typecheck, lint, test, build)                            | green; 107 test files, 863 tests passing                      |
| Prettier on README.md and the script                                      | unchanged / clean                                             |
| Link check (README, `docs/*.md`, root `.md`; local links and image paths) | 0 broken, 0 forward                                           |
| `scripts/cleanup.sh`, load before run                                     | load 2.25 at start; screenshot run warned 4.6 (below 8 cores) |

The link check also flagged 35 old plan files and `handoffs/P4-T04.md` (relative source paths written
without a link target, plus `plans/p4-t04.md`); those predate DOC-01 and are outside its scope.

## 20 claims with sources

| #   | Claim                                                     | Source                                                    |
| --- | --------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Static export, no backend                                 | ARCHITECTURE.md#adr-002                                   |
| 2   | Next.js 16.4.6, React 19.3.0, zustand 5, @xyflow/react 12 | package.json                                              |
| 3   | Node 22 or newer                                          | docs/VERSION_COMPATIBILITY.md, `engines.node`             |
| 4   | Hand-written tolerant DDL parser                          | ARCHITECTURE.md#adr-012                                   |
| 5   | Hand-written Prisma parser                                | ARCHITECTURE.md#adr-013                                   |
| 6   | Parsers run on the main thread, no worker                 | ARCHITECTURE.md#adr-014                                   |
| 7   | Selection owned by ui-store                               | ARCHITECTURE.md#adr-008                                   |
| 8   | Layouts in localStorage, per fingerprint, LRU 20          | ARCHITECTURE.md#adr-025, docs/CACHING_STRATEGY.md         |
| 9   | Image export uses an own SVG renderer                     | ARCHITECTURE.md#adr-027                                   |
| 10  | Import capped at 5 MB                                     | docs/KNOWN_LIMITATIONS.md                                 |
| 11  | Design target about 300 tables on an M1 with 8 GB         | docs/SCALABILITY.md, CLAUDE.md Scope                      |
| 12  | 2,000-table chain layout took over 90 s; guard won't do   | docs/KNOWN_LIMITATIONS.md, ROADMAP Now (Scope 2026-11-20) |
| 13  | Repo sets no CSP or headers                               | docs/SECURITY.md                                          |
| 14  | 107 test files, 863 tests passing                         | docs/TESTING.md, `npm test` today                         |
| 15  | 254 e2e tests                                             | docs/TESTING.md                                           |
| 16  | 30 Cowork reports (rounds 1 to 29 plus 25b)               | docs/QA_REPORT.md                                         |
| 17  | QA-043 wrong shortcut hint on Windows/Linux (Low)         | QA-043, docs/KNOWN_ISSUES.md                              |
| 18  | QA-044 destructive-button contrast below 4.5:1 (Medium)   | QA-044, docs/KNOWN_ISSUES.md                              |
| 19  | QA-045 flaky a11y suite, gaps in coverage (Low)           | QA-045, docs/KNOWN_ISSUES.md                              |
| 20  | No tagged releases; v0.1.0 snapshot only                  | docs/RELEASE_NOTES.md, CHANGELOG.md                       |

Claims 1 to 13 and 17 to 19 were re-read in their sources this session; 14 was re-run (`npm test`);
15, 16 and 20 were not re-derived in commit 7 and rest on the commit 4 to 6 docs.

## Notes

- `.github/workflows/nextjs.yml` is **unused** (Node 20 vs `engines` >= 22, never confirmed working);
  docs/CI_CD.md and docs/VERSION_COMPATIBILITY.md say so.
- GitHub rendering of the hero `<picture>` could not be checked from here (no hosted view before the
  push). Check it on the repo page after the push; the `<img>` fallback is the light image.
- Voice edits: none.

## Open items

QA-043, QA-044, QA-045 (open, won't fix). No deviations from the plan.
