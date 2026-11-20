// Runs SQL read from stdin in an in-memory SQLite database (node:sqlite, Node ≥ 22.5; no sqlite3
// CLI needed). Exit 0 when every statement ran, 1 with the SQLite error otherwise (BB-P3):
//   gen tests/fixtures/real/gitlab-structure.postgres.sql sqlite 2>/dev/null | node scripts/headless/sqlite-load.mjs
// Prints the number of tables created. `gen` is the command in scripts/headless/generate.ts.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// node:sqlite prints an ExperimentalWarning on Node 22; forward every other warning unchanged.
const defaultWarningListeners = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("SQLite")) return;
  for (const listener of defaultWarningListeners) listener(warning);
});
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const db = new DatabaseSync(":memory:");
try {
  db.exec(readFileSync(0, "utf8"));
  const { n } = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get();
  console.log(`${n} tables created`);
} catch (error) {
  console.error(`SQLite error: ${error.message}`);
  process.exit(1);
}
