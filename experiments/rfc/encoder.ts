/**
 * RFC (Reconstruction-Friendly Caveman) synthetic encoder.
 *
 * Like caveman Full, but preserves:
 *   - Modal verbs: might, may, should, must, could, would, will, need to
 *   - Causal conjunctions: because, since, so that
 *   - Contrastive conjunctions: but, however, although, while, whereas
 *   - Hedging adverbs: likely, probably, possibly, typically, usually
 *
 * Everything else is compressed the same as caveman:
 *   - Strip articles (a, an)
 *   - Strip filler adverbs (really, very, basically, etc.)
 *   - Strip pleasantries
 *   - Apply abbreviations
 *   - Strip causal sentence prefixes (handled by inline "because")
 */

import { ABBREVIATIONS } from "../ust/shared-abbrevs.js";

// ── Compression — preserve modals and conjunctions ──────────────────────────

const ARTICLES_RE = /\b(a|an)\s+/g;

const FILLER_RE =
  /\b(really|very|quite|basically|simply|just|actually|essentially|effectively|of course|as (a|an) result,?\s*)\b\s*/gi;

const PLEASANTRIES_RE =
  /\b(I('d| would) (be happy to|like to)|let me (explain|walk you through)|note that|please note( that)?|keep in mind( that)?)\b\s*/gi;

// RFC keeps "because/since/so that" — only strip bare "This is because" prefix
// when "because" appears later in the sentence (it's retained inline).
const CAUSAL_PREFIX_RE =
  /^(This is because|This happens because|This occurs because|The reason is that|This is caused by)\s*/i;

export function encodeRFC(text: string): string {
  // Split into sentences, compress each
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences
    .map((sentence) => {
      let s = sentence;
      s = s.replace(CAUSAL_PREFIX_RE, "because ");
      s = s.replace(FILLER_RE, "");
      s = s.replace(PLEASANTRIES_RE, "");
      s = s.replace(ARTICLES_RE, "");
      for (const [re, abbr] of ABBREVIATIONS) {
        s = s.replace(re, abbr);
      }
      // Remove terminal period — consistent with caveman style
      s = s.replace(/\.$/, "").trim();
      return s;
    })
    .join("\n");
}
