import { describe, it, expect } from "vitest";
import { expandDeterministic } from "../src/expand.js";

// End-to-end tests using real caveman output examples from the JuliusBrussee/caveman spec.

describe("integration — real caveman examples", () => {
  it("expands the canonical React re-render example", () => {
    // Caveman Full mode output from the spec
    const input =
      "New obj ref each render. Inline obj prop = new ref. Wrap in useMemo.";
    const result = expandDeterministic(input);

    expect(result).toMatch(/object/i);
    expect(result).toMatch(/reference/i);
    expect(result).toMatch(/useMemo/);
    // Should be a complete sentence
    expect(result.trimEnd()).toMatch(/[.!?]$/);
  });

  it("expands arrow-based causality chain", () => {
    const input = "prop change → re-render → DB query. Cache first.";
    const result = expandDeterministic(input);

    expect(result).toMatch(/which leads to/);
    expect(result).toMatch(/database/i);
  });

  it("expands a multi-sentence auth explanation", () => {
    const input =
      "Auth flow broken. Token missing from env. Check cfg file. Restart server.";
    const result = expandDeterministic(input);

    expect(result).toMatch(/authentication/i);
    expect(result).toMatch(/environment/i);
    expect(result).toMatch(/configuration/i);
  });

  it("handles mixed prose and code block", () => {
    const input = [
      "Fix auth middleware. Add token check:",
      "```ts",
      "const token = req.headers['authorization']",
      "```",
      "Return 401 if missing.",
    ].join("\n");

    const result = expandDeterministic(input);

    // Prose expanded
    expect(result).toMatch(/authentication/i);
    // Code block preserved exactly
    expect(result).toContain("const token = req.headers['authorization']");
    // req/res inside code NOT expanded
    expect(result).not.toContain("const token = request.headers");
  });

  it("does not corrupt already-readable English", () => {
    const input =
      "The authentication middleware checks the token on every request. If the token is missing, it returns a 401 error.";
    const result = expandDeterministic(input);
    // Should remain semantically equivalent — no broken expansions
    expect(result).toContain("authentication");
    expect(result).toContain("token");
    expect(result).toContain("401");
  });
});
