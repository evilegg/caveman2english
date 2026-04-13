import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { UserConfig, ExpandOptions, FragmentLevel } from "./types.js";

const CONFIG_PATH = join(homedir(), ".c2e.json");

export function loadUserConfig(): UserConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as UserConfig;
  } catch {
    // Missing or malformed config is silently ignored.
    return {};
  }
}

/** Merge user config into CLI options, applying hard-coded defaults last.
 * Priority: explicit CLI flag > ~/.c2e.json > built-in default.
 * Pass undefined for any CLI option that was not explicitly provided.
 */
export function mergeConfig(
  cliOpts: Partial<ExpandOptions>,
  userConfig: UserConfig,
): ExpandOptions {
  return {
    backend: cliOpts.backend ?? userConfig.backend ?? "none",
    model: cliOpts.model ?? userConfig.model,
    ollamaUrl: cliOpts.ollamaUrl ?? userConfig.ollamaUrl ?? "http://localhost:11434",
    expand: cliOpts.expand ?? userConfig.expand ?? false,
    expandThreshold: cliOpts.expandThreshold ?? userConfig.expandThreshold ?? 300,
    fragmentLevel: (cliOpts.fragmentLevel ?? userConfig.fragmentLevel ?? 1) as FragmentLevel,
    disableRules: (cliOpts.disableRules?.size ?? 0) > 0
      ? cliOpts.disableRules!
      : new Set(userConfig.disableRules ?? []),
    extraAbbreviations: {
      ...(userConfig.extraAbbreviations ?? {}),
      ...(cliOpts.extraAbbreviations ?? {}),
    },
  };
}
