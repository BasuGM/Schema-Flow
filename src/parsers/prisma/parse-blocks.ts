import type { PrismaToken } from "./lexer";

export type PrismaValue =
  | { kind: "string"; value: string; text: string }
  | { kind: "number"; value: string }
  | { kind: "ident"; value: string }
  | { kind: "array"; items: PrismaValue[] }
  | { kind: "call"; name: string; args: PrismaArg[] };

export interface PrismaArg {
  key?: string;
  value: PrismaValue;
}

export interface PrismaAttribute {
  /** E.g. `id`, `relation`, `db.VarChar`. */
  name: string;
  args: PrismaArg[];
}

export interface PrismaField {
  kind: "field";
  name: string;
  type: string;
  /** Arguments of the type itself, e.g. `Unsupported("circle")`. */
  typeArgs: PrismaArg[];
  list: boolean;
  optional: boolean;
  attributes: PrismaAttribute[];
  line: number;
  doc?: string;
}

export type PrismaMember =
  | PrismaField
  | { kind: "blockAttribute"; attribute: PrismaAttribute; line: number }
  | { kind: "assignment"; key: string; value: PrismaValue; line: number }
  | { kind: "enumValue"; name: string; attributes: PrismaAttribute[]; line: number; doc?: string };

export interface PrismaBlock {
  /** `model`, `enum`, `view`, `type`, `datasource`, `generator`, … */
  keyword: string;
  name: string;
  line: number;
  members: PrismaMember[];
  doc?: string;
}

/** `table` is the raw (optionally schema-qualified) table name the issue concerns, for linking. */
export type Warn = (message: string, line?: number, table?: string) => void;

class PrismaSyntaxError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

/** Keywords whose bodies hold fields; `enum` holds values; the rest hold `key = value`. */
const FIELD_BLOCKS = new Set(["model", "view", "type"]);
const KNOWN_BLOCKS = new Set([...FIELD_BLOCKS, "enum", "datasource", "generator"]);

/**
 * Parses top-level blocks. Tolerant: an unparseable line becomes a warning and is skipped, an
 * unknown or malformed block is skipped with a warning, and a missing `}` keeps what was read.
 */
export function parsePrismaBlocks(tokens: PrismaToken[], warn: Warn): PrismaBlock[] {
  const blocks: PrismaBlock[] = [];
  let i = 0;
  let doc: string[] = [];
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t.kind === "nl") {
      i++;
      continue;
    }
    if (t.kind === "doc") {
      doc.push(t.value);
      i++;
      continue;
    }
    const name = tokens[i + 1];
    const open = tokens[i + 2];
    const isBlock =
      t.kind === "ident" && name?.kind === "ident" && open?.kind === "punct" && open.text === "{";
    if (!isBlock) {
      warn(
        `Expected a block such as "model Name {", found "${t.text}". The line was skipped.`,
        t.line,
      );
      i = skipLine(tokens, i);
      doc = [];
      continue;
    }
    const close = matchingBrace(tokens, i + 2);
    // Model names equal table names unless @@map'ed; normalize links only names that exist.
    const subject = t.text === "model" ? name.text : undefined;
    if (close === -1) warn(`Block "${name.text}" is missing a closing "}".`, t.line, subject);
    const body = tokens.slice(i + 3, close === -1 ? tokens.length : close);
    i = close === -1 ? tokens.length : close + 1;
    if (!KNOWN_BLOCKS.has(t.text)) {
      warn(`Unknown block "${t.text} ${name.text}" was skipped.`, t.line);
      doc = [];
      continue;
    }
    const block: PrismaBlock = { keyword: t.text, name: name.text, line: t.line, members: [] };
    if (doc.length > 0) block.doc = doc.join("\n");
    doc = [];
    parseBody(block, body, warn);
    blocks.push(block);
  }
  return blocks;
}

/** Index after the current line; a `{ … }` region on the line is skipped as a whole. */
function skipLine(tokens: PrismaToken[], start: number): number {
  let k = start;
  while (k < tokens.length && tokens[k]!.kind !== "nl") {
    if (tokens[k]!.text === "{") {
      const close = matchingBrace(tokens, k);
      return close === -1 ? tokens.length : close + 1;
    }
    k++;
  }
  return k;
}

function matchingBrace(tokens: PrismaToken[], open: number): number {
  let depth = 0;
  for (let k = open; k < tokens.length; k++) {
    const t = tokens[k]!;
    if (t.kind !== "punct") continue;
    if (t.text === "{") depth++;
    else if (t.text === "}" && --depth === 0) return k;
  }
  return -1;
}

/**
 * Splits a block body into logical lines (line breaks inside `(…)` / `[…]` don't count, so
 * multi-line attribute arguments work) and parses each one independently.
 */
function parseBody(block: PrismaBlock, body: PrismaToken[], warn: Warn): void {
  let line: PrismaToken[] = [];
  let depth = 0;
  let doc: string[] = [];
  const flush = () => {
    const trailing = line.at(-1)?.kind === "doc" ? line.pop()!.value : undefined;
    if (line.length === 0) {
      if (trailing !== undefined) doc.push(trailing);
      return;
    }
    const member = parseMemberSafely(block, line, warn);
    const text = [...doc, ...(trailing !== undefined ? [trailing] : [])].join("\n");
    if (member && text && (member.kind === "field" || member.kind === "enumValue"))
      member.doc = text;
    if (member) block.members.push(member);
    doc = [];
    line = [];
  };
  for (let k = 0; k < body.length; k++) {
    const t = body[k]!;
    if (t.kind === "punct" && (t.text === "(" || t.text === "[")) depth++;
    else if (t.kind === "punct" && (t.text === ")" || t.text === "]"))
      depth = Math.max(0, depth - 1);
    if (t.kind === "nl") {
      // An unclosed `(` must not swallow the rest of the block: a line that starts like a member
      // (`name Type`, `@@…`) always begins a new logical line.
      if (depth === 0 || startsMember(body, k + 1)) {
        depth = 0;
        flush();
      }
      continue;
    }
    if (t.kind === "doc" && depth > 0) continue;
    line.push(t);
  }
  flush();
}

function startsMember(tokens: PrismaToken[], start: number): boolean {
  let k = start;
  while (tokens[k]?.kind === "nl") k++;
  const first = tokens[k];
  const second = tokens[k + 1];
  if (first?.kind === "punct" && first.text === "@@") return true;
  return first?.kind === "ident" && second?.kind === "ident" && second.line === first.line;
}

function parseMemberSafely(
  block: PrismaBlock,
  tokens: PrismaToken[],
  warn: Warn,
): PrismaMember | undefined {
  const c = new Cursor(tokens);
  try {
    const member = parseMember(block.keyword, c);
    if (!c.done) c.fail("Expected the end of the line");
    return member;
  } catch (error) {
    const detail = error instanceof PrismaSyntaxError ? error.message : "unexpected parser error";
    const line = error instanceof PrismaSyntaxError ? error.line : tokens[0]!.line;
    warn(
      `Could not parse a line in ${block.keyword} "${block.name}": ${detail}. The line was skipped.`,
      line,
      block.keyword === "model" ? block.name : undefined,
    );
    return undefined;
  }
}

function parseMember(keyword: string, c: Cursor): PrismaMember {
  const line = c.peek()!.line;
  if (c.acceptPunct("@@"))
    return { kind: "blockAttribute", attribute: parseAttributeBody(c), line };
  const name = c.expectIdent("a name");
  if (keyword === "enum") return { kind: "enumValue", name, attributes: parseAttributes(c), line };
  if (!FIELD_BLOCKS.has(keyword)) {
    c.expectPunct("=");
    return { kind: "assignment", key: name, value: parseValue(c), line };
  }
  const type = c.expectIdent("a field type");
  const typeArgs = c.isPunct("(") ? parseArgs(c) : [];
  let list = false;
  if (c.acceptPunct("[")) {
    c.expectPunct("]");
    list = true;
  }
  const optional = c.acceptPunct("?");
  return {
    kind: "field",
    name,
    type,
    typeArgs,
    list,
    optional,
    attributes: parseAttributes(c),
    line,
  };
}

function parseAttributes(c: Cursor): PrismaAttribute[] {
  const attributes: PrismaAttribute[] = [];
  while (c.acceptPunct("@")) attributes.push(parseAttributeBody(c));
  return attributes;
}

/** After `@` or `@@`: `name[.name][(args)]`. */
function parseAttributeBody(c: Cursor): PrismaAttribute {
  let name = c.expectIdent("an attribute name");
  if (c.acceptPunct(".")) name += `.${c.expectIdent("an attribute name")}`;
  return { name, args: c.isPunct("(") ? parseArgs(c) : [] };
}

/** `( [key:] value, … )` */
function parseArgs(c: Cursor): PrismaArg[] {
  c.expectPunct("(");
  const args: PrismaArg[] = [];
  while (!c.isPunct(")")) {
    const t = c.peek();
    const keyed = t?.kind === "ident" && c.peek(1)?.text === ":";
    if (keyed) {
      c.next();
      c.next();
    }
    args.push(keyed ? { key: t.text, value: parseValue(c) } : { value: parseValue(c) });
    if (!c.acceptPunct(",")) break;
  }
  c.expectPunct(")");
  return args;
}

function parseValue(c: Cursor): PrismaValue {
  const t = c.next();
  if (!t) return c.fail("Expected a value");
  if (t.kind === "string") return { kind: "string", value: t.value, text: t.text };
  if (t.kind === "number") return { kind: "number", value: t.text };
  if (t.kind === "punct" && t.text === "[") {
    const items: PrismaValue[] = [];
    while (!c.isPunct("]")) {
      items.push(parseValue(c));
      if (!c.acceptPunct(",")) break;
    }
    c.expectPunct("]");
    return { kind: "array", items };
  }
  if (t.kind === "ident") {
    let name = t.text;
    while (c.isPunct(".") && c.peek(1)?.kind === "ident") {
      c.next();
      name += `.${c.next()!.text}`;
    }
    return c.isPunct("(")
      ? { kind: "call", name, args: parseArgs(c) }
      : { kind: "ident", value: name };
  }
  throw new PrismaSyntaxError(`Unexpected "${t.text}"`, t.line);
}

class Cursor {
  private i = 0;
  constructor(private readonly tokens: PrismaToken[]) {}

  get done(): boolean {
    return this.i >= this.tokens.length;
  }
  peek(offset = 0): PrismaToken | undefined {
    return this.tokens[this.i + offset];
  }
  next(): PrismaToken | undefined {
    return this.tokens[this.i++];
  }
  isPunct(text: string): boolean {
    const t = this.peek();
    return t?.kind === "punct" && t.text === text;
  }
  acceptPunct(text: string): boolean {
    if (!this.isPunct(text)) return false;
    this.i++;
    return true;
  }
  expectPunct(text: string): void {
    if (!this.acceptPunct(text)) this.fail(`Expected "${text}"`);
  }
  expectIdent(what: string): string {
    const t = this.peek();
    if (t?.kind !== "ident") return this.fail(`Expected ${what}`);
    this.i++;
    return t.text;
  }
  fail(message: string): never {
    const t = this.peek() ?? this.tokens.at(-1);
    const found = this.peek() ? `, found "${this.peek()!.text}"` : "";
    throw new PrismaSyntaxError(`${message}${found}`, t?.line ?? 1);
  }
}
