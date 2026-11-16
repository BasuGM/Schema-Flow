import { describe, expect, it } from "vitest";
import { parseSql } from "./parse-sql";

const parse = (sql: string) => parseSql(sql, { now: () => "t" });
const tableIds = (sql: string) => parse(sql).schema?.tableOrder;

describe("PostgreSQL partitions are folded into their parent (ADR-019)", () => {
  const PG_DUMP = `
CREATE SCHEMA parts;
CREATE TABLE users (id bigint NOT NULL);
CREATE TABLE events (id bigint NOT NULL, user_id bigint) PARTITION BY HASH (id);
CREATE TABLE parts.events_00 (id bigint NOT NULL, user_id bigint);
CREATE TABLE parts.events_01 (id bigint NOT NULL, user_id bigint);
CREATE TABLE audit (event_id bigint);
ALTER TABLE ONLY events ATTACH PARTITION parts.events_00 FOR VALUES WITH (modulus 2, remainder 0);
ALTER TABLE ONLY events ATTACH PARTITION parts.events_01 FOR VALUES WITH (modulus 2, remainder 1);
ALTER TABLE ONLY users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
CREATE INDEX events_00_user ON parts.events_00 USING btree (user_id);
CREATE INDEX events_00_lower ON parts.events_00 USING btree (lower((user_id)::text));
ALTER INDEX events_user ATTACH PARTITION parts.events_00_user;
ALTER TABLE ONLY events ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY parts.events_00 ADD CONSTRAINT fk_child FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY audit ADD CONSTRAINT fk_audit FOREIGN KEY (event_id) REFERENCES parts.events_01(id);
`;

  it("keeps only the parent, listing its partitions", () => {
    const result = parse(PG_DUMP);
    expect(result.schema?.tableOrder).toEqual(["public.users", "public.events", "public.audit"]);
    expect(result.schema?.tables["public.events"]?.partitions).toEqual([
      "parts.events_00",
      "parts.events_01",
    ]);
  });

  it("drops FKs, indexes and warnings that belong to a partition and retargets references to it", () => {
    const result = parse(PG_DUMP);
    const rels = Object.values(result.schema!.relationships).map(
      (r) => `${r.name}: ${r.from.tableId} -> ${r.to.tableId}`,
    );
    expect(rels.sort()).toEqual([
      "fk_audit: public.audit -> public.events",
      "fk_user: public.events -> public.users",
    ]);
    const messages = result.issues.map((i) => i.message);
    expect(messages.filter((m) => m.includes("expressions"))).toEqual([]);
    expect(messages.filter((m) => m.includes("ATTACH"))).toEqual([]);
    expect(messages).toContain(
      "Folded 2 partitions into 1 partitioned table; the inspector lists each table's partitions.",
    );
    expect(messages.find((m) => m.startsWith("Skipped"))).toContain("ALTER INDEX ×1");
  });

  it("folds CREATE TABLE … PARTITION OF, including sub-partitions, into the root table", () => {
    const sql = `
CREATE TABLE m (id int, at date) PARTITION BY RANGE (at);
CREATE TABLE m_2024 PARTITION OF m FOR VALUES FROM ('2024-01-01') TO ('2025-01-01') PARTITION BY LIST (id);
CREATE TABLE m_2024_a PARTITION OF m_2024 FOR VALUES IN (1);
CREATE TABLE m_default PARTITION OF m DEFAULT;
`;
    const result = parse(sql);
    expect(result.schema?.tableOrder).toEqual(["public.m"]);
    expect(result.schema?.tables["public.m"]?.partitions).toEqual([
      "m_2024",
      "m_2024_a",
      "m_default",
    ]);
    expect(result.issues.filter((i) => i.message.startsWith("Could not parse"))).toEqual([]);
  });

  it("keeps a partition whose parent is unknown and reports a PARTITION OF orphan", () => {
    const sql = `
CREATE TABLE lone (id int);
ALTER TABLE ONLY missing ATTACH PARTITION lone FOR VALUES IN (1);
CREATE TABLE orphan PARTITION OF missing_too FOR VALUES IN (2);
`;
    expect(tableIds(sql)).toEqual(["public.lone"]);
    expect(parse(sql).issues.map((i) => i.message)).toContain(
      'Partition "orphan" of an unknown table was skipped.',
    );
  });
});

describe("MySQL routines", () => {
  it("counts CREATE DEFINER=… routines as functions and names DEFINER views as views", () => {
    const sql = `
CREATE TABLE a (id int);
CREATE DEFINER=CURRENT_USER PROCEDURE p() SELECT 1;
CREATE DEFINER=\`root\`@\`localhost\` TRIGGER t BEFORE INSERT ON a FOR EACH ROW SET NEW.id = 1;
CREATE DEFINER=CURRENT_USER SQL SECURITY INVOKER VIEW v AS SELECT 1;
`;
    const messages = parseSql(sql, { dialect: "mysql", now: () => "t" }).issues.map(
      (i) => i.message,
    );
    expect(messages).toContain("Skipped unsupported statement: CREATE VIEW.");
    expect(messages.find((m) => m.startsWith("Skipped 2"))).toContain("functions/triggers ×2");
  });

  it("skips mysqldump's version-guarded session statements silently but keeps their DDL", () => {
    const sql = `
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
CREATE TABLE a (
  id int NOT NULL,
  /*!50705 shape GEOMETRY */ /*!50705 NOT NULL,*/
  PRIMARY KEY (id)
);
LOCK TABLES a WRITE;
/*!40000 ALTER TABLE a DISABLE KEYS */;
/*!40000 ALTER TABLE a ENABLE KEYS */;
UNLOCK TABLES;
`;
    const result = parseSql(sql, { dialect: "mysql", now: () => "t" });
    expect(result.schema?.tables["a"]?.columns.map((c) => [c.name, c.nullable])).toEqual([
      ["id", false],
      ["shape", false],
    ]);
    expect(result.issues.map((i) => i.message)).toEqual([
      "Skipped 2 statements not needed for the diagram: LOCK/UNLOCK ×2.",
    ]);
  });
});
