// Registers `alias-resolve.mjs` so plain Node can run TypeScript sources from `src/`:
//   node --import ./scripts/headless/alias-hook.mjs scripts/headless/generate.ts …
import { register } from "node:module";

register("./alias-resolve.mjs", import.meta.url);
