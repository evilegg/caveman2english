import { describe, it, expect } from "vitest";
import { arrowsRule } from "../../src/rules/arrows.js";

describe("arrowsRule", () => {
  it("expands → with surrounding spaces", () => {
    expect(arrowsRule.apply("cache miss → re-render")).toBe(
      "cache miss, which leads to re-render",
    );
  });

  it("expands -> ASCII arrow", () => {
    expect(arrowsRule.apply("stale ref -> wrong value")).toBe(
      "stale ref, which leads to wrong value",
    );
  });

  it("expands => to 'which results in'", () => {
    expect(arrowsRule.apply("bad input => error")).toBe(
      "bad input, which results in error",
    );
  });

  it("handles arrow at start of sentence after punctuation", () => {
    const result = arrowsRule.apply("Component mounts. Props change → re-render.");
    expect(result).toContain("which leads to");
  });

  it("does not modify content inside backtick code spans", () => {
    // Code spans are handled by the caller (expand.ts splits them out),
    // but raw text with backtick arrows should not break things.
    const input = "normal text → expanded. No backtick here.";
    expect(arrowsRule.apply(input)).toContain("which leads to");
  });

  it("handles multi-arrow chains", () => {
    const result = arrowsRule.apply("A → B → C");
    expect(result).toContain("which leads to");
  });
});
