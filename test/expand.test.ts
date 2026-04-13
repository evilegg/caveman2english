import { describe, it, expect } from "vitest";
import { expandDeterministic, splitCodeSegments, wordCount } from "../src/expand.js";

describe("splitCodeSegments", () => {
  it("returns single text segment for plain text", () => {
    const segs = splitCodeSegments("hello world");
    expect(segs).toEqual([{ type: "text", content: "hello world" }]);
  });

  it("splits fenced code block from surrounding text", () => {
    const input = "before\n```\ncode\n```\nafter";
    const segs = splitCodeSegments(input);
    expect(segs[0]).toEqual({ type: "text", content: "before\n" });
    expect(segs[1].type).toBe("code");
    expect(segs[1].content).toContain("code");
    expect(segs[2]).toEqual({ type: "text", content: "\nafter" });
  });

  it("splits inline code span from surrounding text", () => {
    const input = "wrap in `useMemo` hook";
    const segs = splitCodeSegments(input);
    expect(segs[0]).toEqual({ type: "text", content: "wrap in " });
    expect(segs[1]).toEqual({ type: "code", content: "`useMemo`" });
    expect(segs[2]).toEqual({ type: "text", content: " hook" });
  });
});

describe("wordCount", () => {
  it("counts words correctly", () => {
    expect(wordCount("one two three")).toBe(3);
  });

  it("handles empty string", () => {
    expect(wordCount("")).toBe(0);
  });

  it("handles extra whitespace", () => {
    expect(wordCount("  one   two  ")).toBe(2);
  });
});

describe("expandDeterministic", () => {
  it("expands canonical caveman example from the spec", () => {
    const input =
      "New obj ref each render. Inline obj prop = new ref. Wrap in useMemo.";
    const result = expandDeterministic(input);
    // Should expand abbreviations
    expect(result).toContain("object");
    expect(result).toContain("reference");
    // useMemo should be unchanged (it's a technical term not in abbrev dict)
    expect(result).toContain("useMemo");
  });

  it("preserves fenced code blocks verbatim", () => {
    const input = "fix auth\n```js\nconst db = new DB()\n```\nthen restart";
    const result = expandDeterministic(input);
    // Inside the code block, DB should NOT be expanded
    expect(result).toContain("const db = new DB()");
    // Outside the code block, auth should be expanded
    expect(result).toContain("authentication");
  });

  it("preserves inline code verbatim", () => {
    const input = "call `DB.connect()` to open connection";
    const result = expandDeterministic(input);
    expect(result).toContain("`DB.connect()`");
    // The word DB outside backticks would be expanded; inside backticks it stays.
  });

  it("expands arrow notation", () => {
    const input = "stale cache → wrong render";
    const result = expandDeterministic(input);
    expect(result).toContain("which leads to");
  });

  it("capitalizes first word", () => {
    const result = expandDeterministic("wrap in useMemo");
    expect(result[0]).toBe(result[0].toUpperCase());
  });

  it("handles empty input", () => {
    expect(expandDeterministic("")).toBe("");
  });

  it("passes through text with no caveman patterns unchanged (modulo capitalization)", () => {
    const input = "This is already good English prose.";
    const result = expandDeterministic(input);
    expect(result).toBe(input);
  });
});
