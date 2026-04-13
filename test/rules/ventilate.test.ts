import { describe, it, expect } from "vitest";
import { ventilateRule } from "../../src/rules/ventilate.js";

describe("ventilateRule", () => {
  it("puts each sentence on its own line", () => {
    const input = "First sentence. Second sentence. Third sentence.";
    const result = ventilateRule.apply(input);
    expect(result).toBe("First sentence.\nSecond sentence.\nThird sentence.");
  });

  it("preserves blank lines between paragraphs", () => {
    const input = "Para one sentence one. Para one sentence two.\n\nPara two sentence one.";
    const result = ventilateRule.apply(input);
    expect(result).toBe(
      "Para one sentence one.\nPara one sentence two.\n\nPara two sentence one.",
    );
  });

  it("handles a single sentence with no splits needed", () => {
    expect(ventilateRule.apply("Just one sentence.")).toBe("Just one sentence.");
  });

  it("splits after exclamation marks", () => {
    const input = "It works! Great result.";
    expect(ventilateRule.apply(input)).toBe("It works!\nGreat result.");
  });

  it("splits after question marks", () => {
    const input = "Why does this fail? Check the logs.";
    expect(ventilateRule.apply(input)).toBe("Why does this fail?\nCheck the logs.");
  });

  it("does not split mid-sentence on lowercase after period", () => {
    // "e.g. something" should not split because next word is lowercase
    const input = "Use a short form, e.g. cfg. Then restart.";
    const result = ventilateRule.apply(input);
    // Should not split at "e.g. cfg" but should split at ". Then"
    expect(result).toContain("\nThen restart.");
    expect(result).not.toContain("\ncfg.");
  });

  it("handles empty input", () => {
    expect(ventilateRule.apply("")).toBe("");
  });

  it("trims leading/trailing whitespace from each paragraph", () => {
    expect(ventilateRule.apply("  Hello world.  ")).toBe("Hello world.");
  });
});
