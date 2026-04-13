import { describe, it, expect } from "vitest";
import { mergeConfig } from "../src/config.js";
import type { ExpandOptions, UserConfig } from "../src/types.js";

// Simulate CLI opts — only populate fields that were explicitly provided.
function cliOpts(overrides: Partial<ExpandOptions> = {}): Partial<ExpandOptions> {
  return { disableRules: new Set(), extraAbbreviations: {}, ...overrides };
}

describe("mergeConfig", () => {
  it("uses CLI values when no user config is set", () => {
    const result = mergeConfig(cliOpts({ fragmentLevel: 2 }), {});
    expect(result.fragmentLevel).toBe(2);
  });

  it("applies user config when CLI uses defaults", () => {
    const userConfig: UserConfig = { fragmentLevel: 3 };
    const result = mergeConfig(cliOpts(), userConfig);
    expect(result.fragmentLevel).toBe(3);
  });

  it("CLI fragmentLevel overrides user config", () => {
    const userConfig: UserConfig = { fragmentLevel: 3 };
    const result = mergeConfig(cliOpts({ fragmentLevel: 2 }), userConfig);
    expect(result.fragmentLevel).toBe(2);
  });

  it("merges extraAbbreviations — user config first, CLI on top", () => {
    const userConfig: UserConfig = { extraAbbreviations: { k8s: "Kubernetes", svc: "service" } };
    const opts = cliOpts({ extraAbbreviations: { k8s: "k8s-override" } });
    const result = mergeConfig(opts, userConfig);
    expect(result.extraAbbreviations["k8s"]).toBe("k8s-override");
    expect(result.extraAbbreviations["svc"]).toBe("service");
  });

  it("user config disableRules used when CLI set is empty", () => {
    const userConfig: UserConfig = { disableRules: ["arrows", "ventilate"] };
    const result = mergeConfig(cliOpts(), userConfig);
    expect(result.disableRules.has("arrows")).toBe(true);
    expect(result.disableRules.has("ventilate")).toBe(true);
  });

  it("CLI disableRules takes precedence over user config when non-empty", () => {
    const userConfig: UserConfig = { disableRules: ["arrows"] };
    const opts = cliOpts({ disableRules: new Set(["abbreviations"]) });
    const result = mergeConfig(opts, userConfig);
    expect(result.disableRules.has("abbreviations")).toBe(true);
    expect(result.disableRules.has("arrows")).toBe(false);
  });
});
