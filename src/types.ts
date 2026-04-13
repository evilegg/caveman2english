export type BackendName = "none" | "ollama" | "claude";

/** Fragment completion conservatism level.
 * 0 = off       — no fragment completion
 * 1 = conservative — narrow adjective-prefix list only (default)
 * 2 = moderate  — any verbless sentence; pattern-based verb injection
 * 3 = aggressive — context-aware: uses surrounding sentences for article
 *                  selection and verb-tense matching
 */
export type FragmentLevel = 0 | 1 | 2 | 3;

export interface ExpandOptions {
  backend: BackendName;
  model?: string;
  ollamaUrl?: string;
  expand: boolean;
  expandThreshold: number;
  fragmentLevel: FragmentLevel;
  /** Rules to disable by name. */
  disableRules: Set<string>;
  /** Extra abbreviations merged on top of the built-in dictionary. */
  extraAbbreviations: Record<string, string>;
}

export interface Rule {
  name: string;
  apply(text: string): string;
}

/** Schema for ~/.c2e.json */
export interface UserConfig {
  fragmentLevel?: FragmentLevel;
  disableRules?: string[];
  extraAbbreviations?: Record<string, string>;
  backend?: BackendName;
  model?: string;
  ollamaUrl?: string;
  expand?: boolean;
  expandThreshold?: number;
}
