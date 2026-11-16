# Real-world fixtures: sources, licences and how the expected counts were made

The expected counts in `src/parsers/real-fixtures.test.ts` come from the source files, not from
the parser's output. Each section gives the commands to recount them independently (run from the
repository root, macOS/BSD or GNU tools).

## gitlab-structure.postgres.sql (vendored, unmodified)

- **Origin:** GitLab `db/structure.sql` at tag `v18.11.14-ee` (commit `36cf8f5e8ce5`),
  <https://gitlab.com/gitlab-org/gitlab/-/raw/v18.11.14-ee/db/structure.sql>
- **Retrieved:** 2026-11-16. **Size:** 2,825,634 bytes (under the 5 MB import limit, so it is
  imported whole and is **not trimmed**). **SHA-256:**
  `c47bfd20e942c8d02c6ae48d10d27e5f83ac1778abf5becb709e62ed4dc68077`
- **Licence:** MIT (Expat). The file is outside `ee/`, `jh/` and `doc/`. GitLab's `LICENSE` at
  that tag says:

  > Copyright (c) 2011-present GitLab Inc.
  >
  > Portions of this software are licensed as follows:
  >
  > - All content residing under the "doc/" directory of this repository is licensed under
  >   "Creative Commons: CC BY-SA 4.0 license".
  > - All content that resides under the "ee/" directory of this repository, if that directory
  >   exists, is licensed under the license defined in "ee/LICENSE".
  > - All content that resides under the "jh/" directory of this repository, if that directory
  >   exists, is licensed under the license defined in "jh/LICENSE".
  > - All client-side JavaScript (when served directly or after being compiled, arranged,
  >   augmented, or combined), is licensed under the "MIT Expat" license.
  > - All third party components incorporated into the GitLab Software are licensed under the
  >   original license provided by the owner of the applicable component.
  > - Content outside of the above mentioned directories or restrictions above is available under
  >   the "MIT Expat" license as defined below.
  >
  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software
  > and associated documentation files (the "Software"), to deal in the Software without
  > restriction, including without limitation the rights to use, copy, modify, merge, publish,
  > distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
  > Software is furnished to do so, subject to the following conditions:
  >
  > The above copyright notice and this permission notice shall be included in all copies or
  > substantial portions of the Software.
  >
  > THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  > INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
  > PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
  > ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
  > ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  > SOFTWARE.

**Counts.** Partitions are folded into their parent (ADR-019): a table attached with
`ALTER TABLE ONLY parent ATTACH PARTITION child …` is not drawn; the parent lists it.

```sh
F=tests/fixtures/real/gitlab-structure.postgres.sql
grep -cE '^CREATE TABLE ' $F                                    # 1426 tables declared
grep -E '^ALTER TABLE ONLY [^ ]+ ATTACH PARTITION ' $F | awk '{print $7}' | sort -u > /tmp/children
wc -l < /tmp/children                                            # 434 partitions (400 in gitlab_partitions_static, 34 in public)
grep -E '^ALTER TABLE ONLY [^ ]+ ATTACH PARTITION ' $F | awk '{print $4}' | sort -u | wc -l   # 19 parents
grep -cE '^CREATE TABLE [^ ]+ PARTITION OF' $F                   # 0 (no PARTITION OF form)
# tables shown: 1426 - 434 = 992 (all in schema public, so drawn without a schema prefix)

grep -cE 'ADD CONSTRAINT [^ ]+ FOREIGN KEY' $F                   # 1726 foreign keys
awk '/^ALTER TABLE/{t=($3=="ONLY")?$4:$3} /ADD CONSTRAINT [^ ]+ FOREIGN KEY/{print t}' $F \
  | grep -cxFf /tmp/children                                     # 6 declared on a partition (dropped with it)
# relationships: 1726 - 6 = 1720 (10 FKs that reference a partition are redrawn to its parent)

awk 'NR==FNR{c[$1]=1;next} /^CREATE TABLE /{t=$3; m=!(t in c); next} /^\)/{m=0}
     m && /^    [^ ]/ && !/^    CONSTRAINT /{n++} END{print n}' /tmp/children $F   # 9982 columns
```

With partitions shown as tables there would be 1,426 tables and 1,726 relationships.

## sakila-schema.mysql.sql (vendored, unmodified)

- **Origin:** the official Sakila sample database, `sakila-db.zip` from
  <https://downloads.mysql.com/docs/sakila-db.zip> (file `sakila-db/sakila-schema.sql`, schema
  version 1.5; archive last modified 2026-10-31).
- **Retrieved:** 2026-11-16. **Size:** 24,269 bytes. **SHA-256:**
  `b32170e1e2ad5828749b61a5ec896155bcd143104b076e5ee8a3a3b013f44915`
- **Licence:** New BSD (3-clause), stated in the file's own header (Copyright (c) 2006, 2026,
  Oracle and/or its affiliates), which is kept unchanged.

**Counts.** MySQL runs the content of `/*!NNNNN … */` comments (5.7.5+ creates `address.location`).

```sh
F=tests/fixtures/real/sakila-schema.mysql.sql
grep -cE '^CREATE TABLE ' $F                                     # 16 tables
grep -cE 'FOREIGN KEY' $F                                        # 22 foreign keys
awk '/^CREATE TABLE /{m=1;next} /^\)/{m=0}
     m && /^  [a-z_0-9]+ / && !/^  (PRIMARY|KEY|UNIQUE|CONSTRAINT|INDEX|FULLTEXT|SPATIAL) /{n++}
     END{print n}' $F                                            # 89 plain column lines
grep -cE '^  /\*!50705 [a-z_]+ ' $F                              # +1 column in an executable comment = 90
grep -cE '^CREATE (DEFINER=[^ ]+ SQL SECURITY [A-Z]+ )?VIEW' $F  # 7 views (reported as skipped)
```

## mysqldump-180.mysql.sql (generated)

- **Generator:** `scripts/fixtures/mysqldump-180.mjs` (fixed seed 20261116; synthetic schema in
  real mysqldump 8 syntax). `node scripts/fixtures/mysqldump-180.mjs` rewrites it; a test checks
  that the committed file matches the generator byte for byte.

```sh
F=tests/fixtures/real/mysqldump-180.mysql.sql
grep -cE '^CREATE TABLE ' $F                         # 180 tables
grep -cE '^  CONSTRAINT .* FOREIGN KEY' $F           # 306 foreign keys
grep -cE '^  CONSTRAINT .* FOREIGN KEY \(`[^`]+`, ' $F   # 9 of them composite
grep -cE '^  `' $F                                   # 1625 columns
```

## large-200.prisma (generated)

- **Generator:** `scripts/fixtures/prisma-200.mjs` (fixed seed 20261117; synthetic schema in real
  Prisma syntax). Same byte-for-byte test.

```sh
F=tests/fixtures/real/large-200.prisma
grep -c '^model ' $F                          # 200 models
grep -c '// implicit many-to-many' $F         # 20 implicit join tables → 220 tables
grep -c 'fields: \[' $F                       # 314 foreign keys, + 2 per join table = 354 relationships
awk '/^model /{m=1;next} /^}/{m=0}
     m && $2 ~ /^(Int|String|Decimal|Boolean|Json|DateTime|[A-Za-z]+Status)\??$/{n++}
     END{print n}' $F                         # 1652 scalar fields, + 2 per join table = 1692 columns
```
