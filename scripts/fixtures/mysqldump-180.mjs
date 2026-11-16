// Generates tests/fixtures/real/mysqldump-180.mysql.sql: a 180-table schema written the way
// `mysqldump --no-create-db` (MySQL 8) writes it. Large permissively licensed MySQL schemas are
// scarce, so this one is synthetic but uses real dump syntax: version comments, DROP TABLE IF
// EXISTS, backticks, inline KEY / CONSTRAINT … FOREIGN KEY lines, ENGINE options, LOCK TABLES with
// INSERT data, and triggers inside DELIMITER ;; blocks. Tables are in alphabetical order, as
// mysqldump writes them, so many foreign keys point at tables declared later.
//
// Deterministic (fixed seed). `node scripts/fixtures/mysqldump-180.mjs` writes the file;
// `--stdout` prints it instead (used by the test that checks the committed file is up to date).
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEED = 20261116;
/** mulberry32: small, fast, deterministic. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODULES = ["acct", "cms", "crm", "hr", "inv", "mkt", "ops", "sales", "ship"];
/** [singular (for `<singular>_id` columns), table suffix]. Index 4 is the composite-key link table. */
const NOUNS = [
  ["account", "accounts"],
  ["contact", "contacts"],
  ["address", "addresses"],
  ["document", "documents"],
  ["account_contact", "account_contacts"],
  ["contact_role", "contact_roles"],
  ["tag", "tags"],
  ["item", "items"],
  ["batch", "batches"],
  ["event", "events"],
  ["invoice", "invoices"],
  ["line", "lines"],
  ["payment", "payments"],
  ["note", "notes"],
  ["attachment", "attachments"],
  ["approval", "approvals"],
  ["schedule", "schedules"],
  ["rate", "rates"],
  ["audit_entry", "audit_entries"],
  ["setting", "settings"],
];
const EXTRA_COLUMNS = [
  "`name` varchar(191) NOT NULL",
  "`code` varchar(32) DEFAULT NULL",
  "`amount` decimal(12,2) NOT NULL DEFAULT '0.00'",
  "`is_active` tinyint(1) NOT NULL DEFAULT '1'",
  "`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft'",
  "`payload` json DEFAULT NULL",
  "`description` text COLLATE utf8mb4_unicode_ci",
  "`starts_on` date DEFAULT NULL",
  "`quantity` int NOT NULL DEFAULT '0'",
  "`ratio` double DEFAULT NULL",
];

export function generate() {
  const random = prng(SEED);
  const pick = (n) => Math.floor(random() * n);
  const tables = [];
  for (const m of MODULES)
    NOUNS.forEach(([, plural], i) => tables.push({ name: `${m}_${plural}`, module: m, index: i }));
  const byName = new Map(tables.map((t) => [t.name, t]));
  const nameOf = (m, i) => `${m}_${NOUNS[i][1]}`;

  for (const t of tables) {
    t.columns = [];
    t.keys = [];
    t.fks = [];
    const linkTable = t.index === 4; // composite-key link table: account × contact
    if (linkTable) {
      t.columns.push(
        "`account_id` bigint unsigned NOT NULL",
        "`contact_id` bigint unsigned NOT NULL",
      );
      t.primary = "PRIMARY KEY (`account_id`,`contact_id`)";
      t.fks.push({
        cols: ["account_id"],
        ref: nameOf(t.module, 0),
        refCols: ["id"],
        del: "CASCADE",
      });
      t.fks.push({
        cols: ["contact_id"],
        ref: nameOf(t.module, 1),
        refCols: ["id"],
        del: "CASCADE",
      });
    } else {
      t.columns.push("`id` bigint unsigned NOT NULL AUTO_INCREMENT");
      t.primary = "PRIMARY KEY (`id`)";
    }
    if (t.index === 5) {
      // Composite foreign key onto the link table.
      t.columns.push(
        "`account_id` bigint unsigned NOT NULL",
        "`contact_id` bigint unsigned NOT NULL",
      );
      t.fks.push({
        cols: ["account_id", "contact_id"],
        ref: nameOf(t.module, 4),
        refCols: ["account_id", "contact_id"],
        del: "CASCADE",
      });
    }
    // Up to two references to earlier tables of the same module, plus a cross-module reference
    // to another module's accounts table for every 3rd table.
    if (t.index > 5) {
      const parents = new Set([pick(t.index), pick(t.index)]);
      for (const p of parents) {
        if (p === 4) continue; // the link table has no `id`
        const col = `${NOUNS[p][0]}_id`;
        const nullable = random() < 0.4;
        t.columns.push(`\`${col}\` bigint unsigned ${nullable ? "DEFAULT NULL" : "NOT NULL"}`);
        t.fks.push({
          cols: [col],
          ref: nameOf(t.module, p),
          refCols: ["id"],
          del: nullable ? "SET NULL" : "RESTRICT",
        });
      }
    }
    if (t.index % 3 === 0 && t.index > 0) {
      const other =
        MODULES[(MODULES.indexOf(t.module) + 1 + pick(MODULES.length - 1)) % MODULES.length];
      t.columns.push("`owner_account_id` bigint unsigned DEFAULT NULL");
      t.fks.push({
        cols: ["owner_account_id"],
        ref: nameOf(other, 0),
        refCols: ["id"],
        del: "SET NULL",
      });
    }
    if (t.index === 13) {
      // Self-reference: notes reply to notes.
      t.columns.push("`parent_id` bigint unsigned DEFAULT NULL");
      t.fks.push({ cols: ["parent_id"], ref: t.name, refCols: ["id"], del: "CASCADE" });
    }
    const extras = 2 + pick(5);
    for (let k = 0; k < extras; k++) {
      const col = EXTRA_COLUMNS[(t.index + k * 3) % EXTRA_COLUMNS.length];
      if (!t.columns.includes(col)) t.columns.push(col);
    }
    if (t.index % 6 === 2) t.columns.push("`note` varchar(255) DEFAULT NULL");
    t.columns.push(
      "`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP",
    );
    if (t.columns.includes("`code` varchar(32) DEFAULT NULL"))
      t.keys.push(`UNIQUE KEY \`${t.name}_code_unique\` (\`code\`)`);
    t.fks.forEach((fk, i) => {
      fk.name = `fk_${t.name}_${i + 1}`;
      if (!linkTable || i > 0)
        t.keys.push(`KEY \`${fk.name}\` (${fk.cols.map((c) => `\`${c}\``).join(",")})`);
    });
  }
  for (const t of tables) for (const fk of t.fks) if (!byName.has(fk.ref)) throw new Error(fk.ref);

  const out = [];
  out.push(
    "-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)",
    "--",
    "-- Host: localhost    Database: northwind_ops",
    "-- ------------------------------------------------------",
    "-- Server version\t8.0.36",
    "-- Generated by scripts/fixtures/mysqldump-180.mjs (synthetic schema, real mysqldump syntax).",
    "",
    "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;",
    "/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;",
    "/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;",
    "/*!50503 SET NAMES utf8mb4 */;",
    "/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;",
    "/*!40103 SET TIME_ZONE='+00:00' */;",
    "/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;",
    "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;",
    "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;",
    "/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;",
    "",
  );
  const sorted = [...tables].sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const t of sorted) {
    const lines = [
      ...t.columns,
      t.primary,
      ...t.keys,
      ...t.fks.map(
        (fk) =>
          `CONSTRAINT \`${fk.name}\` FOREIGN KEY (${fk.cols.map((c) => `\`${c}\``).join(", ")}) REFERENCES \`${fk.ref}\` (${fk.refCols.map((c) => `\`${c}\``).join(", ")}) ON DELETE ${fk.del}`,
      ),
    ];
    out.push(
      "--",
      `-- Table structure for table \`${t.name}\``,
      "--",
      "",
      `DROP TABLE IF EXISTS \`${t.name}\`;`,
      "/*!40101 SET @saved_cs_client     = @@character_set_client */;",
      "/*!50503 SET character_set_client = utf8mb4 */;",
      `CREATE TABLE \`${t.name}\` (`,
      lines.map((l) => `  ${l}`).join(",\n"),
      `) ENGINE=InnoDB AUTO_INCREMENT=${100 + pick(9000)} DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='${t.module.toUpperCase()} ${NOUNS[t.index][1].replace("_", " ")}';`,
      "/*!40101 SET character_set_client = @saved_cs_client */;",
      "",
    );
    if (t.index % 6 === 2) {
      const rows = [1, 2, 3].map(
        (id) => `(${id},'O\\'Brien; Ltd (${t.module})','2026-01-0${id} 00:00:00')`,
      );
      out.push(
        "--",
        `-- Dumping data for table \`${t.name}\``,
        "--",
        "",
        `LOCK TABLES \`${t.name}\` WRITE;`,
        `/*!40000 ALTER TABLE \`${t.name}\` DISABLE KEYS */;`,
        `INSERT INTO \`${t.name}\` (\`id\`, \`note\`, \`created_at\`) VALUES ${rows.join(",")};`,
        `/*!40000 ALTER TABLE \`${t.name}\` ENABLE KEYS */;`,
        "UNLOCK TABLES;",
        "",
      );
    }
    if (t.index === 9) {
      out.push(
        "/*!50003 SET @saved_cs_client      = @@character_set_client */ ;",
        "/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;",
        "DELIMITER ;;",
        `/*!50003 CREATE*/ /*!50017 DEFINER=\`root\`@\`localhost\`*/ /*!50003 TRIGGER \`${t.name}_bi\` BEFORE INSERT ON \`${t.name}\` FOR EACH ROW BEGIN`,
        "  IF NEW.created_at IS NULL THEN SET NEW.created_at = NOW(); END IF;",
        "END */;;",
        "DELIMITER ;",
        "/*!50003 SET sql_mode              = @saved_sql_mode */ ;",
        "",
      );
    }
  }
  out.push(
    "/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;",
    "/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;",
    "/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;",
    "/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;",
    "/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;",
    "/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;",
    "/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;",
    "/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;",
    "",
    "-- Dump completed on 2026-11-16 12:00:00",
    "",
  );
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const text = generate();
  if (process.argv.includes("--stdout")) process.stdout.write(text);
  else
    writeFileSync(
      new URL("../../tests/fixtures/real/mysqldump-180.mysql.sql", import.meta.url),
      text,
    );
}
