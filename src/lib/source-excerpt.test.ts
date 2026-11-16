import { describe, expect, it } from "vitest";
import { createLineIndex, excerpt, MAX_EXCERPT_LINE } from "./source-excerpt";

const lines = (text: string, line: number, context?: number) =>
  excerpt(text, createLineIndex(text), line, context).map((l) => [l.number, l.text, l.current]);

describe("source excerpts", () => {
  const text = "l1\nl2\nl3\nl4\nl5\nl6";

  it("returns ±2 lines around the issue line, clamped to the text", () => {
    expect(lines(text, 3)).toEqual([
      [1, "l1", false],
      [2, "l2", false],
      [3, "l3", true],
      [4, "l4", false],
      [5, "l5", false],
    ]);
    expect(lines(text, 1).map((l) => l[0])).toEqual([1, 2, 3]);
    expect(lines(text, 6).map((l) => l[0])).toEqual([4, 5, 6]);
  });

  it("handles CRLF, a BOM, and lines outside the text", () => {
    expect(lines("﻿a\r\nb\r\n", 1, 1)).toEqual([
      [1, "a", true],
      [2, "b", false],
    ]);
    expect(lines(text, 7)).toEqual([]);
    expect(lines(text, 0)).toEqual([]);
  });

  it("cuts long lines and reports the rest, even for a 5 MB single-line source", () => {
    const big = `CREATE TABLE a (${"x int, ".repeat(750_000)}y int);`;
    expect(big.length).toBeGreaterThan(5_000_000);
    // The index is one linear scan per source (built once); the excerpt itself slices ≤ 400 chars.
    let start = performance.now();
    const index = createLineIndex(big);
    expect(performance.now() - start).toBeLessThan(1000);
    start = performance.now();
    const [only] = excerpt(big, index, 1);
    expect(performance.now() - start).toBeLessThan(20);
    expect(only?.text).toHaveLength(MAX_EXCERPT_LINE);
    expect(only?.truncated).toBe(big.length - MAX_EXCERPT_LINE);
  });
});
