/**
 * Deterministic UST → English decoder.
 *
 * Expands Unicode Semantic Token annotations back to readable prose.
 * Unlike the c2e heuristic expander, this decoder is largely lossless on the
 * structural level: role markers → known prefixes, inline markers → known phrases.
 * Content words still pass through the c2e abbreviation expander.
 */

import { expandDeterministic } from "../../src/expand.js";
import {
  SYMBOL_TO_SENTENCE_PREFIX,
  SYMBOL_TO_INLINE,
} from "./vocabulary.js";

// Regex to detect UST sentence-role markers at line/sentence start.
// Matches any of the sentence-level markers followed by optional space.
const SENTENCE_MARKER_RE = /^(🔴|🟢|🔵|💡|🟡|⚠️|📌|🔍)\s*/;

// Regex to match inline markers anywhere in a string.
const INLINE_MARKER_RE = /\s*(⚡|↩|🔁|❌|✅|❓|~\s|!\s|\?\s)\s*/g;

function decodeLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  let result = trimmed;
  let prefix = "";

  // 1. Extract sentence-level role marker from start.
  const sentenceMatch = SENTENCE_MARKER_RE.exec(result);
  if (sentenceMatch) {
    const symbol = sentenceMatch[1]!;
    prefix = SYMBOL_TO_SENTENCE_PREFIX.get(symbol) ?? "";
    result = result.slice(sentenceMatch[0].length);
  }

  // 2. Expand inline markers.
  result = result.replace(INLINE_MARKER_RE, (match: string, symbol: string) => {
    const trimmedSymbol = symbol.trim();
    const expansion = SYMBOL_TO_INLINE.get(trimmedSymbol);
    if (expansion !== undefined) return expansion;
    return match;
  });

  // 3. Capitalise the content (prefix handles its own capitalisation).
  if (prefix) {
    result = result.charAt(0).toLowerCase() + result.slice(1);
  }

  // 4. Ensure terminal period.
  const combined = (prefix + result).trimEnd();
  return combined.endsWith(".") || /[!?:]$/.test(combined)
    ? combined
    : combined + ".";
}

/**
 * Decode a full UST-encoded text block.
 * Processes line by line, then runs the result through c2e abbreviation
 * expansion (but disables fragment/conjunction rules which would re-process
 * the already-structured output).
 */
export function decodeUST(text: string): string {
  const lines = text.split("\n");
  const decoded = lines.map(decodeLine);
  const joined = decoded.join("\n");

  // Run abbreviation expansion only — the semantic structure is already correct.
  return expandDeterministic(joined, {
    fragmentLevel: 0, // off — structure is already complete
    disableRules: new Set(["conjunctions", "articles", "ventilate"]),
  });
}
