import { describe, it, expect } from "vitest";
import {
  rouge1,
  structureNormalisedRouge1,
  normaliseForRouge,
} from "../experiments/fidelity/scorer.js";

// ── normaliseForRouge unit tests ──────────────────────────────────────────────

describe("normaliseForRouge", () => {
  it('strips "you should" prefix', () => {
    expect(normaliseForRouge("You should wrap every database call.")).toBe(
      "wrap every database call.",
    );
  });

  it('strips "you must" prefix', () => {
    expect(normaliseForRouge("You must enable TLS.")).toBe("enable TLS.");
  });

  it('strips "you need to" prefix', () => {
    expect(normaliseForRouge("You need to restart the service.")).toBe(
      "restart the service.",
    );
  });

  it('strips "you ought to" prefix', () => {
    expect(normaliseForRouge("You ought to add a timeout.")).toBe(
      "add a timeout.",
    );
  });

  it('strips "you should feel free to" prefix (longer match first)', () => {
    expect(normaliseForRouge("You should feel free to skip this step.")).toBe(
      "skip this step.",
    );
  });

  it('strips "you might want to" prefix', () => {
    expect(normaliseForRouge("You might want to check the logs.")).toBe(
      "check the logs.",
    );
  });

  it("leaves non-modal sentences unchanged", () => {
    const s = "The server is running on port 3000.";
    expect(normaliseForRouge(s)).toBe(s);
  });

  it("lowercases the first word after stripping", () => {
    // "You should Wrap" → "wrap" (edge case: second word was capitalised)
    const result = normaliseForRouge("You should Ensure the lock is held.");
    expect(result.charAt(0)).toBe("e");
  });

  it("normalises each sentence in multi-sentence text", () => {
    const text =
      "You should wrap every database call. You must enable TLS. The server restarts.";
    const result = normaliseForRouge(text);
    expect(result).toContain("wrap every database call");
    expect(result).toContain("enable TLS");
    expect(result).toContain("The server restarts");
    expect(result).not.toContain("you should");
    expect(result).not.toContain("you must");
  });

  it("is case-insensitive for the modal prefix", () => {
    expect(normaliseForRouge("YOU SHOULD wrap every call.")).toContain("wrap every call");
  });
});

// ── structureNormalisedRouge1 unit tests ──────────────────────────────────────

describe("structureNormalisedRouge1", () => {
  it("scores imperative == deontic modal for the same content", () => {
    const reference = "You should wrap every database call in a try-finally block.";
    const hypothesis = "Wrap every database call in a try-finally block.";

    const standard = rouge1(hypothesis, reference);
    const normalised = structureNormalisedRouge1(hypothesis, reference);

    // sn-ROUGE-1 must be higher than standard ROUGE-1 because "you" and "should"
    // are stripped from the reference before scoring.
    expect(normalised).toBeGreaterThan(standard);
    // After normalisation both sentences reduce to the same content words
    expect(normalised).toBeCloseTo(1.0, 1);
  });

  it("is symmetric — identical text scores 1.0", () => {
    const s = "Wrap every database call in a try-finally block.";
    expect(structureNormalisedRouge1(s, s)).toBeCloseTo(1.0, 5);
  });

  it("does not inflate score when content genuinely differs", () => {
    const reference = "You should use a mutex to protect shared state.";
    const hypothesis = "Use a connection pool to manage resources.";

    const normalised = structureNormalisedRouge1(hypothesis, reference);
    // Even after normalisation, the content words differ substantially
    expect(normalised).toBeLessThan(0.5);
  });

  it("handles multi-sentence comparison", () => {
    const reference =
      "You should wrap every database call. You must enable TLS on all endpoints.";
    const hypothesis =
      "Wrap every database call. Enable TLS on all endpoints.";

    const standard = rouge1(hypothesis, reference);
    const normalised = structureNormalisedRouge1(hypothesis, reference);

    expect(normalised).toBeGreaterThan(standard);
    expect(normalised).toBeGreaterThan(0.8);
  });

  it("returns same score as rouge1 when no modal prefixes present", () => {
    const hypothesis = "The server processes each request sequentially.";
    const reference = "The server processes each request sequentially.";

    expect(structureNormalisedRouge1(hypothesis, reference)).toBeCloseTo(
      rouge1(hypothesis, reference),
      5,
    );
  });
});
