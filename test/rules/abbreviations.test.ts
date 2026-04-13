import { describe, it, expect } from "vitest";
import { abbreviationsRule } from "../../src/rules/abbreviations.js";

describe("abbreviationsRule", () => {
  it("expands DB to database", () => {
    expect(abbreviationsRule.apply("query the DB")).toBe("query the database");
  });

  it("expands auth to authentication", () => {
    expect(abbreviationsRule.apply("fix auth flow")).toBe("fix authentication flow");
  });

  it("expands fn to function", () => {
    expect(abbreviationsRule.apply("wrap in fn")).toBe("wrap in function");
  });

  it("expands deps to dependencies", () => {
    expect(abbreviationsRule.apply("update deps")).toBe("update dependencies");
  });

  it("expands env to environment", () => {
    expect(abbreviationsRule.apply("read from env")).toBe("read from environment");
  });

  it("expands DB to lowercase database (punctuation rule handles sentence caps)", () => {
    // The abbreviations rule always emits lowercase; the punctuation rule
    // capitalises the first word of a sentence in the pipeline.
    const result = abbreviationsRule.apply("DB connection failed");
    expect(result).toBe("database connection failed");
  });

  it("expands obj to object", () => {
    expect(abbreviationsRule.apply("new obj ref")).toBe("new object reference");
  });

  it("does not expand partial word matches", () => {
    // "DBPool" should NOT become "databasePool"
    expect(abbreviationsRule.apply("DBPool")).toBe("DBPool");
  });

  it("expands w/ to with", () => {
    expect(abbreviationsRule.apply("wrap w/ useMemo")).toBe("wrap with useMemo");
  });
});
