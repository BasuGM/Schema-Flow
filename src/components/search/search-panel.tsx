"use client";

import { Search } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { useCommands, type Command } from "@/components/commands/use-commands";
import type { ColumnId, TableId } from "@/domain/schema/types";
import { search, type SearchResults } from "@/domain/search/search";
import { getSearchIndex } from "@/domain/search/search-index";
import { useSchemaStore } from "@/stores/schema-store";
import { OptionRow, type SearchOption } from "./search-results";

const NO_RESULTS: SearchResults = { tables: [], columns: [], totalTables: 0, totalColumns: 0 };

const plural = (n: number, word: string) =>
  `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

function toOptions(commands: readonly Command[], results: SearchResults): SearchOption[] {
  return [
    ...commands.map((command) => ({ kind: "command" as const, command })),
    ...results.tables.map((hit) => ({ kind: "table" as const, hit })),
    ...results.columns.map((hit) => ({ kind: "column" as const, hit })),
  ];
}

/**
 * The search box and results (WAI-ARIA combobox + listbox). Mounted only while the dialog is open,
 * so nothing else subscribes to the schema for search. The index is built once per schema.
 */
export function SearchPanel({
  onChoose,
  onRun,
}: {
  onChoose: (tableId: TableId, columnId?: ColumnId) => void;
  onRun: (command: Command) => void;
}) {
  const schema = useSchemaStore((s) => s.schema);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const index = useMemo(() => (schema ? getSearchIndex(schema) : null), [schema]);
  const { commands, commandsOnly } = useCommands(deferred);
  const results = useMemo(
    () => (index ? (commandsOnly ? NO_RESULTS : search(index, deferred)) : null),
    [index, deferred, commandsOnly],
  );
  const options = useMemo(() => (results ? toOptions(commands, results) : []), [commands, results]);
  // The active row resets to the first one whenever the results change (derived, not an effect).
  const [active, setActive] = useState({ options, index: 0 });
  const activeIndex = active.options === options ? Math.min(active.index, options.length - 1) : 0;
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;
  const activeId = options.length > 0 ? optionId(activeIndex) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const choose = useCallback(
    (i: number) => {
      const option = options[i];
      if (!option) return;
      if (option.kind === "command") {
        if (!option.command.disabled) onRun(option.command);
      } else if (option.kind === "table") onChoose(option.hit.entry.id);
      else onChoose(option.hit.entry.table.id, option.hit.entry.id);
    },
    [options, onChoose, onRun],
  );
  const hover = useCallback((i: number) => setActive({ options, index: i }), [options]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = options.length;
    const move = (i: number) => {
      e.preventDefault();
      if (n > 0) setActive({ options, index: (i + n) % n });
    };
    if (e.key === "ArrowDown") move(activeIndex + 1);
    else if (e.key === "ArrowUp") move(activeIndex - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(n - 1);
    else if (e.key === "Enter") {
      // An IME confirms its composition with Enter; that must not choose a result.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      choose(activeIndex);
    }
  };

  if (!results) return null;
  const total = commands.length + results.totalTables + results.totalColumns;
  const empty = deferred.trim() === "";
  const status = empty
    ? `Type to search ${plural(index!.tables.length, "table")} and ${plural(index!.columns.length, "column")}`
    : total === 0
      ? `No tables or columns match “${deferred.trim()}”.`
      : plural(total, "result");
  const cmdCount = commands.length;
  const tableCount = results.tables.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-3">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search tables, columns and commands"
          placeholder="Search tables, columns and commands…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          data-testid="search-input"
        />
      </div>
      {/* QA-016: one live region, mounted for as long as the dialog is open; only its text
          changes. The visible status and the no-match message are separate, non-live elements. */}
      <p aria-live="polite" className="sr-only" data-testid="search-live">
        {status}
      </p>
      {total === 0 && !empty ? (
        <p
          key="empty"
          className="px-3 pt-2 pb-1 text-xs text-muted-foreground"
          data-testid="search-empty"
        >
          {status}
        </p>
      ) : (
        <p
          key="status"
          className="px-3 pt-2 pb-1 text-xs text-muted-foreground"
          data-testid="search-status"
        >
          {status}
        </p>
      )}
      <div
        id={listId}
        role="listbox"
        aria-label="Results"
        className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5"
        data-testid="search-results"
        data-query={deferred}
      >
        {cmdCount > 0 && (
          <Group label="Commands" more={0} noun="command" testid="commands">
            {commands.map((_, i) => (
              <OptionRow
                key={optionId(i)}
                option={options[i]!}
                index={i}
                id={optionId(i)}
                active={i === activeIndex}
                onHover={hover}
                onChoose={choose}
              />
            ))}
          </Group>
        )}
        {tableCount > 0 && (
          <Group
            label="Tables"
            more={results.totalTables - tableCount}
            noun="table"
            testid="tables"
          >
            {results.tables.map((_, k) => {
              const i = cmdCount + k;
              return (
                <OptionRow
                  key={optionId(i)}
                  option={options[i]!}
                  index={i}
                  id={optionId(i)}
                  active={i === activeIndex}
                  onHover={hover}
                  onChoose={choose}
                />
              );
            })}
          </Group>
        )}
        {results.columns.length > 0 && (
          <Group
            label="Columns"
            more={results.totalColumns - results.columns.length}
            noun="column"
            testid="columns"
          >
            {results.columns.map((_, k) => {
              const i = cmdCount + tableCount + k;
              return (
                <OptionRow
                  key={optionId(i)}
                  option={options[i]!}
                  index={i}
                  id={optionId(i)}
                  active={i === activeIndex}
                  onHover={hover}
                  onChoose={choose}
                />
              );
            })}
          </Group>
        )}
      </div>
      <p className="hidden border-t px-3 py-1.5 text-[11px] text-muted-foreground sm:block">
        ↑ ↓ to move · Enter to open · Esc to close
      </p>
    </div>
  );
}

function Group({
  label,
  more,
  noun,
  testid,
  children,
}: {
  label: string;
  more: number;
  noun: string;
  testid: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="pt-1">
      <div
        id={id}
        role="presentation"
        className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </div>
      {children}
      {more > 0 && (
        <div
          role="presentation"
          className="px-2 py-1 text-xs text-muted-foreground"
          data-testid={`search-more-${testid}`}
        >
          + {plural(more, `more ${noun}`)} — keep typing to narrow
        </div>
      )}
    </div>
  );
}
