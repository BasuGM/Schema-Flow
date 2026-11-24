# Demo guide

There is no hosted demo (a deliberate choice: the project is local-first and has no deployment).
Run the production build locally.

## Setup

Requires Node.js 22+.

```bash
npm install
npm run build          # static export to out/
npm run start          # serves out/ on http://localhost:3000 (stop `npm run dev` first)
```

To reset between runs: Settings → **Clear saved data…** (More on a phone), or open a private window.
Use the built production build for anything you show; `npm run dev` is slower and not representative.

Demo files live in the repo, so nothing needs downloading:

| File                                             | Size        | Use                      |
| ------------------------------------------------ | ----------- | ------------------------ |
| built-in sample (`/`)                            | 12 tables   | start of every demo      |
| `tests/fixtures/synthetic/saas-300.postgres.sql` | 300 tables  | the realistic upper size |
| `tests/fixtures/real/sakila-schema.mysql.sql`    | small MySQL | import with issues       |
| `tests/fixtures/sql/health.postgres.sql`         | small       | Health findings          |

## 5-minute script

1. **Open `/`.** The e-commerce sample is laid out. Click `orders`: the inspector shows its columns;
   unrelated tables dim.
2. **Search.** Press `⌘K` / `Ctrl+K`, type a column name, Enter: the canvas jumps to it.
3. **Import.** Press `I`, choose `saas-300.postgres.sql`. 300 tables lay out; mention that the file
   was parsed as text and never left the browser.
4. **Health.** Press `H`: advisory findings (missing primary keys, unindexed foreign keys).
5. **Path.** Select a table, open the **Path** tab, pick another table: the shortest FK path lights up.
6. **Export.** Press `E`, pick **Mermaid**, show the preview.

## 15-minute script (up to 300 tables)

Everything above, plus:

1. **Import with issues:** import `sakila-schema.mysql.sql`, or paste a broken statement into any
   file. The Issues panel lists line numbers and the rest of the schema still loads.
2. **Subject areas** (on `saas-300`): open the Areas disclosure in the table list, show one area only,
   then **Show all**.
3. **Collapse modes:** pick `keys` or `header` for a table in the inspector, then "All tables" in Settings.
4. **Keyboard only:** Tab from the skip link to the diagram, then to a table; Enter selects; `?` lists
   the shortcuts.
5. **Phone layout:** narrow the window to about 390 px; panels become sheets.
6. **Restore:** reload the page. The last import, positions, zoom and selection come back.

## Optional stress demo (outside the design envelope)

`tests/fixtures/real/gitlab-structure.postgres.sql` has 992 tables. It opens with the
large-schema notice, uses the packed layout and takes about 3 s to lay out on an M1. Reset view may
show it clipped. This is above the ~300-table target and slow by design, so avoid it live.

## If something goes wrong

- The three open accessibility defects (QA-043, QA-044, QA-045) are listed in the
  [QA log Backlog](development/QA_LOG.md#backlog): the search button's `aria-keyshortcuts` can read
  `Meta+K` on Windows/Linux, and the destructive button on the Clear saved data dialog is slightly
  under the 4.5:1 contrast ratio.
- Stale state: Clear saved data, then reload.
- Port busy: stop `npm run dev` before `npm run start`.
