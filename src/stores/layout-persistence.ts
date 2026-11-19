import type {
  CollapseMode,
  DiagramLayout,
  EdgeRoute,
  LayoutDirection,
  Position,
  Schema,
  Viewport,
} from "@/domain/schema/types";
import { samePosition } from "@/graph/edge-path";
import { listKeys, readJson, removeKey, writeText } from "@/lib/safe-storage";

/** One localStorage key per fingerprint, so a drag serialises one layout, not all of them. */
export const LAYOUT_KEY_PREFIX = "schemaflow:layout:v1:";
/** `fingerprint → last used`; the layouts themselves are the source of truth for what exists. */
export const LAYOUT_INDEX_KEY = "schemaflow:layout-index:v1";
export const MAX_SAVED_LAYOUTS = 20;
/** Over this many characters a layout is saved without its edge routes (they are recomputable). */
export const MAX_LAYOUT_CHARS = 1_500_000;
export const SAVE_DELAY_MS = 300;

const COLLAPSE_MODES: readonly CollapseMode[] = ["full", "keys", "header"];
const DIRECTIONS: readonly LayoutDirection[] = ["LR", "TB"];

const keyOf = (fingerprint: string) => LAYOUT_KEY_PREFIX + fingerprint;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function asPosition(v: unknown): Position | null {
  return isRecord(v) && isFiniteNumber(v.x) && isFiniteNumber(v.y) ? { x: v.x, y: v.y } : null;
}

function asViewport(v: unknown): Viewport | null {
  const position = asPosition(v);
  return position && isRecord(v) && isFiniteNumber(v.zoom) && v.zoom > 0
    ? { ...position, zoom: v.zoom }
    : null;
}

function asRoute(v: unknown): EdgeRoute | null {
  if (!isRecord(v) || !Array.isArray(v.waypoints)) return null;
  const sourceAt = asPosition(v.sourceAt);
  const targetAt = asPosition(v.targetAt);
  const waypoints = v.waypoints.map(asPosition);
  if (!sourceAt || !targetAt || waypoints.some((p) => p === null)) return null;
  return { waypoints: waypoints as Position[], sourceAt, targetAt };
}

/**
 * Validates stored data against the schema it is about to be used with. Returns null unless every
 * table has a finite position, so a corrupt or stale entry falls back to auto-layout. Entries for
 * tables the schema does not have are dropped; a route is kept only while both of its ends still
 * sit where it was computed for.
 */
function parseLayout(raw: unknown, schema: Schema, fingerprint: string): DiagramLayout | null {
  if (!isRecord(raw) || !isRecord(raw.positions)) return null;
  const positions: Record<string, Position> = {};
  for (const id of schema.tableOrder) {
    const position = asPosition(raw.positions[id]);
    if (!position) return null;
    positions[id] = position;
  }
  const direction = DIRECTIONS.find((d) => d === raw.direction);
  if (!direction) return null;

  const collapsed: Record<string, CollapseMode> = {};
  if (isRecord(raw.collapsed)) {
    for (const id of schema.tableOrder) {
      const mode = COLLAPSE_MODES.find((m) => m === (raw.collapsed as Record<string, unknown>)[id]);
      if (mode) collapsed[id] = mode;
    }
  }

  const edgeRoutes: Record<string, EdgeRoute> = {};
  if (isRecord(raw.edgeRoutes)) {
    for (const [id, value] of Object.entries(raw.edgeRoutes)) {
      const rel = schema.relationships[id];
      const route = asRoute(value);
      if (
        rel &&
        route &&
        samePosition(positions[rel.from.tableId], route.sourceAt) &&
        samePosition(positions[rel.to.tableId], route.targetAt)
      )
        edgeRoutes[id] = route;
    }
  }
  const viewport = asViewport(raw.viewport);
  return {
    fingerprint,
    positions,
    edgeRoutes,
    collapsed,
    direction,
    ...(viewport ? { viewport } : {}),
  };
}

/** Existing layout keys' fingerprints with their last-used stamp (0 when the index lacks them). */
function readUsage(): Map<string, number> {
  const stamps = readJson(LAYOUT_INDEX_KEY);
  const usage = new Map<string, number>();
  // Scanning the keys rebuilds a missing or corrupt index and covers orphaned layouts.
  for (const key of listKeys(LAYOUT_KEY_PREFIX)) {
    const fingerprint = key.slice(LAYOUT_KEY_PREFIX.length);
    const stamp = isRecord(stamps) ? stamps[fingerprint] : undefined;
    usage.set(fingerprint, isFiniteNumber(stamp) ? stamp : 0);
  }
  return usage;
}

function writeUsage(usage: Map<string, number>): void {
  writeText(LAYOUT_INDEX_KEY, JSON.stringify(Object.fromEntries(usage)));
}

/** Strictly newer than every stamp, so two uses in the same millisecond still order. */
const nextStamp = (usage: Map<string, number>) => Math.max(Date.now(), ...usage.values()) + 1;

/** Oldest first, never `keep`. */
function oldest(usage: Map<string, number>, keep: string): string | undefined {
  let found: string | undefined;
  for (const [fingerprint, stamp] of usage) {
    if (fingerprint === keep) continue;
    if (found === undefined || stamp < (usage.get(found) ?? 0)) found = fingerprint;
  }
  return found;
}

/** The saved layout for this schema, or null. Counts as a use, so it is evicted last. */
export function loadLayout(schema: Schema, fingerprint: string): DiagramLayout | null {
  const layout = parseLayout(readJson(keyOf(fingerprint)), schema, fingerprint);
  if (!layout) return null;
  const usage = readUsage();
  usage.set(fingerprint, nextStamp(usage));
  writeUsage(usage);
  return layout;
}

export function saveLayout(layout: DiagramLayout): void {
  const { fingerprint } = layout;
  let text = JSON.stringify(layout);
  if (text.length > MAX_LAYOUT_CHARS) text = JSON.stringify({ ...layout, edgeRoutes: {} });
  const usage = readUsage();
  let result = writeText(keyOf(fingerprint), text);
  // A full storage: evict the least recently used other layouts until the write fits.
  while (result === "quota") {
    const victim = oldest(usage, fingerprint);
    if (victim === undefined) return;
    removeKey(keyOf(victim));
    usage.delete(victim);
    result = writeText(keyOf(fingerprint), text);
  }
  if (result !== "ok") return;
  usage.set(fingerprint, nextStamp(usage));
  for (let victim = oldest(usage, fingerprint); usage.size > MAX_SAVED_LAYOUTS && victim;) {
    removeKey(keyOf(victim));
    usage.delete(victim);
    victim = oldest(usage, fingerprint);
  }
  writeUsage(usage);
}

/** Removes every saved layout (tests and a future "clear saved data"). */
export function clearSavedLayouts(): void {
  for (const key of listKeys(LAYOUT_KEY_PREFIX)) removeKey(key);
  removeKey(LAYOUT_INDEX_KEY);
}

// Debounced saves: a drag or a pan emits many changes, only the last one is written.
const pending = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; read: () => DiagramLayout | undefined }
>();
let listening = false;

export function flushPendingSaves(): void {
  for (const [fingerprint, entry] of [...pending]) {
    clearTimeout(entry.timer);
    pending.delete(fingerprint);
    const layout = entry.read();
    if (layout) saveLayout(layout);
  }
}

function listenForLeaving(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pagehide", flushPendingSaves);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingSaves();
  });
}

/** Saves the layout `read` returns for this fingerprint after `SAVE_DELAY_MS` of quiet. */
export function scheduleSave(
  fingerprint: string,
  read: () => DiagramLayout | undefined,
  delay = SAVE_DELAY_MS,
): void {
  listenForLeaving();
  const previous = pending.get(fingerprint);
  if (previous) clearTimeout(previous.timer);
  const timer = setTimeout(() => {
    pending.delete(fingerprint);
    const layout = read();
    if (layout) saveLayout(layout);
  }, delay);
  pending.set(fingerprint, { timer, read });
}

/** Test helper: forget pending saves without writing them. */
export function discardPendingSaves(): void {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
}
