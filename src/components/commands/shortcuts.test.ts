// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { matchShortcut, shortcutLabels, SHORTCUTS } from "./shortcuts";

const press = (key: string, init: KeyboardEventInit = {}) =>
  matchShortcut(new KeyboardEvent("keydown", { key, ...init }))?.id ?? null;

describe("matchShortcut", () => {
  it("matches plain keys, uppercase letters and CapsLock the same", () => {
    expect(press("l")).toBe("layout");
    expect(press("L", { shiftKey: true })).toBe("layout");
    expect(press("L")).toBe("layout"); // CapsLock: key is uppercase without Shift
    expect(press("[")).toBe("toggle-list");
    expect(press("]")).toBe("toggle-inspector");
  });
  it("opens help on Shift+/ (?) and search on /, never the other way round", () => {
    expect(press("?", { shiftKey: true })).toBe("shortcuts");
    expect(press("/")).toBe("search");
  });
  it("matches ⌘K and Ctrl+K only with a modifier and without Shift", () => {
    expect(press("k", { metaKey: true })).toBe("search");
    expect(press("k", { ctrlKey: true })).toBe("search");
    expect(press("k")).toBeNull();
    expect(press("k", { ctrlKey: true, shiftKey: true })).toBeNull();
  });
  it("ignores Ctrl, Meta and Alt combinations and key repeat", () => {
    expect(press("l", { ctrlKey: true })).toBeNull();
    expect(press("e", { metaKey: true })).toBeNull();
    expect(press("f", { altKey: true })).toBeNull();
    expect(press("l", { repeat: true })).toBeNull();
  });
  it("has unique ids and keys", () => {
    const keys = SHORTCUTS.flatMap((s) => s.bindings.map((b) => `${b.mod ? "mod+" : ""}${b.key}`));
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
  });
  it("labels per platform", () => {
    const search = SHORTCUTS.find((s) => s.id === "search")!;
    expect(shortcutLabels(search, true)).toEqual(["⌘K", "/"]);
    expect(shortcutLabels(search, false)).toEqual(["Ctrl+K", "/"]);
  });
});
