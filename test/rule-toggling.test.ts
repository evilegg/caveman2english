import { describe, it, expect } from "vitest";
import { expandDeterministic } from "../src/expand.js";

describe("rule toggling via disableRules", () => {
  it("arrows rule can be disabled", () => {
    const input = "cache miss → wrong render.";
    const result = expandDeterministic(input, {
      disableRules: new Set(["arrows"]),
    });
    expect(result).toContain("→");
  });

  it("arrows rule is applied by default", () => {
    const input = "cache miss → wrong render.";
    const result = expandDeterministic(input);
    expect(result).not.toContain("→");
    expect(result).toContain("which leads to");
  });

  it("abbreviations rule can be disabled", () => {
    const input = "fix auth flow.";
    const result = expandDeterministic(input, {
      disableRules: new Set(["abbreviations"]),
    });
    expect(result).toContain("auth");
    expect(result).not.toContain("authentication");
  });

  it("ventilate rule can be disabled — sentences stay on one line", () => {
    const input = "First sentence. Second sentence. Third sentence.";
    const result = expandDeterministic(input, {
      disableRules: new Set(["ventilate"]),
    });
    expect(result).not.toContain("\n");
  });

  it("ventilate rule is applied by default", () => {
    const input = "First sentence. Second sentence. Third sentence.";
    const result = expandDeterministic(input);
    expect(result).toContain("\n");
  });

  it("extra abbreviations are applied", () => {
    const input = "deploy to k8s cluster.";
    const result = expandDeterministic(input, {
      extraAbbreviations: { k8s: "Kubernetes" },
    });
    expect(result).toContain("Kubernetes");
  });

  it("extra abbreviations override built-ins", () => {
    // Suppose a project uses "auth" to mean something project-specific.
    const result = expandDeterministic("fix auth flow.", {
      extraAbbreviations: { auth: "OAuth2" },
    });
    expect(result).toContain("OAuth2");
  });
});
