/**
 * Scoring functions for fidelity benchmarking.
 */

import { tokenize, extractModals } from "./encoder.js";

export interface Score {
  /** ROUGE-1 F1: unigram overlap between expansion and original */
  rouge1: number;
  /** Compression ratio of encoded vs original (higher = more compressed) */
  compressionRatio: number;
  /** Fraction of original word count recovered in expansion */
  wordRecovery: number;
  /** Fraction of modality words from original present in expansion */
  modalRecovery: number;
  /** Number of modality words in original */
  originalModalCount: number;
  /** Number of modality words in expansion */
  expandedModalCount: number;
}

export interface BenchmarkResult {
  id: string;
  topic: string;
  original: string;
  encoded: string;
  expanded: Record<string, string>; // keyed by label (e.g. "level-1", "level-3")
  scores: Record<string, Score>;
}

export function rouge1(hypothesis: string, reference: string): number {
  const hypTokens = new Set(tokenize(hypothesis));
  const refTokens = tokenize(reference);

  const refSet = new Set(refTokens);
  const overlap = [...hypTokens].filter((t) => refSet.has(t)).length;

  const precision = overlap / hypTokens.size;
  const recall = overlap / refTokens.length;

  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function compressionRatio(original: string, encoded: string): number {
  const origLen = tokenize(original).length;
  const encLen = tokenize(encoded).length;
  if (origLen === 0) return 0;
  return 1 - encLen / origLen;
}

export function wordRecovery(expanded: string, original: string): number {
  const expTokens = new Set(tokenize(expanded));
  const origTokens = tokenize(original);
  const recovered = origTokens.filter((t) => expTokens.has(t)).length;
  return origTokens.length > 0 ? recovered / origTokens.length : 0;
}

export function modalRecovery(expanded: string, original: string): number {
  const origModals = extractModals(original);
  if (origModals.length === 0) return 1; // nothing to recover
  const expModals = new Set(extractModals(expanded));
  const recovered = origModals.filter((m) => expModals.has(m)).length;
  return recovered / origModals.length;
}

// ── Modal disposition ─────────────────────────────────────────────────────────
//
// The binary modalRecovery metric treats every absent modal as a loss.
// For Gilfoyle, ~77.5% of modals are intentional imperative conversions
// ("You should wrap X" → "Wrap X") — not losses.  The disposition metric
// distinguishes three outcomes for each original modal:
//
//   Preserved  — modal appears literally in the decoded output
//   Converted  — modal absent but the action verb it governed appears as:
//                a sentence-initial imperative (deontic: should/must/will…)
//                OR a tilde-prefixed word (~verb) (hedging: might/may/likely…)
//   Lost       — modal absent and no action-verb conversion detected

export interface ModalDisposition {
  /** Fraction of original modals that appear literally in decoded output */
  preserved: number;
  /** Fraction converted to imperative or tilde form without information loss */
  converted: number;
  /** Fraction genuinely absent with no detectable conversion */
  lost: number;
  /** Absolute count of original modal occurrences */
  total: number;
}

/**
 * Extract each modal occurrence with its immediately following action verb.
 * Returns an array of `{ modal, actionVerb }` pairs.
 */
function extractModalOccurrences(
  text: string,
): Array<{ modal: string; actionVerb: string | null }> {
  // Match modal + optional next word (the verb it governs)
  const re =
    /\b(might|may|could|should|would|must|will|probably|likely|perhaps|possibly|maybe|uncertain|possible|potential)\b(?:\s+(?:not\s+)?(\w+))?/gi;
  const results: Array<{ modal: string; actionVerb: string | null }> = [];
  for (const m of text.matchAll(re)) {
    results.push({
      modal: m[1]!.toLowerCase(),
      actionVerb: m[2]?.toLowerCase() ?? null,
    });
  }
  return results;
}

/**
 * True if `verb` appears as a sentence-initial imperative in `decoded`.
 * Matches: start-of-string, after newline, after a GFM list marker (- [ ], * )
 * or a table cell separator (| ).
 */
function isImperativeInDecoded(verb: string, decoded: string): boolean {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|\\n|(?:-\\s*\\[[ xX]?\\]\\s+)|(?:\\|\\s*))${escaped}\\b`,
    "im",
  ).test(decoded);
}

/**
 * True if `verb` appears tilde-prefixed in `decoded` (Gilfoyle hedging form).
 * e.g. "~caused" for original "likely caused".
 */
function isTildeInDecoded(verb: string, decoded: string): boolean {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`~${escaped}\\b`, "i").test(decoded);
}

/**
 * Classify each original modal as preserved, converted, or lost.
 *
 * @param decoded  The output to evaluate (for Gilfoyle: the encoded text itself)
 * @param original The reference prose the encoded form was derived from
 */
export function modalDisposition(
  decoded: string,
  original: string,
): ModalDisposition {
  const occurrences = extractModalOccurrences(original);
  const total = occurrences.length;

  if (total === 0) {
    return { preserved: 1, converted: 0, lost: 0, total: 0 };
  }

  let preserved = 0;
  let converted = 0;
  let lost = 0;

  for (const { modal, actionVerb } of occurrences) {
    // Preserved: modal word appears literally in the decoded output
    if (new RegExp(`\\b${modal}\\b`, "i").test(decoded)) {
      preserved++;
      continue;
    }

    // Converted: action verb appears as imperative or tilde form
    if (
      actionVerb &&
      (isImperativeInDecoded(actionVerb, decoded) ||
        isTildeInDecoded(actionVerb, decoded))
    ) {
      converted++;
    } else {
      lost++;
    }
  }

  return {
    preserved: preserved / total,
    converted: converted / total,
    lost: lost / total,
    total,
  };
}

export function scoreExpansion(
  original: string,
  encoded: string,
  expanded: string,
): Score {
  return {
    rouge1: rouge1(expanded, original),
    compressionRatio: compressionRatio(original, encoded),
    wordRecovery: wordRecovery(expanded, original),
    modalRecovery: modalRecovery(expanded, original),
    originalModalCount: extractModals(original).length,
    expandedModalCount: extractModals(expanded).length,
  };
}

export function averageScores(scores: Score[]): Score {
  const n = scores.length;
  const sum = (key: keyof Score) =>
    scores.reduce((acc, s) => acc + (s[key] as number), 0);
  return {
    rouge1: sum("rouge1") / n,
    compressionRatio: sum("compressionRatio") / n,
    wordRecovery: sum("wordRecovery") / n,
    modalRecovery: sum("modalRecovery") / n,
    originalModalCount: sum("originalModalCount") / n,
    expandedModalCount: sum("expandedModalCount") / n,
  };
}

// ── Structure-normalised ROUGE-1 ─────────────────────────────────────────────
//
// Standard ROUGE-1 penalises lossless restructuring: Gilfoyle converts
// "You should wrap every database call" → "Wrap every database call."
// This drops "you" and "should" from the unigram set even though no
// information was lost — the obligation is still conveyed by the imperative.
//
// Structure-normalised ROUGE-1 strips sentence-initial deontic modal
// constructions from both hypothesis and reference before scoring, so
// imperative conversion does not count as a unigram loss.

/** Sentence-initial modal prefixes that become imperatives in Gilfoyle output. */
const MODAL_PREFIX_RE =
  /^you\s+(?:should\s+feel\s+free\s+to|might\s+want\s+to|should|must|need\s+to|ought\s+to)\s+/i;

/**
 * Strip sentence-initial deontic modal prefix and lowercase the resulting
 * first word.  Applied to both hypothesis and reference before scoring.
 *
 * "You should wrap every call." → "wrap every call."
 * "You need to add a try-finally block." → "add a try-finally block."
 */
function normaliseSentenceForRouge(sentence: string): string {
  const stripped = sentence.replace(MODAL_PREFIX_RE, "");
  if (stripped === sentence) return sentence;
  // Lowercase the now-initial word (it may have been the verb after "You should")
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

/**
 * Normalise text for structure-normalised ROUGE-1 scoring.
 * Splits on sentence boundaries, normalises each sentence, rejoins.
 */
export function normaliseForRouge(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => normaliseSentenceForRouge(s.trim()))
    .filter(Boolean)
    .join(" ");
}

/**
 * Structure-normalised ROUGE-1 F1.
 *
 * Identical to `rouge1` except both inputs are normalised first via
 * `normaliseForRouge`.  Use this metric when comparing systems that
 * convert deontic modals to imperatives (e.g. Gilfoyle) against
 * systems that preserve the full modal phrase.
 */
export function structureNormalisedRouge1(
  hypothesis: string,
  reference: string,
): number {
  return rouge1(normaliseForRouge(hypothesis), normaliseForRouge(reference));
}

export function formatScore(s: Score): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return (
    `ROUGE-1=${pct(s.rouge1)} ` +
    `word-recovery=${pct(s.wordRecovery)} ` +
    `modal-recovery=${pct(s.modalRecovery)} ` +
    `compression=${pct(s.compressionRatio)}`
  );
}
