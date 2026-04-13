/**
 * Unicode Semantic Token (UST) vocabulary.
 *
 * UST is an experimental compression format that preserves semantic structure
 * explicitly through a small set of Unicode role markers.
 * An LLM instructed to output in UST annotates each sentence with its semantic
 * role (problem, fix, context, etc.) and encodes logical relationships inline
 * (causality, results, frequency).
 *
 * Unlike caveman, which drops function words silently, UST replaces them with
 * lossless structural markers that a deterministic decoder can expand reliably.
 */

export interface UstSymbol {
  symbol: string;
  role: string;
  /** How the decoder prefixes a sentence starting with this marker. */
  sentencePrefix: string;
  /** How the decoder renders this marker when used inline. */
  inlineExpansion?: string;
}

// ── Sentence-level role markers ──────────────────────────────────────────────
// Used at the START of a sentence to identify what kind of claim it is.

export const SENTENCE_MARKERS: UstSymbol[] = [
  {
    symbol: "🔴",
    role: "PROBLEM",
    sentencePrefix: "The problem is ",
  },
  {
    symbol: "🟢",
    role: "FIX",
    sentencePrefix: "The fix is to ",
  },
  {
    symbol: "🔵",
    role: "CONTEXT",
    sentencePrefix: "Note that ",
  },
  {
    symbol: "💡",
    role: "REASON",
    sentencePrefix: "This is because ",
  },
  {
    symbol: "🟡",
    role: "WARNING",
    sentencePrefix: "Warning: ",
  },
  {
    symbol: "⚠️",
    role: "IMPORTANT",
    sentencePrefix: "Importantly, ",
  },
  {
    symbol: "📌",
    role: "SPECIFIC",
    sentencePrefix: "Specifically, ",
  },
  {
    symbol: "🔍",
    role: "EXAMPLE",
    sentencePrefix: "For example, ",
  },
];

// ── Inline relational markers ─────────────────────────────────────────────────
// Used BETWEEN clauses to encode logical relationships.

export const INLINE_MARKERS: UstSymbol[] = [
  {
    symbol: "⚡",
    role: "CAUSES",
    sentencePrefix: "",
    inlineExpansion: " causes ",
  },
  {
    symbol: "↩",
    role: "RESULTS_IN",
    sentencePrefix: "",
    inlineExpansion: " results in ",
  },
  {
    symbol: "🔁",
    role: "PER_EACH",
    sentencePrefix: "",
    inlineExpansion: " on each ",
  },
  {
    symbol: "❌",
    role: "NOT",
    sentencePrefix: "",
    inlineExpansion: " not ",
  },
];

// ── Certainty markers ─────────────────────────────────────────────────────────
// These are the key innovation: they preserve epistemic state that caveman drops.

export const CERTAINTY_MARKERS: UstSymbol[] = [
  {
    symbol: "✅",
    role: "DEFINITE",
    sentencePrefix: "",
    inlineExpansion: "definitely ",
  },
  {
    symbol: "❓",
    role: "UNCERTAIN",
    sentencePrefix: "",
    inlineExpansion: "possibly ",
  },
  {
    symbol: "~",
    role: "PROBABLE",
    sentencePrefix: "",
    inlineExpansion: "probably ",
  },
  {
    symbol: "!",
    role: "MUST",
    sentencePrefix: "",
    inlineExpansion: "must ",
  },
  {
    symbol: "?",
    role: "MIGHT",
    sentencePrefix: "",
    inlineExpansion: "might ",
  },
];

export const ALL_MARKERS = [...SENTENCE_MARKERS, ...INLINE_MARKERS, ...CERTAINTY_MARKERS];

// Build lookup maps for the decoder.
export const SYMBOL_TO_SENTENCE_PREFIX = new Map(
  SENTENCE_MARKERS.map((m) => [m.symbol, m.sentencePrefix]),
);
export const SYMBOL_TO_INLINE = new Map(
  [...INLINE_MARKERS, ...CERTAINTY_MARKERS]
    .filter((m) => m.inlineExpansion !== undefined)
    .map((m) => [m.symbol, m.inlineExpansion!]),
);

/**
 * Token cost estimate for a UST marker.
 * Emoji are typically 1–3 BPE tokens depending on the tokenizer.
 * ASCII symbols (!, ?, ~) are always 1 token.
 */
export function estimatedTokenCost(symbol: string): number {
  if (symbol.length === 1 && symbol.charCodeAt(0) < 128) return 1; // ASCII
  return 2; // conservative estimate for emoji
}
