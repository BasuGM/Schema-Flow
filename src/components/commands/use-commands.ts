"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";
import { getSubjectAreas, type SubjectAreas } from "@/analysis/subject-areas";
import { matchCommands, type CommandSpec } from "@/domain/commands/match-commands";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { actions } from "./actions";
import { shortcutById, shortcutLabels } from "./shortcuts";

/** A palette command: the pure spec plus what the UI needs to show and run it (P4-T04). */
export interface Command extends CommandSpec {
  /** Key labels such as ["L"], shown on the row. */
  shortcut?: readonly string[];
  /** Shown but not runnable (Enter skips it). */
  disabled?: boolean;
  /** Opens a dialog, which then returns focus to where ⌘K was pressed. */
  opensDialog?: boolean;
  run: () => void;
}

interface Context {
  hasSelection: boolean;
  areas: SubjectAreas | null;
  hiddenAreas: ReadonlySet<string>;
  setTheme: (theme: string) => void;
}

const keys = (shortcutId: string) => {
  const shortcut = shortcutById(shortcutId);
  return shortcut ? shortcutLabels(shortcut) : undefined;
};

/** The commands shown for an empty query; one entry each, in this order. */
export function buildCommands(ctx: Context): Command[] {
  const hiddenCount = ctx.hiddenAreas.size;
  const spec = (
    id: string,
    label: string,
    keywords: string[],
    rest: Partial<Command> & { run: () => void },
  ): Command => ({ id, label, group: "Commands", keywords, ...rest });
  const list: Command[] = [
    // Reset view first: Enter on a freshly opened palette must never discard positions.
    spec("reset-view", "Reset view", ["fit", "zoom", "center"], {
      run: actions.resetView,
      shortcut: keys("reset-view"),
    }),
    spec("layout", "Re-run layout", ["auto", "arrange", "positions"], {
      run: actions.layout,
      shortcut: keys("layout"),
    }),
    spec("export", "Export…", ["download", "sql", "prisma", "mermaid", "json"], {
      run: actions.exportSchema,
      shortcut: keys("export"),
      opensDialog: true,
    }),
    spec("export-image", "Export image…", ["png", "svg", "picture"], {
      run: actions.exportImage,
      opensDialog: true,
    }),
    spec("import", "Import schema…", ["load", "open", "sql", "prisma"], {
      run: actions.importSchema,
      shortcut: keys("import"),
      opensDialog: true,
    }),
    spec("health", "Open schema health", ["issues", "lint", "check"], {
      run: actions.health,
      shortcut: keys("health"),
    }),
    spec("path-finder", "Find path between tables", ["route", "join", "connect"], {
      run: actions.pathFinder,
      disabled: !ctx.hasSelection,
    }),
    spec("toggle-list", "Toggle table list", ["sidebar", "left"], {
      run: actions.toggleTableList,
      shortcut: keys("toggle-list"),
    }),
    spec("toggle-inspector", "Toggle inspector", ["sidebar", "right", "details"], {
      run: actions.toggleInspector,
      shortcut: keys("toggle-inspector"),
    }),
    spec("toggle-minimap", "Toggle minimap", ["overview", "map"], { run: actions.toggleMiniMap }),
    spec("theme-light", "Theme: light", ["appearance", "day"], {
      run: () => ctx.setTheme("light"),
    }),
    spec("theme-dark", "Theme: dark", ["appearance", "night"], { run: () => ctx.setTheme("dark") }),
    spec("theme-system", "Theme: system", ["appearance", "auto"], {
      run: () => ctx.setTheme("system"),
    }),
  ];
  if (ctx.areas) {
    list.push(
      spec("show-all-areas", "Show all areas", ["subject", "filter", "unhide"], {
        run: () => useUiStore.getState().showAllAreas(),
        disabled: hiddenCount === 0,
      }),
    );
  }
  list.push(
    spec("shortcuts", "Keyboard shortcuts", ["keys", "help", "hotkeys"], {
      run: actions.shortcuts,
      shortcut: keys("shortcuts"),
      opensDialog: true,
    }),
    spec("clear-data", "Clear saved data…", ["storage", "forget", "wipe"], {
      run: actions.clearData,
      opensDialog: true,
    }),
  );
  return list;
}

/** Per-area commands. Only offered for a typed query (a big schema can have ~80 areas). */
export function buildAreaCommands(ctx: Context): Command[] {
  if (!ctx.areas) return [];
  const all = ctx.areas.areas.map((a) => a.id);
  return ctx.areas.areas.flatMap((area): Command[] => {
    const hidden = ctx.hiddenAreas.has(area.id);
    const base = { group: "Commands", keywords: ["area", "subject"] as string[] };
    return [
      {
        ...base,
        id: `area-only-${area.id}`,
        label: `Show only area ${area.label}`,
        run: () => useUiStore.getState().showOnlyArea(area.id, all),
      },
      {
        ...base,
        id: `area-toggle-${area.id}`,
        label: `${hidden ? "Show" : "Hide"} area ${area.label}`,
        run: () => useUiStore.getState().setAreaVisible(area.id, hidden),
      },
    ];
  });
}

/** Typed queries show at most this many commands above the tables and columns. */
export const MAX_TYPED_COMMANDS = 5;
export const MAX_COMMAND_ONLY = 12;

/**
 * Commands for the search box. Empty query: every command. Typed: up to five matches ahead of
 * tables and columns. A leading `>` limits the dialog to commands.
 */
export function useCommands(query: string): { commands: Command[]; commandsOnly: boolean } {
  const schema = useSchemaStore((s) => s.schema);
  const hasSelection = useUiStore((s) => s.selectedTableId !== null);
  const hiddenAreas = useUiStore((s) => s.hiddenAreas);
  const { setTheme } = useTheme();
  const areas = useMemo(() => (schema ? getSubjectAreas(schema) : null), [schema]);
  return useMemo(() => {
    const commandsOnly = query.trimStart().startsWith(">");
    const text = commandsOnly ? query.trimStart().slice(1) : query;
    const ctx: Context = { hasSelection, areas, hiddenAreas, setTheme };
    const base = buildCommands(ctx);
    if (text.trim() === "")
      return { commands: commandsOnly || query.trim() === "" ? base : [], commandsOnly };
    const matches = matchCommands([...base, ...buildAreaCommands(ctx)], text);
    return {
      commands: matches.slice(0, commandsOnly ? MAX_COMMAND_ONLY : MAX_TYPED_COMMANDS),
      commandsOnly,
    };
  }, [query, hasSelection, areas, hiddenAreas, setTheme]);
}
