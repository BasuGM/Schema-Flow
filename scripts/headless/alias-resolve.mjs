// Node resolve hook: maps the project's `@/…` alias to `src/…` and finds `.ts` / `.tsx` / `index.ts`
// for the extensionless imports the sources use. Type stripping itself is built into Node ≥ 22.18.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../../src/", import.meta.url);
const isFile = (url) => existsSync(fileURLToPath(url)) && statSync(fileURLToPath(url)).isFile();

function withExtension(base) {
  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = pathToFileURL(fileURLToPath(base) + suffix);
    if (isFile(candidate)) return candidate.href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith("@/")) base = new URL(specifier.slice(2), SRC);
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    base = new URL(specifier, context.parentURL);
  }
  if (base && !/\.[cm]?[jt]sx?$/.test(base.pathname)) {
    const url = withExtension(base);
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
