/**
 * Esperanto → English decoder.
 *
 * Reverses the encoder transformations in reverse order, then hands the
 * result to c2e's expandDeterministic for article restoration, fragment
 * completion, and capitalisation.
 *
 * Decoding order (reverse of encoding):
 *   1. Restore "la" → "the" (before vocabulary, so "la servilo" → "the server")
 *   2. Reverse vocabulary (Esperanto noun → English)
 *   3. Reverse modal verbs (devus → should, etc.)
 *   4. Reverse conjunctions (ĉar → because, etc.)
 *   5. Reverse quantifiers and negation
 *   6. Reverse English abbreviations via c2e expansion
 *   7. c2e expandDeterministic: article restoration, fragment completion,
 *      capitalisation, ventilation
 */

import { expandDeterministic } from "../../src/expand.js";
import {
  FROM_EO,
  MODAL_FROM_EO,
  CONJ_FROM_EO,
  QUANT_FROM_EO,
  NEG_FROM_EO,
} from "./vocabulary.js";

// ── Vocabulary reversal ──────────────────────────────────────────────────────

/**
 * Reverse Esperanto vocabulary, longest match first so "memorliko" is
 * matched before "memoro".
 */
// \b fails for words starting with non-ASCII characters (ĵ, ĉ…).
// Use Unicode property lookarounds instead so all Esperanto vocab words
// are matched correctly regardless of their first character.
function reverseVocabulary(s: string): string {
  const entries = Object.entries(FROM_EO).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [eo, en] of entries) {
    const re = new RegExp(`(?<!\\p{L})${eo}(?!\\p{L})`, "gu");
    s = s.replace(re, en);
  }
  return s;
}

// ── Line decoder ─────────────────────────────────────────────────────────────

function decodeLine(line: string): string {
  let s = line;

  // 1. "la" → "the" (must be before vocabulary to avoid e.g. "la servilo"
  //    being treated as a word boundary issue)
  s = s.replace(/\bla\b/g, "the");

  // 2. Vocabulary
  s = reverseVocabulary(s);

  // 3. Modals
  for (const [re, en] of MODAL_FROM_EO) s = s.replace(re, en);

  // 4. Conjunctions
  for (const [re, en] of CONJ_FROM_EO) s = s.replace(re, en);

  // 5. Quantifiers and negation
  for (const [re, en] of QUANT_FROM_EO) s = s.replace(re, en);
  for (const [re, en] of NEG_FROM_EO) s = s.replace(re, en);

  return s;
}

// ── Main decoder ─────────────────────────────────────────────────────────────

export function decodeEsperanto(encoded: string): string {
  const lines = encoded
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Decode each line individually, then join for c2e expansion.
  const partiallyDecoded = lines.map(decodeLine).join("\n");

  // Hand off to c2e for article restoration, fragment completion,
  // capitalisation and ventilation.  fragmentLevel 2 gives moderate
  // completion without hallucinating structure that wasn't there.
  return expandDeterministic(partiallyDecoded, {
    fragmentLevel: 2,
    disableRules: new Set(), // all rules active
  });
}
