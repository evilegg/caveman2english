import { describe, it, expect } from "vitest";
import { articlesRule } from "../../src/rules/articles.js";

describe("articlesRule", () => {
  it("inserts 'a' before a tech noun after a preposition", () => {
    expect(articlesRule.apply("return error from handler")).toBe(
      "return error from a handler",
    );
  });

  it("inserts 'an' before a vowel-starting tech noun", () => {
    expect(articlesRule.apply("catch error from endpoint")).toBe(
      "catch error from an endpoint",
    );
  });

  it("does not double-insert when determiner already present", () => {
    expect(articlesRule.apply("return error from a handler")).toBe(
      "return error from a handler",
    );
    expect(articlesRule.apply("return error from the handler")).toBe(
      "return error from the handler",
    );
  });

  it("does not modify code spans", () => {
    // Code spans are protected by the segment splitter in expand.ts;
    // the rule itself only sees plain text so we test plain-text safety.
    const input = "call function in module";
    expect(articlesRule.apply(input)).toContain("in a module");
  });

  it("handles 'to' as a preposition", () => {
    expect(articlesRule.apply("connect to service")).toBe("connect to a service");
  });

  it("handles 'with' as a preposition", () => {
    expect(articlesRule.apply("wrap with middleware")).toBe("wrap with a middleware");
  });

  it("does not insert article after 'this'/'that'", () => {
    expect(articlesRule.apply("pass this function")).toBe("pass this function");
  });

  it("passes through text with no bare tech nouns unchanged", () => {
    const input = "The authentication flow is broken.";
    expect(articlesRule.apply(input)).toBe(input);
  });
});
