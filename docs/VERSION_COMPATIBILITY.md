# Version compatibility

What SchemaFlow needs to build and run. Ranges are copied from [package.json](../package.json) as
of `72bb28c` (2026-11-24); `package-lock.json` pins the installed versions.

## Build and development

| Requirement       | Version                      | Source                                                                                                                                                           |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | 22 or newer                  | `engines.node` is `>=22`; `@types/node` is `^22.20.5`                                                                                                            |
| npm               | the one shipped with Node 22 | lockfile is `package-lock.json`                                                                                                                                  |
| Python 3          | any recent 3.x               | `npm run start` serves `out/` with `python3 -m http.server` ([ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)) |
| Chrome / Chromium | current stable               | only for the headless scripts and `npm run e2e` (Playwright's Chromium)                                                                                          |

The unused GitHub workflow `.github/workflows/nextjs.yml` targets Node 20, which does not meet
`engines`. See [CI_CD](CI_CD.md).

## Major versions

| Package                    | Version        | Note                                                                                                                         |
| -------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Next.js                    | 16.4.6 (exact) | App Router, static export. It has breaking changes from older majors; the repo's AGENTS.md says to read the bundled docs     |
| React, React DOM           | 19.3.0 (exact) |                                                                                                                              |
| TypeScript                 | `^5`           | TypeScript 7 is not adopted ([ADR-005](development/ARCHITECTURE.md#adr-005--stay-on-typescript-5x-and-eslint-9x-2026-11-13)) |
| ESLint                     | `^9`           | with `eslint-config-next` 16.4.6; ESLint 10 is not adopted (ADR-005)                                                         |
| Tailwind CSS               | `^4.3.5`       | v4, CSS-first config in `globals.css`                                                                                        |
| React Flow (@xyflow/react) | `^12.12.1`     |                                                                                                                              |
| Zustand                    | `^5.1.0`       |                                                                                                                              |
| Vitest                     | `^5.1.0`       | with jsdom `^31.0.1`                                                                                                         |
| Playwright                 | `^1.65.1`      | `@axe-core/playwright` is pinned at 4.11.3                                                                                   |

The compile target is ES2022 (`tsconfig.json`).

## Browser support

SchemaFlow is a client-side app that uses `localStorage`, IndexedDB, SVG and canvas (for PNG
export), CSS media queries, and optionally `BroadcastChannel`.

| Browser                     | Status                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Chromium / Chrome (desktop) | **Tested.** The e2e suite and all manual QA used it                                            |
| Phone widths (390 × 844)    | Layout tested in headless Chromium (`scripts/headless/toolbar-width.mjs`), not on a real phone |
| Safari, Firefox             | **Not tested.** No known failures, no evidence either                                          |

Storage that is blocked or full does not break the app: every access is wrapped and the app works
unsaved ([ADR-025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01)).
Without `BroadcastChannel`, "Clear saved data" cannot stop other open tabs from saving again.
