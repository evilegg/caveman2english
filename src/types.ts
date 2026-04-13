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
}

export interface Rule {
  name: string;
  apply(text: string): string;
}
