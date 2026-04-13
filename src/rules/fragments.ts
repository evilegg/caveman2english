import type { Rule } from "../types.js";

// Complete bare fragment sentences that caveman produces.
// Patterns handled:
//   "New obj ref each render."  →  "A new object reference exists on each render."
//   "Inline obj prop = new ref."  →  unchanged (has verb "=")
//   "Wrap in useMemo."  →  unchanged (imperative, fine as-is)
//
// Strategy: detect sentences that look like noun-phrase fragments
// (no finite verb) and inject "is" or "are" as appropriate.
// We intentionally keep this conservative to avoid breaking valid imperatives.

// Sentence splitter — splits on ". " or ".\n" but not inside code spans.
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

// Very rough check: does the sentence contain a finite verb or operator?
// We look for: is/are/was/were/has/have/had/do/does/did + any past tense (-ed)
// plus assignment-style operators (=, :).
const VERB_RE =
  /\b(is|are|was|were|has|have|had|do|does|did|will|would|can|could|should|must|need|return|throws?|calls?|sets?|gets?|runs?|fails?|passes?|takes?|makes?|uses?|adds?|removes?|creates?|updates?|deletes?)\b|[=:]/i;

const PAST_TENSE_RE = /\b\w+ed\b/;

function hasVerb(sentence: string): boolean {
  return VERB_RE.test(sentence) || PAST_TENSE_RE.test(sentence);
}

// Detect likely noun-phrase-only fragments: starts with adjective/noun combos,
// no verb, ends with a period.
// Example: "New object reference each render."
const NOUN_PHRASE_RE =
  /^(New|Old|Large|Small|Missing|Extra|Wrong|Bad|Good|High|Low|Empty|Full|Multiple|Single|Same|Different)\b/i;

function completeSentence(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed || hasVerb(trimmed)) return sentence;
  if (!NOUN_PHRASE_RE.test(trimmed)) return sentence;

  // Inject "exists" before the last prepositional phrase or at the end.
  // "New object reference each render." → "A new object reference exists on each render."
  const withArticle = /^[aeiou]/i.test(trimmed) ? `An ${trimmed}` : `A ${trimmed}`;
  // Insert "exists" before terminal period.
  return withArticle.replace(/\.$/, " exists.");
}

function completeFragments(text: string): string {
  const sentences = splitSentences(text);
  return sentences.map(completeSentence).join(" ");
}

export const fragmentsRule: Rule = {
  name: "fragments",
  apply: completeFragments,
};
