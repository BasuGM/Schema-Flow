# SchemaFlow

A browser-based, interactive database schema explorer. Import SQL DDL or a Prisma schema and
explore it as a 2D entity relationship diagram. Everything runs locally in the browser: imported
SQL is parsed as text, never executed, and schema data is never sent anywhere.

> Status: Phase 1 (core model, sample schema, interactive canvas). Import arrives in Phase 2.
> See [docs/development/ROADMAP.md](docs/development/ROADMAP.md).

## Getting started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Next.js dev server                                        |
| `npm run build`         | Static export to `out/`                                   |
| `npm run start`         | Serve `out/` on port 3000 (uses `python3 -m http.server`) |
| `npm run typecheck`     | `tsc --noEmit`                                            |
| `npm run lint`          | ESLint (flat config)                                      |
| `npm run format`        | Prettier (with Tailwind class sorting)                    |
| `npm run test`          | Vitest, single run                                        |
| `npm run test:coverage` | Vitest with V8 coverage                                   |
| `npm run check`         | typecheck → lint → test → build, failing fast             |

### Sample schemas

- `/` loads the built-in e-commerce sample (12 tables).
- `/?sample=synthetic&tables=200` generates a synthetic schema for performance testing
  (`tables` is clamped to 1–1000; add `&seed=7` for a different deterministic graph).

## Documentation

- [Architecture](docs/development/ARCHITECTURE.md)
- [Roadmap](docs/development/ROADMAP.md)
- [Verification](docs/development/VERIFICATION.md) and [QA log](docs/development/QA_LOG.md)
