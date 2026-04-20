import { describe, it, expect } from "vitest";
import { modalDisposition } from "../experiments/fidelity/scorer.js";

describe("modalDisposition", () => {
  // ── Preserved cases ──────────────────────────────────────────────────────

  it("counts modal as preserved when it appears in decoded", () => {
    const original = "You should check the configuration.";
    const decoded = "You should check the configuration.";
    const result = modalDisposition(decoded, original);
    expect(result.preserved).toBeCloseTo(1.0);
    expect(result.converted).toBeCloseTo(0.0);
    expect(result.lost).toBeCloseTo(0.0);
    expect(result.total).toBe(1);
  });

  it("counts multiple preserved modals", () => {
    const original = "The cache should be cleared and the index must be rebuilt.";
    const decoded = "The cache should be cleared and the index must be rebuilt.";
    const result = modalDisposition(decoded, original);
    expect(result.preserved).toBeCloseTo(1.0);
    expect(result.total).toBe(2);
  });

  // ── Converted via imperative ──────────────────────────────────────────────

  it("counts modal as converted when action verb is sentence-initial imperative", () => {
    const original = "You should wrap every database call in a try-finally block.";
    // Gilfoyle output: imperative form, no "should"
    const decoded = "Wrap every database call in a try-finally block.";
    const result = modalDisposition(decoded, original);
    expect(result.preserved).toBeCloseTo(0.0);
    expect(result.converted).toBeCloseTo(1.0);
    expect(result.lost).toBeCloseTo(0.0);
  });

  it("counts modal as converted when action verb follows GFM list marker", () => {
    const original = "You must enable TLS on all endpoints.";
    const decoded = "- [ ] Enable TLS on all endpoints.";
    const result = modalDisposition(decoded, original);
    expect(result.converted).toBeCloseTo(1.0);
    expect(result.lost).toBeCloseTo(0.0);
  });

  it("counts modal as converted when action verb follows newline", () => {
    const original = "You should check the logs. You must restart the service.";
    const decoded = "Check the logs.\nRestart the service.";
    const result = modalDisposition(decoded, original);
    expect(result.converted).toBeCloseTo(1.0);
    expect(result.lost).toBeCloseTo(0.0);
    expect(result.total).toBe(2);
  });

  // ── Converted via tilde ───────────────────────────────────────────────────

  it("counts hedging modal as converted when action verb has tilde prefix", () => {
    const original = "This is likely caused by a memory leak.";
    // Gilfoyle hedging: ~caused
    const decoded = "This is ~caused by a memory leak.";
    const result = modalDisposition(decoded, original);
    expect(result.converted).toBeCloseTo(1.0);
    expect(result.lost).toBeCloseTo(0.0);
  });

  it("counts 'might' as converted when action verb is tilde-prefixed", () => {
    const original = "This might fail under load.";
    const decoded = "This ~fail under load.";
    const result = modalDisposition(decoded, original);
    expect(result.converted).toBeCloseTo(1.0);
    expect(result.lost).toBeCloseTo(0.0);
  });

  // ── Lost cases ────────────────────────────────────────────────────────────

  it("counts modal as lost when neither modal nor action verb found in decoded", () => {
    const original = "You should consider the implications.";
    // The action verb "consider" is completely absent
    const decoded = "Think about the effects.";
    const result = modalDisposition(decoded, original);
    expect(result.lost).toBeCloseTo(1.0);
    expect(result.preserved).toBeCloseTo(0.0);
    expect(result.converted).toBeCloseTo(0.0);
  });

  // ── Mixed cases ───────────────────────────────────────────────────────────

  it("handles mixed preserved / converted / lost", () => {
    const original =
      "You should wrap the call. The service must restart. Data might be lost.";
    // "should wrap" → imperative "Wrap" → converted
    // "must restart" → preserved "must"
    // "might be" → action verb "be" is too generic, not found as imperative → lost
    //   (actually "be" is common so let's use a more specific case)
    const decoded = "Wrap the call. The service must restart.";
    const result = modalDisposition(decoded, original);
    expect(result.total).toBe(3);
    // "should" → "Wrap" at sentence start → converted
    expect(result.converted).toBeGreaterThanOrEqual(1 / 3 - 0.01);
    // "must" → present in decoded → preserved
    expect(result.preserved).toBeGreaterThanOrEqual(1 / 3 - 0.01);
    // "might" → "be" not at sentence start, no tilde → lost
    expect(result.lost).toBeGreaterThanOrEqual(1 / 3 - 0.01);
    // Fractions must sum to 1
    expect(result.preserved + result.converted + result.lost).toBeCloseTo(1.0);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("returns all-preserved with total=0 when original has no modals", () => {
    const original = "The server processes requests sequentially.";
    const decoded = "The server processes requests sequentially.";
    const result = modalDisposition(decoded, original);
    expect(result.preserved).toBeCloseTo(1.0);
    expect(result.total).toBe(0);
  });

  it("fractions always sum to 1 for non-zero total", () => {
    const original =
      "You should configure the timeout. The cache might expire soon.";
    const decoded = "Configure the timeout.";
    const result = modalDisposition(decoded, original);
    if (result.total > 0) {
      expect(result.preserved + result.converted + result.lost).toBeCloseTo(1.0);
    }
  });
});
