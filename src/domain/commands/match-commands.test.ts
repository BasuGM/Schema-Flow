import { describe, expect, it } from "vitest";
import { matchCommands, type CommandSpec } from "./match-commands";

const spec = (id: string, label: string, keywords: string[] = []): CommandSpec => ({
  id,
  label,
  group: "g",
  keywords,
});
const items = [
  spec("export", "Export…"),
  spec("image", "Export image…", ["png", "svg"]),
  spec("layout", "Layout"),
  spec("dark", "Theme: dark", ["appearance"]),
  spec("health", "Open health panel", ["lint", "check"]),
];
const ids = (q: string) => matchCommands(items, q).map((c) => c.id);

describe("matchCommands", () => {
  it("returns everything in order for an empty query", () => {
    expect(ids("  ")).toEqual(["export", "image", "layout", "dark", "health"]);
  });
  it("ranks label prefix first, then word prefix, keeping input order on ties", () => {
    expect(ids("lay")).toEqual(["layout"]);
    expect(ids("exp")).toEqual(["export", "image"]);
    expect(ids("health")).toEqual(["health"]);
    expect(ids("panel")).toEqual(["health"]);
  });
  it("is case-insensitive and matches keywords", () => {
    expect(ids("LAYOUT")).toEqual(["layout"]);
    expect(ids("png")).toEqual(["image"]);
    expect(ids("appear")).toEqual(["dark"]);
  });
  it("needs every token to match", () => {
    expect(ids("export png")).toEqual(["image"]);
    expect(ids("export zzz")).toEqual([]);
  });
  it("ranks a label match above a keyword-only match", () => {
    const list = [spec("a", "Alpha", ["theme"]), spec("b", "Theme")];
    expect(matchCommands(list, "theme").map((c) => c.id)).toEqual(["b", "a"]);
  });
});
