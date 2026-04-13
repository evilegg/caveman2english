import { describe, it, expect } from "vitest";
import { punctuationRule } from "../../src/rules/punctuation.js";

describe("punctuationRule", () => {
  it("capitalizes first character", () => {
    expect(punctuationRule.apply("wrap in useMemo.")).toBe("Wrap in useMemo.");
  });

  it("capitalizes after period + space", () => {
    expect(punctuationRule.apply("First sentence. second sentence.")).toBe(
      "First sentence. Second sentence.",
    );
  });

  it("adds terminal period when missing", () => {
    expect(punctuationRule.apply("missing period")).toBe("Missing period.");
  });

  it("does not double-add period", () => {
    expect(punctuationRule.apply("already has period.")).toBe("Already has period.");
  });

  it("does not add period after question mark", () => {
    expect(punctuationRule.apply("why does this fail?")).toBe("Why does this fail?");
  });

  it("collapses multiple spaces", () => {
    expect(punctuationRule.apply("too  many   spaces")).toBe("Too many spaces.");
  });

  it("does not modify text already ending with code fence", () => {
    const input = "Some text\n```\ncode here\n```";
    const result = punctuationRule.apply(input);
    expect(result.trimEnd()).toMatch(/```$/);
  });
});
