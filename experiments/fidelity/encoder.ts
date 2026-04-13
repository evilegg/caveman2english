/**
 * Synthetic caveman encoder.
 *
 * Simulates the transformations caveman Full mode applies to natural English prose.
 * Used to generate controlled (original, compressed) pairs for fidelity benchmarking
 * without requiring live API calls.
 *
 * This is an approximation — real caveman output from an LLM will differ in detail
 * but follows the same structural rules.
 */

// ── Articles ────────────────────────────────────────────────────────────────
const ARTICLES_RE = /\b(a|an|the)\s+/gi;

// ── Hedging and epistemic markers ───────────────────────────────────────────
// These are the MOST semantically important things caveman drops.
const HEDGING_RE =
  /\b(probably|likely|perhaps|possibly|maybe|might|may\s+be|it('s| is) (possible|likely) (that\s+)?|there is a chance (that\s+)?|I (think|believe|suspect) (that\s+)?|in my (view|opinion),?\s*|typically|generally|usually|often|sometimes)\b/gi;

// ── Filler and intensity words ───────────────────────────────────────────────
const FILLER_RE =
  /\b(really|very|quite|basically|simply|just|actually|essentially|effectively|certainly|definitely|clearly|obviously|of course)\b\s*/gi;

// ── Pleasantries and meta-commentary ─────────────────────────────────────────
const PLEASANTRIES_RE =
  /\b(I('d| would) (be happy to|like to)|let me (explain|walk you through)|note that|please note( that)?|keep in mind( that)?|it('s| is) worth noting( that)?|as (a|an) (result|consequence),?\s*)\b/gi;

// ── Causal and connector phrases → arrow notation ────────────────────────────
// Must run BEFORE article stripping to catch "which leads to" etc.
const CAUSAL_TO_ARROW: [RegExp, string][] = [
  [/,?\s+which (causes|leads to|results in|makes)\s+/gi, " → "],
  [/,?\s+causing\s+/gi, " → "],
  [/,?\s+resulting in\s+/gi, " → "],
  [/\s+leads to\s+/gi, " → "],
  [/\s+causes\s+/gi, " → "],
];

// ── Known abbreviations (mirrors the expansion dictionary, reversed) ─────────
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bauthentication\b/gi, "auth"],
  [/\bauthorization\b/gi, "authz"],
  [/\bdatabase\b/gi, "DB"],
  [/\bdatabases\b/gi, "DBs"],
  [/\benvironment\b/gi, "env"],
  [/\bconfiguration\b/gi, "cfg"],
  [/\bfunction\b/gi, "fn"],
  [/\bfunctions\b/gi, "fns"],
  [/\bargument\b/gi, "arg"],
  [/\barguments\b/gi, "args"],
  [/\bparameter\b/gi, "param"],
  [/\bparameters\b/gi, "params"],
  [/\bproperty\b/gi, "prop"],
  [/\bproperties\b/gi, "props"],
  [/\breference\b/gi, "ref"],
  [/\breferences\b/gi, "refs"],
  [/\brepository\b/gi, "repo"],
  [/\bdependencies\b/gi, "deps"],
  [/\bdependency\b/gi, "dep"],
  [/\bpackage\b/gi, "pkg"],
  [/\bdirectory\b/gi, "dir"],
  [/\bmessage\b/gi, "msg"],
  [/\berror\b/gi, "err"],
  [/\brequest\b/gi, "req"],
  [/\bresponse\b/gi, "res"],
  [/\bcontext\b/gi, "ctx"],
  [/\bimplementation\b/gi, "impl"],
  [/\binitialization\b/gi, "init"],
  [/\bperformance\b/gi, "perf"],
  [/\bcomponent\b/gi, "comp"],
  [/\bobject\b/gi, "obj"],
  [/\bvalue\b/gi, "val"],
  [/\bstring\b/gi, "str"],
  [/\bnumber\b/gi, "num"],
  [/\bboolean\b/gi, "bool"],
];

// ── Copula stripping (drop "is"/"are" between noun and adjective) ────────────
// Conservative: only strip when between a known noun and a predicate adjective.
const COPULA_RE = /\b(is|are|was|were)\s+(being\s+)?(incorrectly|correctly|not|now|also|already|still|always|never|often)\s+/gi;

export function encodeCaveman(text: string): string {
  let out = text;

  // 1. Arrow notation for causal phrases (before article stripping)
  for (const [re, arrow] of CAUSAL_TO_ARROW) {
    out = out.replace(re, arrow);
  }

  // 2. Drop hedging (record what was lost for scoring)
  out = out.replace(HEDGING_RE, "");

  // 3. Drop filler
  out = out.replace(FILLER_RE, "");

  // 4. Drop pleasantries
  out = out.replace(PLEASANTRIES_RE, "");

  // 5. Drop articles
  out = out.replace(ARTICLES_RE, "");

  // 6. Apply abbreviations
  for (const [re, abbr] of ABBREVIATIONS) {
    out = out.replace(re, abbr);
  }

  // 7. Collapse excess whitespace / fix spacing around periods
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .trim();

  return out;
}

/**
 * Count words that appear in the original but not in the encoded text.
 * These represent semantic information that was dropped.
 */
export function lostWords(original: string, encoded: string): string[] {
  const origTokens = tokenize(original);
  const encTokens = new Set(tokenize(encoded));
  return origTokens.filter((w) => !encTokens.has(w));
}

/**
 * Extract modality/epistemic words from a text.
 * These are the hardest category to reconstruct.
 */
export function extractModals(text: string): string[] {
  const MODAL_RE =
    /\b(might|may|could|should|would|must|will|probably|likely|perhaps|possibly|maybe|uncertain|possible|potential)\b/gi;
  return [...text.matchAll(MODAL_RE)].map((m) => m[0].toLowerCase());
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
