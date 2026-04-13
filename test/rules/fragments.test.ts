import { describe, it, expect } from "vitest";
import { createFragmentsRule } from "../../src/rules/fragments.js";

// ---------------------------------------------------------------------------
// Level 0 — off
// ---------------------------------------------------------------------------
describe("createFragmentsRule(0) — off", () => {
  const rule = createFragmentsRule(0);

  it("returns text unchanged", () => {
    expect(rule.apply("New obj ref each render.")).toBe("New obj ref each render.");
  });

  it("returns multi-sentence text unchanged", () => {
    const input = "Missing token. Wrong reference.";
    expect(rule.apply(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Level 1 — conservative
// ---------------------------------------------------------------------------
describe("createFragmentsRule(1) — conservative", () => {
  const rule = createFragmentsRule(1);

  it("completes a narrow adjective-led fragment with 'exists'", () => {
    expect(rule.apply("New object reference each render.")).toContain("exists");
  });

  it("does not fire on an adjective not in the narrow list", () => {
    // "Malformed" is not in the conservative list
    expect(rule.apply("Malformed token response.")).toBe("Malformed token response.");
  });

  it("does not touch imperatives", () => {
    expect(rule.apply("Wrap in useMemo.")).toBe("Wrap in useMemo.");
  });

  it("does not touch sentences that already have a verb", () => {
    expect(rule.apply("The token is missing.")).toBe("The token is missing.");
  });

  it("handles 'Missing' (in narrow list) — fires", () => {
    const result = rule.apply("Missing token.");
    expect(result).toContain("exists");
  });
});

// ---------------------------------------------------------------------------
// Level 2 — moderate
// ---------------------------------------------------------------------------
describe("createFragmentsRule(2) — moderate", () => {
  const rule = createFragmentsRule(2);

  it("restructures adj-led fragment: moves adj after 'is'", () => {
    // "Missing auth token." → "The auth token is missing."
    const result = rule.apply("Missing auth token.");
    expect(result).toMatch(/The auth token is missing\./i);
  });

  it("restructures wrong-reference fragment", () => {
    const result = rule.apply("Wrong object reference.");
    expect(result).toMatch(/The object reference is wrong\./i);
  });

  it("handles adjective + noun + frequency phrase", () => {
    // "New object reference each render." → "The object reference is new on each render."
    const result = rule.apply("New object reference each render.");
    expect(result).toMatch(/object reference is new/i);
    expect(result).toMatch(/each render/i);
  });

  it("completes noun + bare frequency phrase with 'occurs'", () => {
    // "Cache miss each render." → "Cache miss occurs on each render."
    const result = rule.apply("Cache miss each render.");
    expect(result).toMatch(/occurs/i);
    expect(result).toMatch(/each render/i);
  });

  it("fires on broader adj list not in conservative list", () => {
    // "Malformed" is in the moderate list
    const result = rule.apply("Malformed token response.");
    expect(result).not.toBe("Malformed token response.");
  });

  it("does not touch imperatives", () => {
    expect(rule.apply("Check the logs.")).toBe("Check the logs.");
  });

  it("does not touch sentences that already have a verb", () => {
    expect(rule.apply("The token is missing.")).toBe("The token is missing.");
  });

  it("handles multi-sentence input — only fragments are changed", () => {
    const input = "Auth flow broken. The token is valid. Missing config file.";
    const result = rule.apply(input);
    // "The token is valid." — has verb, unchanged
    expect(result).toContain("The token is valid.");
    // "Missing config file." — fragment, should be restructured
    expect(result).toMatch(/config file is missing/i);
  });
});

// ---------------------------------------------------------------------------
// Level 3 — aggressive (context-aware)
// ---------------------------------------------------------------------------
describe("createFragmentsRule(3) — aggressive", () => {
  const rule = createFragmentsRule(3);

  it("matches past tense from prior sentence", () => {
    // "Component re-rendered. Wrong object reference." →
    // "...The object reference was wrong."
    const input = "Component re-rendered. Wrong object reference.";
    const result = rule.apply(input);
    expect(result).toMatch(/was wrong/i);
  });

  it("uses present tense when prior sentence is present tense", () => {
    const input = "Component re-renders. Wrong object reference.";
    const result = rule.apply(input);
    expect(result).toMatch(/is wrong/i);
  });

  it("adjusts 'occurs' to 'occurred' in past-tense context", () => {
    const input = "The component failed to mount. Cache miss each render.";
    const result = rule.apply(input);
    expect(result).toMatch(/occurred/i);
  });

  it("does not touch imperatives", () => {
    const input = "Auth broken. Fix the middleware.";
    const result = rule.apply(input);
    expect(result).toContain("Fix the middleware.");
  });

  it("first sentence (no prior context) still completes", () => {
    // No prior sentence, defaults to present tense
    const result = rule.apply("Missing token.");
    expect(result).toMatch(/is missing/i);
  });
});
