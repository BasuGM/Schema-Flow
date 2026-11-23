"use client";

import { useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { displayTableName } from "@/domain/schema/selectors";
import type { Schema, TableId } from "@/domain/schema/types";
import { getSearchIndex } from "@/domain/search/search-index";
import { search } from "@/domain/search/search";
import { cn } from "@/lib/utils";

const LIMIT = 50;

/** Matching tables (the first `LIMIT` in declaration order for an empty query) and their total. */
function candidates(schema: Schema, query: string, exclude: TableId) {
  if (!query.trim()) {
    const all = schema.tableOrder.filter((id) => id !== exclude);
    return { ids: all.slice(0, LIMIT), total: all.length };
  }
  const ids = search(getSearchIndex(schema), query, LIMIT + 1)
    .tables.map((h) => h.entry.id)
    .filter((id) => id !== exclude);
  return { ids: ids.slice(0, LIMIT), total: ids.length };
}

/**
 * Type-to-filter table chooser (combobox + listbox). ArrowUp/Down move, Enter picks, Escape clears
 * the query (only the query: the key is consumed so the workspace keeps the selection and path).
 */
export function TablePicker({
  schema,
  exclude,
  onPick,
  inputRef,
}: {
  schema: Schema;
  exclude: TableId;
  onPick: (id: TableId) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const { ids, total } = useMemo(
    () => candidates(schema, query, exclude),
    [schema, query, exclude],
  );
  const activeIndex = Math.min(active, ids.length - 1);
  const optionId = (i: number) => `${listId}-${i}`;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && ids.length > 0) {
      e.preventDefault();
      setActive((activeIndex + 1) % ids.length);
    } else if (e.key === "ArrowUp" && ids.length > 0) {
      e.preventDefault();
      setActive((activeIndex - 1 + ids.length) % ids.length);
    } else if (e.key === "Enter") {
      const id = ids[activeIndex];
      if (id) {
        e.preventDefault();
        onPick(id);
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
      setActive(0);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${listId}-input`} className="text-xs font-medium">
        To table
      </label>
      <input
        id={`${listId}-input`}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={ids.length > 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder="Type a table name"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        data-testid="path-target-input"
        className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-[11px] text-muted-foreground" data-testid="path-target-hint">
        {query.trim()
          ? `${total}${total > LIMIT ? "+" : ""} matching ${total === 1 ? "table" : "tables"}`
          : `Type to narrow (${total} ${total === 1 ? "table" : "tables"})`}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label="Tables"
        className="max-h-40 overflow-y-auto rounded-md border"
      >
        {ids.map((id, i) => (
          <li
            key={id}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            tabIndex={-1}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(id)}
            data-testid="path-target-option"
            className={cn(
              "cursor-pointer truncate px-2 py-1 text-xs",
              i === activeIndex && "bg-accent text-accent-foreground",
            )}
          >
            {displayTableName(schema, schema.tables[id]!)}
          </li>
        ))}
      </ul>
    </div>
  );
}
