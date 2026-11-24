# Environment setup

How to get SchemaFlow running on a development machine. Versions come from
[package.json](../package.json); the full table with sources is in
[VERSION_COMPATIBILITY](VERSION_COMPATIBILITY.md).

## Prerequisites

- **Node.js 22 or newer** (`engines.node` is `>=22`) with the npm that ships with it.
- **Python 3**, only for `npm run start`, which serves the built site.
- **Chrome or Chromium**, only for the browser suite and the headless scripts. Playwright installs
  its own Chromium: `npx playwright install chromium`.
- Git.

The project was developed on a MacBook Air M1 with 8 GB of RAM. Nothing is specific to macOS in the
code, but that is the only machine it has been run on.

## Install and run

```bash
git clone <repository-url> schema-flow
cd schema-flow
npm install
npm run dev        # http://localhost:3000
```

Run at most one dev server, and use `npm run test` (which is `vitest run`) rather than a watcher.

## Environment variables

**None are required, and none are read at run time.** There is no `.env` file, no API key and no
secret. The only variable is the build-time flag `NEXT_PUBLIC_QA_HOOKS=1`, which adds console crash
hooks for one browser test ([ERROR_HANDLING](ERROR_HANDLING.md)). The browser suite reads
`E2E_BASE_URL`, `E2E_WORKERS` and `E2E_QA_HOOKS` ([TESTING](TESTING.md)).

## Commands

| Command                 | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Development server on port 3000                               |
| `npm run build`         | Static export to `out/`                                       |
| `npm run start`         | Serve `out/` on port 3000 with Python's `http.server`         |
| `npm run check`         | Typecheck, lint, test, build; stops at the first failure      |
| `npm run typecheck`     | `tsc --noEmit`                                                |
| `npm run lint`          | ESLint                                                        |
| `npm run test`          | Vitest, one run                                               |
| `npm run test:coverage` | Vitest with a V8 coverage report                              |
| `npm run format`        | Prettier, writing changes (`format:check` only checks)        |
| `npm run e2e`           | Playwright against a served build (see [TESTING](TESTING.md)) |

## Checking the setup

1. `npm run check` finishes green. The unit tests take about a minute on an M1.
2. `npm run dev`, open http://localhost:3000, and see the e-commerce sample diagram.
3. Optional: `npm run build && npm run start`, then `npm run e2e` in another terminal (about two
   minutes).

## Troubleshooting

- **Wrong Node version.** Run `node -v`; anything below 22 will fail on engines or syntax.
- **Port 3000 is busy.** Stop the other server, or serve the build on another port and set
  `E2E_BASE_URL`.
- **Unexpected e2e failures or timings.** Close other browsers and heavy apps first; the perf scripts
  refuse to run when the machine is loaded, and `scripts/cleanup.sh` removes leftover headless
  processes ([PERFORMANCE](PERFORMANCE.md#reproducing-measurements)).
- **Dev numbers look slow.** Dev mode is not representative; measure a production build.
