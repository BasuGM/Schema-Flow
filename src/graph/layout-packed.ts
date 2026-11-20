import type {
  CollapseMode,
  EdgeRoute,
  Position,
  RelationshipId,
  Schema,
  TableId,
} from "@/domain/schema/types";
import { layoutWithDagre, type DagreLayoutOptions, type DagreLayoutResult } from "./layout-dagre";
import { NODE_WIDTH, estimateNodeHeight, visibleColumns } from "./node-metrics";

/** Below this many tables the plain Dagre layout is always used. */
export const PACK_MIN_TABLES = 50;
/** A Dagre layout longer than this (long side / short side) is packed. */
export const PACK_ASPECT_LIMIT = 4;
/** Floor for the tallest a single rank may be (LR) before it wraps into several columns. */
export const LANE_MIN = 3000;
/** Wanted width / height of the packed diagram. */
const TARGET_ASPECT = 1.6;
const COMPONENT_GAP = 96;

interface Box {
  /** Table positions relative to the box's top-left corner. */
  positions: Record<TableId, Position>;
  routes: Record<RelationshipId, EdgeRoute>;
  width: number;
  height: number;
  order: number;
}

/**
 * Dagre lays very large, shallow schemas out as one tall column (GitLab: 3,904 × 242,359 px). This
 * keeps Dagre's result when it is reasonably shaped, and otherwise lays out each connected
 * component on its own, wraps tall ranks, grids the isolated tables and shelf-packs everything
 * towards a 16:10 diagram. Pure and deterministic: same schema + options → same output.
 */
export function layoutPacked(schema: Schema, options: DagreLayoutOptions = {}): DagreLayoutResult {
  const dagre = layoutWithDagre(schema, options);
  if (schema.tableOrder.length < PACK_MIN_TABLES) return dagre;

  const collapsed = options.collapsed ?? {};
  const heightOf = (id: TableId): number => {
    const table = schema.tables[id];
    const mode: CollapseMode = collapsed[id] ?? "full";
    return estimateNodeHeight(table ? visibleColumns(table, mode).length : 0);
  };
  if (aspectOf(dagre.positions, heightOf) <= PACK_ASPECT_LIMIT) return dagre;

  const { nodeSep = 48 } = options;
  const components = connectedComponents(schema);
  const boxes: Box[] = [];
  const isolated: TableId[] = [];
  for (const members of components) {
    const only = members.length === 1 ? members[0] : undefined;
    if (only !== undefined) {
      isolated.push(only);
      continue;
    }
    boxes.push(componentBox(schema, members, options, heightOf, nodeSep, boxes.length));
  }
  if (isolated.length > 0) boxes.push(isolatedBox(isolated, heightOf, nodeSep, boxes.length));

  return shelfPack(boxes, schema.tableOrder);
}

function aspectOf(positions: Record<TableId, Position>, heightOf: (id: TableId) => number): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [id, p] of Object.entries(positions)) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_WIDTH);
    maxY = Math.max(maxY, p.y + heightOf(id));
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return 1;
  return Math.max(w, h) / Math.min(w, h);
}

/** Weakly connected components in declaration order; self-references and unknown ends ignored. */
function connectedComponents(schema: Schema): TableId[][] {
  const parent = new Map<TableId, TableId>();
  for (const id of schema.tableOrder) parent.set(id, id);
  const find = (id: TableId): TableId => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  for (const rel of Object.values(schema.relationships)) {
    const a = rel.from.tableId;
    const b = rel.to.tableId;
    if (a === b || !parent.has(a) || !parent.has(b)) continue;
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) continue;
    // The earlier-declared root wins, so the result does not depend on relationship order.
    if (schema.tableOrder.indexOf(ra) <= schema.tableOrder.indexOf(rb)) parent.set(rb, ra);
    else parent.set(ra, rb);
  }
  const groups = new Map<TableId, TableId[]>();
  for (const id of schema.tableOrder) {
    const root = find(id);
    const list = groups.get(root);
    if (list) list.push(id);
    else groups.set(root, [id]);
  }
  return [...groups.values()];
}

function componentBox(
  schema: Schema,
  members: TableId[],
  options: DagreLayoutOptions,
  heightOf: (id: TableId) => number,
  nodeSep: number,
  order: number,
): Box {
  const set = new Set(members);
  const sub: Schema = {
    ...schema,
    tables: Object.fromEntries(members.map((id) => [id, schema.tables[id]!])),
    tableOrder: members,
    relationships: Object.fromEntries(
      Object.entries(schema.relationships).filter(
        ([, r]) => set.has(r.from.tableId) && set.has(r.to.tableId),
      ),
    ),
  };
  const result = layoutWithDagre(sub, options);
  const raw = minCorner(result.positions);
  let positions = normalize(result.positions);
  let routes: Record<RelationshipId, EdgeRoute> = Object.fromEntries(
    Object.entries(result.edgeRoutes).map(([id, r]) => [id, shiftRoute(r, -raw.x, -raw.y)]),
  );
  if ((options.direction ?? "LR") === "LR") {
    const wrapped = wrapRanks(positions, heightOf, nodeSep);
    if (wrapped) {
      positions = wrapped;
      routes = {};
    }
  }
  return { positions, routes, ...extent(positions, heightOf), order };
}

/** Translates positions so the top-left of the bounding box is (0, 0). */
function normalize(positions: Record<TableId, Position>): Record<TableId, Position> {
  const { x, y } = minCorner(positions);
  const out: Record<TableId, Position> = {};
  for (const [id, p] of Object.entries(positions)) out[id] = { x: p.x - x, y: p.y - y };
  return out;
}

function minCorner(positions: Record<TableId, Position>): Position {
  let x = Infinity;
  let y = Infinity;
  for (const p of Object.values(positions)) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
  }
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

function extent(
  positions: Record<TableId, Position>,
  heightOf: (id: TableId) => number,
): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const [id, p] of Object.entries(positions)) {
    width = Math.max(width, p.x + NODE_WIDTH);
    height = Math.max(height, p.y + heightOf(id));
  }
  return { width, height };
}

/**
 * LR only: ranks are columns sharing an x. A rank taller than LANE_LIMIT is split into
 * consecutive sub-columns (same order, top to bottom), and later ranks move right to make room.
 * Returns null when no rank needs wrapping.
 */
function wrapRanks(
  positions: Record<TableId, Position>,
  heightOf: (id: TableId) => number,
  nodeSep: number,
): Record<TableId, Position> | null {
  const ranks = new Map<number, TableId[]>();
  for (const [id, p] of Object.entries(positions)) {
    const list = ranks.get(p.x);
    if (list) list.push(id);
    else ranks.set(p.x, [id]);
  }
  const xs = [...ranks.keys()].sort((a, b) => a - b);
  // Sized so the wrapped component is about 16:10: height L, width ≈ area / L.
  let area = 0;
  for (const id of Object.keys(positions))
    area += (NODE_WIDTH + nodeSep) * (heightOf(id) + nodeSep);
  const limit = Math.max(LANE_MIN, Math.sqrt(area / TARGET_ASPECT));
  // Dagre spreads a rank out to line tables up with their neighbours; packing re-stacks every
  // rank tightly (`nodeSep` apart), because the whitespace is what makes the layout so tall.
  const plan = xs.map((x) => {
    const ids = ranks.get(x)!.sort((a, b) => positions[a]!.y - positions[b]!.y || (a < b ? -1 : 1));
    const total = ids.reduce((sum, id) => sum + heightOf(id) + nodeSep, -nodeSep);
    const lanes = Math.max(1, Math.ceil(total / limit));
    return { ids, total, lanes, laneHeight: total / lanes };
  });
  if (plan.every((r) => r.lanes === 1) && plan.every((r) => r.total <= limit)) return null;

  // Ranks that fit in one column are centred on the tallest lane, so a hub keeps facing the
  // tables around it.
  const tallest = Math.max(...plan.map((r) => r.laneHeight));
  const out: Record<TableId, Position> = {};
  let extra = 0;
  for (const rank of plan) {
    const centre = rank.lanes === 1 ? Math.max(0, Math.round((tallest - rank.total) / 2)) : 0;
    let lane = 0;
    let cursor = 0;
    for (const id of rank.ids) {
      const h = heightOf(id);
      if (cursor > 0 && cursor + h > rank.laneHeight + nodeSep && lane < rank.lanes - 1) {
        lane += 1;
        cursor = 0;
      }
      out[id] = {
        x: positions[id]!.x + extra + lane * (NODE_WIDTH + nodeSep),
        y: Math.round(cursor + centre),
      };
      cursor += h + nodeSep;
    }
    extra += (rank.lanes - 1) * (NODE_WIDTH + nodeSep);
  }
  return out;
}

function isolatedBox(
  ids: TableId[],
  heightOf: (id: TableId) => number,
  nodeSep: number,
  order: number,
): Box {
  const cellW = NODE_WIDTH + nodeSep;
  const avgH = ids.reduce((sum, id) => sum + heightOf(id), 0) / ids.length + nodeSep;
  const cols = Math.max(1, Math.round(Math.sqrt((ids.length * TARGET_ASPECT * avgH) / cellW)));
  const positions: Record<TableId, Position> = {};
  let y = 0;
  for (let start = 0; start < ids.length; start += cols) {
    const row = ids.slice(start, start + cols);
    row.forEach((id, i) => {
      positions[id] = { x: i * cellW, y };
    });
    y += Math.max(...row.map(heightOf)) + nodeSep;
  }
  return { positions, routes: {}, ...extent(positions, heightOf), order };
}

function shiftRoute(route: EdgeRoute, dx: number, dy: number): EdgeRoute {
  const move = (p: Position): Position => ({ x: p.x + dx, y: p.y + dy });
  return {
    waypoints: route.waypoints.map(move),
    sourceAt: move(route.sourceAt),
    targetAt: move(route.targetAt),
  };
}

/**
 * Shelf packing: tallest boxes first, left to right, new shelf past the target row width. A shelf
 * is as tall as its first (tallest) box, and the boxes after it are stacked in columns inside that
 * height instead of each standing on the shelf floor, so one very tall component no longer leaves
 * an empty band beside it (QA-034). A box only goes under the previous one when it fits within the
 * shelf height, so a shelf is never taller, nor a row wider, than plain shelf packing.
 */
function shelfPack(boxes: Box[], tableOrder: TableId[]): DagreLayoutResult {
  const sorted = [...boxes].sort((a, b) => b.height - a.height || a.order - b.order);
  const area = sorted.reduce(
    (sum, b) => sum + (b.width + COMPONENT_GAP) * (b.height + COMPONENT_GAP),
    0,
  );
  const widest = Math.max(0, ...sorted.map((b) => b.width));
  const rowWidth = Math.max(widest, Math.sqrt(area * TARGET_ASPECT));

  const positions: Record<TableId, Position> = {};
  const edgeRoutes: Record<RelationshipId, EdgeRoute> = {};
  let shelfY = 0;
  let shelfHeight = 0;
  // The column being filled: left edge, widest box so far, and where the next box starts.
  let colX = 0;
  let colWidth = 0;
  let colBottom = 0;
  let started = false;
  for (const box of sorted) {
    let x: number;
    let y: number;
    if (started && colBottom + COMPONENT_GAP + box.height <= shelfHeight) {
      x = colX;
      y = shelfY + colBottom + COMPONENT_GAP;
      colWidth = Math.max(colWidth, box.width);
      colBottom += COMPONENT_GAP + box.height;
    } else {
      const nextX = started ? colX + colWidth + COMPONENT_GAP : 0;
      if (started && nextX + box.width > rowWidth) {
        shelfY += shelfHeight + COMPONENT_GAP;
        shelfHeight = box.height;
        x = 0;
      } else {
        x = nextX;
        if (!started) shelfHeight = box.height;
      }
      y = shelfY;
      colX = x;
      colWidth = box.width;
      colBottom = box.height;
      started = true;
    }
    for (const [id, p] of Object.entries(box.positions)) {
      positions[id] = { x: Math.round(p.x + x), y: Math.round(p.y + y) };
    }
    for (const [id, route] of Object.entries(box.routes)) {
      edgeRoutes[id] = shiftRoute(route, x, y);
    }
  }
  // Stable key order (declaration order), like layoutWithDagre.
  const ordered: Record<TableId, Position> = {};
  for (const id of tableOrder) {
    const p = positions[id];
    if (p) ordered[id] = p;
  }
  return { positions: ordered, edgeRoutes };
}
