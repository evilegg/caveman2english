import { describe, it, expect } from "vitest";
import { createTasklistRule } from "../../src/rules/tasklist.js";

const rule = createTasklistRule();

// ---------------------------------------------------------------------------
// Core conversion
// ---------------------------------------------------------------------------

describe("createTasklistRule — core conversion", () => {
  it("converts 2 consecutive imperatives to a task list", () => {
    const input = "Wrap every DB call in try-finally.\nAdd error handling to the query fn.";
    const out = rule.apply(input);
    expect(out).toContain("- [ ] Wrap every DB call in try-finally");
    expect(out).toContain("- [ ] Add error handling to the query fn");
  });

  it("converts 3+ consecutive imperatives to a task list", () => {
    const input =
      "Wrap every DB call in try-finally.\nAdd error handling.\nRestart the server.";
    const out = rule.apply(input);
    expect(out).toContain("- [ ] Wrap every DB call in try-finally");
    expect(out).toContain("- [ ] Add error handling");
    expect(out).toContain("- [ ] Restart the server");
  });

  it("strips trailing period from task items", () => {
    const input = "Wrap the call.\nAdd logging.";
    const out = rule.apply(input);
    expect(out).toContain("- [ ] Wrap the call");
    expect(out).toContain("- [ ] Add logging");
    // Trailing period should not appear inside the checkbox text
    expect(out).not.toMatch(/- \[ \].*\./);
  });
});

// ---------------------------------------------------------------------------
// Single imperative — no-op
// ---------------------------------------------------------------------------

describe("createTasklistRule — single imperative (no-op)", () => {
  it("leaves a single imperative sentence as prose", () => {
    const input = "Wrap every DB call in try-finally.";
    const out = rule.apply(input);
    expect(out).not.toContain("- [ ]");
    expect(out).toContain("Wrap every DB call in try-finally");
  });

  it("leaves a single imperative in mixed prose as-is", () => {
    const input = "The token is missing.\nFix the auth flow.\nCheck the logs.";
    // "Fix" and "Check" are two imperatives → list; but "The token is missing" is prose
    const out = rule.apply(input);
    expect(out).toContain("The token is missing");
    expect(out).toContain("- [ ] Fix the auth flow");
    expect(out).toContain("- [ ] Check the logs");
  });
});

// ---------------------------------------------------------------------------
// Mixed content
// ---------------------------------------------------------------------------

describe("createTasklistRule — mixed content", () => {
  it("keeps problem description as prose, converts action steps to task list", () => {
    const input = [
      "The database connection pool is exhausted.",
      "Each request opens a new connection without releasing it.",
      "Wrap every DB call in try-finally.",
      "Add error handling to the query fn.",
      "Restart the server.",
    ].join("\n");

    const out = rule.apply(input);

    // Problem description stays as prose
    expect(out).toContain("The database connection pool is exhausted.");
    expect(out).toContain("Each request opens a new connection without releasing it.");

    // Action steps become a task list
    expect(out).toContain("- [ ] Wrap every DB call in try-finally");
    expect(out).toContain("- [ ] Add error handling to the query fn");
    expect(out).toContain("- [ ] Restart the server");
  });

  it("handles multiple prose + action blocks", () => {
    const input = [
      "Auth is broken.",
      "Fix the token expiry.",
      "Update the secret.",
      "Cache is stale.",
      "Flush the cache.",
      "Restart the service.",
    ].join("\n");

    const out = rule.apply(input);
    expect(out).toContain("Auth is broken.");
    expect(out).toContain("- [ ] Fix the token expiry");
    expect(out).toContain("- [ ] Update the secret");
    expect(out).toContain("Cache is stale.");
    expect(out).toContain("- [ ] Flush the cache");
    expect(out).toContain("- [ ] Restart the service");
  });
});

// ---------------------------------------------------------------------------
// Existing GFM list items — not re-wrapped
// ---------------------------------------------------------------------------

describe("createTasklistRule — existing list items not re-wrapped", () => {
  it("does not add checkboxes to bare dash list items", () => {
    const input = "- Wrap the call\n- Add logging";
    const out = rule.apply(input);
    // Should not double-wrap into "- [ ] - Wrap the call"
    expect(out).not.toMatch(/- \[ \]\s*-/);
  });

  it("does not modify existing GFM checkboxes", () => {
    const input = "- [ ] Wrap the call\n- [ ] Add logging";
    const out = rule.apply(input);
    expect(out).toBe("- [ ] Wrap the call\n- [ ] Add logging");
  });
});

// ---------------------------------------------------------------------------
// minRun threshold
// ---------------------------------------------------------------------------

describe("createTasklistRule — minRun option", () => {
  it("default minRun=2 converts pairs", () => {
    const rule2 = createTasklistRule({ minRun: 2 });
    const input = "Wrap the call.\nAdd logging.";
    expect(rule2.apply(input)).toContain("- [ ]");
  });

  it("minRun=3 does not convert pairs", () => {
    const rule3 = createTasklistRule({ minRun: 3 });
    const input = "Wrap the call.\nAdd logging.";
    const out = rule3.apply(input);
    expect(out).not.toContain("- [ ]");
  });

  it("minRun=3 converts triples", () => {
    const rule3 = createTasklistRule({ minRun: 3 });
    const input = "Wrap the call.\nAdd logging.\nRestart the server.";
    expect(rule3.apply(input)).toContain("- [ ]");
  });
});

// ---------------------------------------------------------------------------
// Blank line preservation
// ---------------------------------------------------------------------------

describe("createTasklistRule — blank line handling", () => {
  it("preserves blank lines between prose paragraphs", () => {
    const input = "Auth is broken.\n\nCheck the token.";
    const out = rule.apply(input);
    // "Check the token" is a single imperative → stays prose; blank line preserved
    expect(out).toContain("Auth is broken.");
    expect(out).toContain("Check the token");
    expect(out).not.toContain("- [ ]");
  });

  it("inserts blank line before task list when following prose", () => {
    const input = "Connection pool exhausted.\nWrap the call.\nAdd logging.";
    const out = rule.apply(input);
    // Blank line should appear between the prose and the task list
    expect(out).toMatch(/Connection pool exhausted\.\n\n- \[ \]/);
  });
});

// ---------------------------------------------------------------------------
// --no-tasklist (disableRules) — tested via expand.ts integration
// ---------------------------------------------------------------------------

describe("createTasklistRule — rule name", () => {
  it("has name 'tasklist' for --no-tasklist support", () => {
    expect(rule.name).toBe("tasklist");
  });
});
