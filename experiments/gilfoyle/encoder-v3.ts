/**
 * Gilfoyle v3 synthetic encoder.
 *
 * Extends v2 with phrase-level compression moves targeting verbose LLM and
 * corporate prose.  v2 already handles copula deletion, tilde hedging,
 * causation arrows, and abbreviations.  v3 adds:
 *
 * NEW in v3:
 *   - Verbose connective compression: "in the event that" → "if",
 *     "due to the fact that" → "because" (then causation fires), etc.
 *   - Quantifier reduction: "all of the" → "all", "the majority of" → "most"
 *   - Verbose verb phrase compression: "make use of" → "use", etc.
 *   - "it is X that Y" construction stripping: "it is important that" → ""
 *   - Sentence-initial "This is a known issue with" → "Known issue:"
 *   - Genitive inversion: "exhaustion of the pool" → "pool exhaustion"
 *     (only when Y-noun is a known technical noun, to avoid semantic drift)
 *   - Nominalisation reversal: "the configuration of tmo" → "configuring tmo"
 *     (static dictionary of common technical -tion/-ment nominals)
 *
 * PRESERVED from v2:
 *   - All v2 compression moves (applied first, then v3 moves layer on top)
 *   - All semantic ligature guarantees
 */

import { encodeGilfoyle as encodeGilfoyleV2 } from "./encoder.js";

// ── Verbose connective compression ───────────────────────────────────────────

// Ordered: longer matches before shorter so "in the event that" fires before
// "in the event".  Each pair: [regexp, replacement].
const VERBOSE_CONNECTIVES: [RegExp, string][] = [
  // Temporal/hedged conditionals
  [/\bin the event that\b/gi, "if"],
  [/\bin the event of\b/gi, "if"],
  [/\bin the case where\b/gi, "if"],
  [/\bin the case of\b/gi, "for"],
  [/\bin such (a )?case\b/gi, "then"],
  [/\bat this point in time\b/gi, ""],
  [/\bat the current time\b/gi, ""],
  [/\bat this time\b/gi, ""],
  [/\bat the present time\b/gi, ""],
  [/\bin the near future\b/gi, "soon"],
  [/\bon a regular basis\b/gi, "regularly"],
  [/\bon an ongoing basis\b/gi, "ongoing"],

  // Causal connectives (become "because", then causation restructuring fires)
  [/\bdue to the fact that\b/gi, "because"],
  [/\bas a result of this\b/gi, "→"],
  [/\bas a result of\b/gi, "→"],
  [/\bas a consequence of this\b/gi, "→"],
  [/\bas a consequence of\b/gi, "→"],
  [/\bwhich gives rise to\b/gi, "→"],
  [/\bgives rise to\b/gi, "→"],
  [/\bgave rise to\b/gi, "→"],

  // Reformulators
  [/\bwith respect to\b/gi, "re:"],
  [/\bwith regard to\b/gi, "re:"],
  [/\bwith regards to\b/gi, "re:"],
  [/\bin relation to\b/gi, "re:"],
  [/\bin terms of\b/gi, "re:"],

  // Purpose / intent
  [/\bfor the purpose of\b/gi, "to"],
  [/\bfor the purposes of\b/gi, "to"],
  [/\bin order for\b/gi, "so"],

  // Filler constructions
  [/\bit is the case that\b/gi, ""],
  [/\bit is important to note that\b/gi, ""],
  [/\bit is important to note\b/gi, ""],
  [/\bit is worth noting that\b/gi, ""],
  [/\bit is worth noting\b/gi, ""],
  [/\bit is important that\b/gi, ""],
  [/\bit is clear that\b/gi, ""],
  [/\bit is evident that\b/gi, ""],
  [/\bit should be noted that\b/gi, ""],
  [/\bit should be noted\b/gi, ""],
  [/\bit is \w+ that\b/gi, ""],     // "it is X that" → "" (catch-all for remaining)
  [/\bin that\b/gi, "because"],    // "in that it prevents X" → "because it prevents X"

  // "the fact that" residuals
  [/\bthe fact that\b/gi, "that"],
];

function applyVerboseConnectives(s: string): string {
  for (const [re, repl] of VERBOSE_CONNECTIVES) {
    s = s.replace(re, repl);
  }
  // Clean up double spaces left by empty replacements
  s = s.replace(/\s{2,}/g, " ").trim();
  // Clean up sentence-initial ", " or ". " left by stripping a leading clause
  s = s.replace(/^[,.\s]+/, "").trim();
  // Capitalise first letter after stripping
  if (s.length > 0) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

// ── Quantifier reduction ──────────────────────────────────────────────────────

const QUANTIFIERS: [RegExp, string][] = [
  [/\ball of the\b/gi, "all"],
  [/\beach of the\b/gi, "each"],
  [/\bthe entirety of\b/gi, "all"],
  [/\bthe majority of\b/gi, "most"],
  [/\bthe totality of\b/gi, "all"],
  [/\ba large number of\b/gi, "many"],
  [/\ba number of\b/gi, "several"],
  [/\ba subset of\b/gi, "some"],
  [/\ban amount of\b/gi, "some"],
  [/\ba variety of\b/gi, "various"],
  [/\bsome of the\b/gi, "some"],
  [/\bany of the\b/gi, "any"],
];

function applyQuantifiers(s: string): string {
  for (const [re, repl] of QUANTIFIERS) {
    s = s.replace(re, repl);
  }
  return s;
}

// ── Verbose verb phrase compression ──────────────────────────────────────────

const VERBOSE_VERBS: [RegExp, string][] = [
  [/\bmake use of\b/gi, "use"],
  [/\bmakes use of\b/gi, "uses"],
  [/\bmade use of\b/gi, "used"],
  [/\btake into account\b/gi, "account for"],
  [/\btakes into account\b/gi, "accounts for"],
  [/\btook into account\b/gi, "accounted for"],
  [/\bhave an impact on\b/gi, "affect"],
  [/\bhas an impact on\b/gi, "affects"],
  [/\bhad an impact on\b/gi, "affected"],
  [/\bcarry out\b/gi, "run"],
  [/\bcarries out\b/gi, "runs"],
  [/\bcarried out\b/gi, "ran"],
  [/\bcome to the conclusion\b/gi, "conclude"],
  [/\bcomes to the conclusion\b/gi, "concludes"],
  [/\bput in place\b/gi, "implement"],
  [/\bputs in place\b/gi, "implements"],
  [/\bmake a change to\b/gi, "change"],
  [/\bmakes a change to\b/gi, "changes"],
  [/\bprovide a description of\b/gi, "describe"],
  [/\bprovides a description of\b/gi, "describes"],
  [/\bperform a check on\b/gi, "check"],
  [/\bperforms a check on\b/gi, "checks"],
  [/\bperform a review of\b/gi, "review"],
  [/\bperforms a review of\b/gi, "reviews"],
  [/\bperform an analysis of\b/gi, "analyse"],
  [/\bpresent a risk to\b/gi, "risk"],
  [/\bpose a risk to\b/gi, "risk"],
  [/\bact as\b/gi, "serve as"],
  [/\bserve the purpose of\b/gi, ""],   // often redundant: "serves the purpose of enabling X" → "enables X"
  [/\bserves the purpose of\b/gi, ""],
];

function applyVerboseVerbs(s: string): string {
  for (const [re, repl] of VERBOSE_VERBS) {
    s = s.replace(re, repl);
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

// ── "This is a known issue" constructions ────────────────────────────────────

const THIS_CONSTRUCTIONS: [RegExp, string][] = [
  [/^This is a known issue with\s+/i, "Known issue: "],
  [/^This is a known (problem|bug) with\s+/i, "Known issue: "],
  [/^These issues? (are|were) caused by\s+/i, ""],  // passive → handled elsewhere
];

function applyThisConstructions(s: string): string {
  for (const [re, repl] of THIS_CONSTRUCTIONS) {
    s = s.replace(re, repl);
  }
  return s;
}

// ── Genitive inversion ────────────────────────────────────────────────────────
//
// "exhaustion of the pool" → "pool exhaustion"
// Only fires when:
//   X ends in -tion, -ment, -ness, -ure, -al, -age, -ance, -ence, -ity
//   Y is a known technical noun (in the TECH_NOUNS set below)
//
// Restriction to known tech nouns prevents "failure of the team" → "team failure"
// type semantic drift.

const TECH_NOUNS = new Set([
  "pool", "cache", "queue", "server", "client", "token", "session",
  "handler", "callback", "hook", "listener", "event", "promise", "thread",
  "process", "loop", "pipeline", "proxy", "gateway", "router", "scheduler",
  "registry", "container", "pod", "node", "cluster", "image", "network",
  "volume", "secret", "config", "env", "endpoint", "header", "payload",
  "connection", "conn", "timeout", "tmo", "middleware", "mw", "database",
  "DB", "worker", "lock", "mutex", "buffer", "stream", "channel", "socket",
  "cert", "key", "secret", "credential", "policy", "rule", "limit", "threshold",
  "index", "table", "schema", "migration", "query", "transaction", "statement",
  "stmt", "function", "fn", "service", "api", "SDK", "component", "comp",
  "module", "package", "dependency", "dep", "job", "task", "cron", "webhook",
  "replica", "shard", "partition", "bucket", "tenant", "namespace", "scope",
  "log", "metric", "trace", "alert", "monitor", "dashboard", "health",
]);

// Nominal forms that have a short participial equivalent
const NOMINALS_RE = /\b(the\s+|a\s+)?(\w+(?:tion|ment|ness|ure|age|ance|ence|ity|al))\s+of\s+(the\s+|a\s+)?(\w+)\b/gi;

function invertGenitives(s: string): string {
  return s.replace(NOMINALS_RE, (match, _det1, nominal, _det2, yNoun) => {
    // Only invert when Y is a known technical noun
    const y = yNoun.toLowerCase();
    if (!TECH_NOUNS.has(y)) return match;
    // Produce "Y nominal" without leading articles
    return `${yNoun} ${nominal.toLowerCase()}`;
  });
}

// ── Nominalisation reversal ───────────────────────────────────────────────────
//
// "the configuration of tmo" → "configuring tmo"
// "the exhaustion of pool" → "exhausting pool"
//
// Static dictionary: nominal → gerund.
// Restricted to nominals that appear in technical LLM prose.

const NOMINAL_TO_GERUND: Record<string, string> = {
  configuration: "configuring",
  exhaustion: "exhausting",
  rejection: "rejecting",
  prevention: "preventing",
  detection: "detecting",
  identification: "identifying",
  implementation: "implementing",
  termination: "terminating",
  validation: "validating",
  invalidation: "invalidating",
  accumulation: "accumulating",
  registration: "registering",
  deregistration: "deregistering",
  consumption: "consuming",
  eviction: "evicting",
  allocation: "allocating",
  deallocation: "deallocating",
  propagation: "propagating",
  migration: "migrating",
  rotation: "rotating",
  resolution: "resolving",
  degradation: "degrading",
  escalation: "escalating",
  remediation: "remediating",
  interpolation: "interpolating",
  concatenation: "concatenating",
  construction: "constructing",
  decrement: "decrementing",
  increment: "incrementing",
  processing: "processing",  // already a gerund — leave
  handling: "handling",       // already a gerund — leave
};

// "the configuration of tmo" → "configuring tmo"
// Pattern: (the|a) NOMINAL of (the|a)? NOUN
const NOMINALISATION_RE = /\b(?:the\s+|a\s+)(\w+(?:tion|ment|tion|ure|age|ance|ence))\s+of\s+(?:the\s+|a\s+)?(\w+)\b/gi;

function reverseNominalisation(s: string): string {
  return s.replace(NOMINALISATION_RE, (match, nominal, noun) => {
    const gerund = NOMINAL_TO_GERUND[nominal.toLowerCase()];
    if (!gerund || gerund.endsWith("ing") === false) return match;
    // Don't transform when nominal itself is already a gerund form
    if (nominal.toLowerCase().endsWith("ing")) return match;
    return `${gerund} ${noun}`;
  });
}

// ── "In that" / "which is" residual cleanup ───────────────────────────────────

// After verbose connective stripping, residual fragments like ", that" or
// "because because" can appear.
function cleanupResiduals(s: string): string {
  s = s.replace(/\bbecause because\b/gi, "because");
  s = s.replace(/\bif if\b/gi, "if");
  s = s.replace(/\bto to\b/gi, "to");
  // "re: the" → "re:" (preposition-article redundancy from connective replacement)
  s = s.replace(/\bre:\s+the\b/gi, "re:");
  // Double commas
  s = s.replace(/,\s*,/g, ",");
  return s;
}

// ── Main v3 encoder ───────────────────────────────────────────────────────────
//
// Strategy: apply v3 phrase-level transforms BEFORE v2, so that v2's copula
// deletion, tilde hedging, and causation arrows can fire on the simplified text.
// This is a pre-pass, not a post-pass.

function prepassV3(text: string): string {
  // Split into sentences for sentence-level transforms
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const transformed = sentences.map((s) => {
    s = applyThisConstructions(s);
    s = applyVerboseConnectives(s);
    s = applyQuantifiers(s);
    s = applyVerboseVerbs(s);
    s = invertGenitives(s);
    s = reverseNominalisation(s);
    s = cleanupResiduals(s);
    // Normalise whitespace
    s = s.replace(/\s{2,}/g, " ").trim();
    return s;
  });

  return transformed.filter(Boolean).join(" ");
}

export function encodeGilfoyleV3(text: string): string {
  const preprocessed = prepassV3(text);
  return encodeGilfoyleV2(preprocessed);
}
