// Generates tests/fixtures/real/large-200.prisma: a 200-model Prisma schema (PostgreSQL) in the
// style of large production schemas. Large permissively licensed Prisma schemas are scarce, so
// this one is synthetic but exercises real syntax: @@map/@map, enums with @map, composite @@id
// and @@unique, composite foreign keys, named relations (two relations between the same models),
// self-relations, implicit many-to-many lists, @@index, and doc comments.
//
// Every model with a foreign key has `fields: [...]` in exactly one @relation per foreign key, and
// every implicit many-to-many pair is preceded by a `// implicit many-to-many` comment, so the
// expected counts can be recounted with grep (see tests/fixtures/real/SOURCES.md).
//
// Deterministic (fixed seed). `node scripts/fixtures/prisma-200.mjs` writes the file; `--stdout`
// prints it instead (used by the test that checks the committed file is up to date).
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEED = 20261117;
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

const MODULES = [
  "Billing",
  "Catalog",
  "Crm",
  "Hr",
  "Inventory",
  "Ledger",
  "Marketing",
  "Ops",
  "Support",
  "Shipping",
];
/** Index 4 has a composite @@id; index 5 references it with a composite foreign key. */
const NOUNS = [
  "Account",
  "Member",
  "Profile",
  "Document",
  "Membership",
  "MembershipGrant",
  "Tag",
  "Item",
  "Batch",
  "Event",
  "Invoice",
  "Line",
  "Payment",
  "Note",
  "Attachment",
  "Approval",
  "Schedule",
  "Rate",
  "Transfer",
  "Setting",
];
const SCALARS = [
  ["name", "String"],
  ["code", "String?", '@map("code_value")'],
  ["amount", "Decimal", "@default(0) @db.Decimal(12, 2)"],
  ["isActive", "Boolean", '@default(true) @map("is_active")'],
  ["payload", "Json?"],
  ["description", "String?", "@db.Text"],
  ["startsOn", "DateTime?", '@map("starts_on") @db.Date'],
  ["quantity", "Int", "@default(0)"],
];

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);

export function generate() {
  const random = prng(SEED);
  const pick = (n) => Math.floor(random() * n);
  const models = new Map();
  for (const m of MODULES)
    NOUNS.forEach((noun, i) =>
      models.set(`${m}${noun}`, { name: `${m}${noun}`, module: m, index: i, lines: [], tail: [] }),
    );
  const modelOf = (m, i) => models.get(`${m}${NOUNS[i]}`);
  const back = (parent, line) => parent.lines.push(line);

  for (const model of models.values()) {
    const { module: m, index: i, lines, tail } = model;
    if (i === 4) {
      const a = modelOf(m, 0);
      const b = modelOf(m, 1);
      lines.push(
        '  accountId Int     @map("account_id")',
        '  memberId  Int     @map("member_id")',
        `  account   ${a.name} @relation(fields: [accountId], references: [id], onDelete: Cascade)`,
        `  member    ${b.name} @relation(fields: [memberId], references: [id], onDelete: Cascade)`,
        `  grants    ${modelOf(m, 5).name}[]`,
      );
      back(a, `  memberships ${model.name}[]`);
      back(b, `  memberships ${model.name}[]`);
      tail.push("  @@id([accountId, memberId])");
    } else {
      lines.push("  id        Int      @id @default(autoincrement())");
    }
    if (i === 5) {
      const target = modelOf(m, 4);
      lines.push(
        '  accountId  Int @map("account_id")',
        '  memberId   Int @map("member_id")',
        `  membership ${target.name} @relation(fields: [accountId, memberId], references: [accountId, memberId])`,
      );
      tail.push("  @@unique([accountId, memberId, id])");
    }
    if (i === 18) {
      // Two relations to the same model need names on both sides.
      const account = modelOf(m, 0);
      lines.push(
        '  fromId    Int @map("from_account_id")',
        '  toId      Int @map("to_account_id")',
        `  from      ${account.name} @relation("${model.name}From", fields: [fromId], references: [id])`,
        `  to        ${account.name} @relation("${model.name}To", fields: [toId], references: [id])`,
      );
      back(account, `  outgoing${NOUNS[i]}s ${model.name}[] @relation("${model.name}From")`);
      back(account, `  incoming${NOUNS[i]}s ${model.name}[] @relation("${model.name}To")`);
    }
    if (i === 13) {
      lines.push(
        '  parentId  Int?    @map("parent_id")',
        `  parent    ${model.name}? @relation("${model.name}Thread", fields: [parentId], references: [id])`,
        `  replies   ${model.name}[] @relation("${model.name}Thread")`,
      );
    }
    if (i > 5 && i !== 18) {
      const parents = [...new Set([pick(i), pick(i)])].filter((p) => p !== 4 && p !== 5);
      for (const p of parents) {
        const parent = modelOf(m, p);
        const field = lowerFirst(NOUNS[p]);
        const optional = random() < 0.4;
        lines.push(
          `  ${field}Id ${optional ? "Int?" : "Int"} @map("${snake(NOUNS[p])}_id")`,
          `  ${field} ${parent.name}${optional ? "?" : ""} @relation(fields: [${field}Id], references: [id]${optional ? ", onDelete: SetNull" : ""})`,
        );
        back(parent, `  ${lowerFirst(model.name)}s ${model.name}[]`);
        tail.push(`  @@index([${field}Id])`);
      }
    }
    if (i % 3 === 0 && i > 0 && i !== 18) {
      const other = MODULES[(MODULES.indexOf(m) + 1 + pick(MODULES.length - 1)) % MODULES.length];
      const owner = modelOf(other, 0);
      lines.push(
        '  ownerId   Int?    @map("owner_account_id")',
        `  owner     ${owner.name}? @relation(fields: [ownerId], references: [id])`,
      );
      back(owner, `  owned${model.name}s ${model.name}[]`);
    }
    const extras = 2 + pick(4);
    for (let k = 0; k < extras; k++) {
      const [name, type, attrs] = SCALARS[(i + k * 3) % SCALARS.length];
      if (!lines.some((l) => l.startsWith(`  ${name} `)))
        lines.push(`  ${name} ${type}${attrs ? ` ${attrs}` : ""}`);
    }
    if (i % 5 === 1) lines.push(`  status    ${m}Status @default(ACTIVE)`);
    lines.push(
      '  createdAt DateTime @default(now()) @map("created_at")',
      '  updatedAt DateTime @updatedAt @map("updated_at")',
    );
    if (i !== 4) tail.push(`  @@map("${snake(m)}_${snake(NOUNS[i])}s")`);
    else tail.push(`  @@map("${snake(m)}_memberships")`);
  }
  // Implicit many-to-many: tags ↔ items and tags ↔ documents in every module.
  const implicit = [];
  for (const m of MODULES) {
    const tag = modelOf(m, 6);
    for (const other of [modelOf(m, 7), modelOf(m, 3)]) {
      implicit.push(`${other.name} <-> ${tag.name}`);
      other.lines.push("  // implicit many-to-many", `  tags ${tag.name}[]`);
      tag.lines.push(`  ${lowerFirst(other.name)}s ${other.name}[]`);
    }
  }

  const out = [
    "// 200 models (generated by scripts/fixtures/prisma-200.mjs; synthetic schema, real Prisma syntax).",
    "generator client {",
    '  provider = "prisma-client-js"',
    "}",
    "",
    "datasource db {",
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    "}",
    "",
  ];
  for (const m of MODULES) {
    out.push(
      `/// Lifecycle of ${m.toLowerCase()} records.`,
      `enum ${m}Status {`,
      "  ACTIVE",
      '  SUSPENDED @map("suspended")',
      "  CLOSED",
      "",
      `  @@map("${snake(m)}_status")`,
      "}",
      "",
    );
  }
  for (const model of models.values()) {
    out.push(`/// ${model.module} ${snake(NOUNS[model.index]).replace(/_/g, " ")}.`);
    out.push(`model ${model.name} {`, ...model.lines, "", ...model.tail, "}", "");
  }
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const text = generate();
  if (process.argv.includes("--stdout")) process.stdout.write(text);
  else writeFileSync(new URL("../../tests/fixtures/real/large-200.prisma", import.meta.url), text);
}
