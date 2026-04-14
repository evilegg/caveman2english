/**
 * Gilfoyle synthetic encoder.
 *
 * Implements the Gilfoyle dialect: binding-preserving compression that produces
 * direct, imperative, structured output requiring zero cognitive reconstruction.
 *
 * STRIPS (cosmetic padding — zero information content):
 *   - Pleasantries: "I'd be happy to", "let me explain", "note that", "keep in mind"
 *   - Filler adverbs: really, very, quite, basically, just, actually, essentially
 *   - Redundant hedging softeners: "you might want to consider", "it may be worth"
 *   - Indefinite articles: a, an (recoverable; "the" kept for previously-introduced referents)
 *   - Causal sentence prefixes that are redundant when "because" appears inline
 *
 * PRESERVES (semantic ligatures — breaking costs cognitive overhead):
 *   - Modal verbs with genuine meaning: must, might, cannot, should (technical context)
 *   - Causal conjunctions: because, since, therefore
 *   - Negation scope: without, not, never, no
 *   - Contrastive markers: but, however, although
 *
 * RESTRUCTURES for directness:
 *   - "You should wrap X" → "Wrap X" (social softening → imperative)
 *   - "You must wrap X" → "Must wrap X" (obligation kept as real information)
 *   - "You might want to consider X" → "Consider X"
 *   - Parallel prose items → GFM bullet lists
 *   - Action requests → GFM task checkboxes "- [ ] X"
 *
 * APPLIES standard abbreviations (same table as other experiments).
 */

import { ABBREVIATIONS } from "../ust/shared-abbrevs.js";

// ── Strip patterns ────────────────────────────────────────────────────────────

const PLEASANTRIES_RE =
  /\b(I('d| would) (be happy to|like to)|let me (explain|walk you through|start by|begin by)|note that|please note( that)?|keep in mind( that)?|it('s| is) worth noting( that)?)\b\s*/gi;

const FILLER_ADV_RE =
  /\b(really|very|quite|basically|simply|just|actually|essentially|effectively)\b\s*/gi;

// Hedging theater: "you might want to consider" → stripped (recommendation follows)
// "it may be worth" → stripped
const HEDGING_RE =
  /\b(you might (want to )?consider(ing)?|it (may|might) be worth( considering)?|you (may|might) (want to |wish to )?(consider|think about|look at|take a look at))\s*/gi;

const ARTICLES_RE = /\b(a|an)\s+(?=[a-zA-Z])/g;

// Causal sentence-opener when "because" appears later inline
const CAUSAL_PREFIX_RE =
  /^(This is because|This happens because|This occurs because|The reason is that|This is caused by)\s*/i;

// ── Restructure patterns ──────────────────────────────────────────────────────

// "You should X" → "X" (social modal — strip subject+modal, leave imperative)
// "You need to X" → "X"
// Does NOT match "must" or "might" — those are real information
const YOU_SHOULD_RE = /^You (should|need to|ought to) /i;

// "You must X" → "Must X" (obligation — keep modal, drop subject)
const YOU_MUST_RE = /^You (must|cannot|can't|have to) /i;

// "You might want to consider X" is already handled by HEDGING_RE above.
// After stripping the hedge, "X" is left as an imperative.

// ── GFM structure detection ───────────────────────────────────────────────────

// Sentence-level action-request patterns → "- [ ] X"
// Triggers when a sentence is an explicit instruction directed at the reader.
const ACTION_IMPERATIVE_RE =
  /^(wrap|use|add|remove|fix|check|run|set|get|call|pass|return|import|export|install|update|delete|create|move|rename|merge|split|refactor|test|debug|log|validate|handle|throw|catch|ignore|skip|avoid|prefer|ensure|keep|make|build|deploy|push|pull|fetch|send|read|write|parse|format|convert|restart|rerun|retry|verify|implement|enable|disable|configure|switch|replace|increase|decrease|reduce|move|extract|inject|register|unregister)\b/i;

// ── Sentence-level transform ──────────────────────────────────────────────────

function transformSentence(sentence: string): string {
  let s = sentence.trim();
  if (!s) return s;

  // Strip causal opener when "because" appears inline
  s = s.replace(CAUSAL_PREFIX_RE, "because ");

  // Strip hedging theater first (before filler, to avoid partial matches)
  s = s.replace(HEDGING_RE, "");

  // Strip pleasantries
  s = s.replace(PLEASANTRIES_RE, "");

  // Strip filler adverbs
  s = s.replace(FILLER_ADV_RE, "");

  // Restructure "You must/cannot X" → "Must/Cannot X"
  s = s.replace(YOU_MUST_RE, (_, modal: string) => {
    return modal.charAt(0).toUpperCase() + modal.slice(1) + " ";
  });

  // Restructure "You should/need to/ought to X" → "X" (imperative)
  s = s.replace(YOU_SHOULD_RE, "");
  // Capitalise the first word after stripping
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Strip indefinite articles
  s = s.replace(ARTICLES_RE, "");

  // Apply abbreviations
  for (const [re, abbr] of ABBREVIATIONS) {
    s = s.replace(re, abbr);
  }

  // Normalise whitespace
  s = s.replace(/\s{2,}/g, " ").trim();

  // Remove terminal period — consistent with caveman style, GFM bullets handle punctuation
  s = s.replace(/\.$/, "").trim();

  return s;
}

// ── GFM list detection ────────────────────────────────────────────────────────

/**
 * Determine whether a sentence should be rendered as a GFM task checkbox.
 * Criteria: the sentence is an imperative directed at the reader (starts with
 * an action verb) AND is short enough to be a list item (≤ 20 words after
 * transformation).
 */
function isActionItem(transformed: string): boolean {
  return ACTION_IMPERATIVE_RE.test(transformed) && transformed.split(/\s+/).length <= 25;
}

/**
 * Determine whether a group of sentences forms a parallel list.
 * Criteria: 3+ consecutive imperative sentences with similar structure.
 */
function areParallelItems(sentences: string[]): boolean {
  if (sentences.length < 2) return false;
  const imperatives = sentences.filter((s) => ACTION_IMPERATIVE_RE.test(s));
  return imperatives.length >= 2 && imperatives.length === sentences.length;
}

// ── Main encoder ──────────────────────────────────────────────────────────────

export function encodeGilfoyle(text: string): string {
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const transformed = rawSentences.map(transformSentence).filter(Boolean);

  // Detect parallel action-item groups and convert to GFM task list.
  // Single imperative sentences also become task items if they are standalone.
  const output: string[] = [];

  // Check if the entire response is a list of action items
  if (transformed.length >= 2 && areParallelItems(transformed)) {
    for (const s of transformed) {
      output.push(`- [ ] ${s}`);
    }
    return output.join("\n");
  }

  // Mixed content: convert individual action items, leave prose as-is
  for (let i = 0; i < transformed.length; i++) {
    const s = transformed[i]!;
    // Look ahead: if this and the next 1-2 sentences are all action items,
    // group them as a GFM list
    if (isActionItem(s)) {
      // Collect run of consecutive action items
      const runStart = i;
      while (i < transformed.length && isActionItem(transformed[i]!)) {
        i++;
      }
      const run = transformed.slice(runStart, i);
      i--; // outer loop will increment

      if (run.length >= 2) {
        // Multiple consecutive action items → GFM task list
        for (const item of run) {
          output.push(`- [ ] ${item}`);
        }
      } else {
        // Single action item embedded in prose → keep as-is (no checkbox for single steps)
        output.push(run[0]!);
      }
    } else {
      output.push(s);
    }
  }

  return output.join("\n");
}
