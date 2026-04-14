/**
 * Synthetic Esperanto encoder.
 *
 * Simulates what an LLM following the Esperanto skill prompt would produce.
 * Applies transformations in a deliberate order so later steps don't
 * accidentally clobber earlier ones (e.g. vocabulary before modals, so
 * "function" doesn't interfere with modal-verb patterns).
 *
 * The output is "technical Esperanto" — a hybrid that:
 *   - Uses Esperanto structure words (modals, conjunctions, quantifiers,
 *     negation) where they are unambiguous and compact.
 *   - Uses Esperanto vocabulary for common technical nouns.
 *   - Keeps short abbreviations (DB, auth, cfg…) when shorter than
 *     the Esperanto equivalent.
 *   - Drops the indefinite article (Esperanto has none).
 *   - Preserves the definite article as "la" (Esperanto keeps "la").
 */

import { ABBREVIATIONS } from "../ust/shared-abbrevs.js";
import {
  TO_EO,
  MODAL_TO_EO,
  CONJ_TO_EO,
  QUANT_TO_EO,
  NEG_TO_EO,
} from "./vocabulary.js";

// ── Content compression (shared with RFC/caveman) ────────────────────────────

const FILLER_RE =
  /\b(really|very|quite|basically|simply|just|actually|essentially|effectively|of course|as (a|an) result,?\s*)\b\s*/gi;

const PLEASANTRIES_RE =
  /\b(I('d| would) (be happy to|like to)|let me (explain|walk you through)|note that|please note( that)?|keep in mind( that)?)\b\s*/gi;

// Causal sentence-openers become redundant once "ĉar" is in the clause.
const CAUSAL_PREFIX_RE =
  /^(This is because|This happens because|This occurs because|The reason is that|This is caused by)\s*/i;

// Drop English indefinite article — Esperanto has none.
const INDEF_ARTICLE_RE = /\b(a|an)\s+/g;

// Normalise "the" → "la" (Esperanto definite article).
const DEF_ARTICLE_RE = /\bthe\b/gi;

// ── Vocabulary substitution ──────────────────────────────────────────────────

/**
 * Apply vocabulary replacements longest-match first so "memory leak" is
 * substituted before "memory" alone.
 */
function applyVocabulary(s: string): string {
  const entries = Object.entries(TO_EO).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [en, eo] of entries) {
    // Word-boundary aware, case-insensitive
    const re = new RegExp(`\\b${en.replace(/\s+/g, "\\s+")}\\b`, "gi");
    s = s.replace(re, eo);
  }
  return s;
}

// ── Main encoder ─────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function encodeEsperanto(text: string): string {
  const sentences = splitSentences(text);
  return sentences
    .map((sentence) => {
      let s = sentence;

      // 1. Strip causal opener — encoded structurally by ĉar in the clause
      s = s.replace(CAUSAL_PREFIX_RE, "");

      // 2. Strip pleasantries and filler
      s = s.replace(PLEASANTRIES_RE, "");
      s = s.replace(FILLER_RE, "");

      // 3. Modals first, before vocabulary (so "function" doesn't affect "functioning")
      for (const [re, eo] of MODAL_TO_EO) s = s.replace(re, eo);

      // 4. Conjunctions
      for (const [re, eo] of CONJ_TO_EO) s = s.replace(re, eo);

      // 5. Quantifiers and negation
      for (const [re, eo] of QUANT_TO_EO) s = s.replace(re, eo);
      for (const [re, eo] of NEG_TO_EO) s = s.replace(re, eo);

      // 6. Technical vocabulary (Esperanto nouns for common tech terms)
      s = applyVocabulary(s);

      // 7. English abbreviations — applied after vocabulary so "database" →
      //    "datumbazo" is already done before the abbrev rule would fire.
      for (const [re, abbr] of ABBREVIATIONS) s = s.replace(re, abbr);

      // 8. Articles — drop "a"/"an"; convert "the" → "la"
      s = s.replace(INDEF_ARTICLE_RE, "");
      s = s.replace(DEF_ARTICLE_RE, "la");

      // 9. Strip terminal period (line-per-sentence format)
      s = s.replace(/\.$/, "").trim();

      return s;
    })
    .join("\n");
}
