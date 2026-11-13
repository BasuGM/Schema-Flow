import type { Token } from "./tokenizer";

/** Thrown for a malformed statement; caught per statement by `parseSql` and turned into a warning. */
export class SqlSyntaxError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(message);
    this.name = "SqlSyntaxError";
  }
}

export interface QualifiedName {
  name: string;
  schemaName?: string;
}

/** Cursor over one statement's tokens with keyword-aware helpers. */
export class TokenStream {
  private pos = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly source: string,
  ) {}

  get done(): boolean {
    return this.pos >= this.tokens.length;
  }

  peek(ahead = 0): Token | undefined {
    return this.tokens[this.pos + ahead];
  }

  next(): Token | undefined {
    const t = this.tokens[this.pos];
    if (t) this.pos++;
    return t;
  }

  /** Current line for error messages. */
  get line(): number | undefined {
    return (this.peek() ?? this.tokens.at(-1))?.line;
  }

  isKeyword(word: string, ahead = 0): boolean {
    const t = this.peek(ahead);
    return t?.kind === "word" && t.value.toUpperCase() === word;
  }

  /** Consumes the keyword sequence if every word matches; otherwise consumes nothing. */
  acceptKeywords(...words: string[]): boolean {
    if (!words.every((w, k) => this.isKeyword(w, k))) return false;
    this.pos += words.length;
    return true;
  }

  /** Accepts the first matching alternative (a word or a word sequence). */
  acceptAny(...alternatives: (string | string[])[]): boolean {
    return alternatives.some((alt) =>
      Array.isArray(alt) ? this.acceptKeywords(...alt) : this.acceptKeywords(alt),
    );
  }

  expectKeywords(...words: string[]): void {
    if (!this.acceptKeywords(...words)) this.fail(`Expected ${words.join(" ")}`);
  }

  isPunct(p: string, ahead = 0): boolean {
    const t = this.peek(ahead);
    return t?.kind === "punct" && t.text === p;
  }

  acceptPunct(p: string): boolean {
    if (!this.isPunct(p)) return false;
    this.pos++;
    return true;
  }

  expectPunct(p: string): void {
    if (!this.acceptPunct(p)) this.fail(`Expected "${p}"`);
  }

  /** An identifier: bare word or quoted identifier. */
  readIdentifier(what = "identifier"): string {
    const t = this.peek();
    if (t && (t.kind === "word" || t.kind === "quoted")) {
      this.pos++;
      return t.value;
    }
    return this.fail(`Expected ${what}`);
  }

  /** `name`, `schema.name` or `db.schema.name` (the last two parts are kept). */
  readQualifiedName(what = "name"): QualifiedName {
    const parts = [this.readIdentifier(what)];
    while (this.isPunct(".")) {
      this.pos++;
      parts.push(this.readIdentifier(what));
    }
    const name = parts.at(-1)!;
    const schemaName = parts.length > 1 ? parts.at(-2) : undefined;
    return schemaName ? { name, schemaName } : { name };
  }

  /** `( a, b, c )` of plain identifiers. Returns null if an element is an expression. */
  readIdentifierList(): string[] | null {
    this.expectPunct("(");
    const names: string[] = [];
    let plain = true;
    while (!this.done && !this.isPunct(")")) {
      const t = this.peek();
      const nextT = this.peek(1);
      const simple =
        t &&
        (t.kind === "word" || t.kind === "quoted") &&
        nextT?.kind === "punct" &&
        (nextT.text === "," || nextT.text === ")");
      // Allow ASC/DESC/length suffixes such as `name(10)` (MySQL) or `col DESC`.
      if (simple) {
        names.push(this.readIdentifier());
      } else if (t && (t.kind === "word" || t.kind === "quoted") && this.isSortSuffix(1)) {
        names.push(this.readIdentifier());
        this.skipUntilListEnd();
      } else {
        plain = false;
        this.skipUntilListEnd();
      }
      if (!this.acceptPunct(",")) break;
    }
    this.expectPunct(")");
    return plain ? names : null;
  }

  private isSortSuffix(ahead: number): boolean {
    const t = this.peek(ahead);
    if (!t) return false;
    // MySQL index prefix length `name(20)`; `lower(name)` (a function call) is an expression.
    if (t.kind === "punct" && t.text === "(") return this.peek(ahead + 1)?.kind === "number";
    if (t.kind !== "word") return false;
    return ["ASC", "DESC", "COLLATE", "NULLS"].includes(t.value.toUpperCase());
  }

  /** Skips to the next `,` or `)` at depth 0 without consuming it. */
  skipUntilListEnd(): void {
    let depth = 0;
    while (!this.done) {
      const t = this.peek()!;
      if (t.kind === "punct") {
        if (t.text === "(") depth++;
        else if (t.text === ")") {
          if (depth === 0) return;
          depth--;
        } else if (t.text === "," && depth === 0) return;
      }
      this.pos++;
    }
  }

  /** Consumes a balanced `( … )` group and returns its inner source text. */
  readParenthesized(): string {
    const open = this.peek();
    this.expectPunct("(");
    let depth = 1;
    let last = open!;
    while (!this.done && depth > 0) {
      const t = this.next()!;
      if (t.kind === "punct" && t.text === "(") depth++;
      else if (t.kind === "punct" && t.text === ")") depth--;
      last = t;
    }
    if (depth > 0) this.fail("Unbalanced parentheses");
    return this.source.slice(open!.offset + 1, last.offset).trim();
  }

  /** Source text from token index `start` (inclusive) to the current position (exclusive). */
  textSince(start: number): string {
    const first = this.tokens[start];
    const last = this.tokens[this.pos - 1];
    if (!first || !last || this.pos <= start) return "";
    return this.source.slice(first.offset, last.offset + last.text.length).trim();
  }

  get index(): number {
    return this.pos;
  }

  fail(message: string): never {
    const t = this.peek();
    throw new SqlSyntaxError(
      t ? `${message} near "${t.text}"` : `${message} at end of statement`,
      this.line,
    );
  }
}
