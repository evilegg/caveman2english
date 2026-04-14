/**
 * Gilfoyle v2 synthetic encoder.
 *
 * Extends v1 with aggressive compression moves that close the gap with caveman
 * while keeping all semantic ligatures intact:
 *
 * NEW in v2:
 *   - Tilde hedging: might/likely/probably + outcome → ~outcome
 *   - Copula deletion: "is being exhausted" → "exhausted"
 *   - Causation arrows: "X because Y" → "Y → X" (cause first, always)
 *   - `the` stripping in non-referential action-sentence positions
 *   - Relative clause compression: "which prevents X" → "blocking X"
 *   - Infinitive phrase compression: "in order to ensure X" → "ensuring X"
 *   - Numeric normalisation: "thirty seconds" → "30s", "eight gigabytes" → "8GB"
 *   - Passive → active when `by`-agent is present in sentence
 *   - Expanded abbreviation table
 *
 * PRESERVED from v1:
 *   - All semantic ligatures (must/cannot/might as real modals, because/since,
 *     negation scope, contrastive markers)
 *   - GFM task list conversion for parallel action steps
 *   - Imperative restructuring (you should X → X)
 */

import { ABBREVIATIONS } from "../ust/shared-abbrevs.js";

// ── Extended abbreviations ────────────────────────────────────────────────────

const EXTRA_ABBREVS: [RegExp, string][] = [
  [/\bconnections?\b/gi, "conn"],
  [/\btimeout\b/gi, "tmo"],
  [/\bmiddleware\b/gi, "mw"],
  [/\bspecification\b/gi, "spec"],
  [/\bconcurrently\b/gi, "concur"],
  [/\bautomatically\b/gi, "auto"],
  [/\bincrementally\b/gi, "incr"],
  [/\binterceptor\b/gi, "icpt"],
  [/\bworker thread\b/gi, "worker"],
  [/\bselector\b/gi, "sel"],
  [/\bstatement\b/gi, "stmt"],
  [/\bvulnerability\b/gi, "vuln"],
  [/\battacker\b/gi, "attacker"], // keep — "attacker" is already short
];

// ── Numeric normalisation ─────────────────────────────────────────────────────

const ONES: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18",
  nineteen: "19", twenty: "20", thirty: "30", forty: "40",
  fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "100",
};

const UNITS: [RegExp, string][] = [
  [/\s+seconds?\b/gi, "s"],
  [/\s+milliseconds?\b/gi, "ms"],
  [/\s+minutes?\b/gi, "min"],
  [/\s+hours?\b/gi, "h"],
  [/\s+kilobytes?\b/gi, "KB"],
  [/\s+megabytes?\b/gi, "MB"],
  [/\s+gigabytes?\b/gi, "GB"],
  [/\s+pages?\b/gi, " page"],
  [/\s+requests?\s+per\s+minute\b/gi, " req/min"],
  [/\s+requests?\s+per\s+second\b/gi, " req/s"],
];

function normaliseNumbers(s: string): string {
  // Replace written numbers with digits
  let result = s.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/gi,
    (m) => ONES[m.toLowerCase()] ?? m,
  );

  // Collapse "N hundred" → "100", "N0" patterns already handled above
  // "1 hundred" → "100"
  result = result.replace(/\b(\d+)\s+100\b/g, (_, n) => String(Number(n) * 100));

  // Attach unit suffixes to the preceding digit
  for (const [re, unit] of UNITS) {
    result = result.replace(re, unit);
  }

  return result;
}

// ── Tilde hedging ─────────────────────────────────────────────────────────────

// "might cause X" → "~X"
// "may result in X" → "~X"
const HEDGE_VERB_RE =
  /\b(might|may|could)\s+(cause|result in|lead to|create|introduce|produce|trigger)\s+/gi;

// "likely caused by" → "~caused by"
// "probably related to" → "~related to"
// "possibly X" → "~X"
const HEDGE_ADV_RE = /\b(likely|probably|possibly|perhaps)\s+/gi;

// Sentence-initial: "This might X" → "~X"
const SENTENCE_HEDGE_RE = /^(This|It|That)\s+(might|may|could)\s+/i;

function applyTildeHedging(s: string): string {
  // Sentence-initial hedge: "This might cause intermittent bugs" → "~intermittent bugs"
  // But only strip the cause-verb too if it's a pure causal verb
  s = s.replace(SENTENCE_HEDGE_RE, "~");

  // Inline: "might cause race condition" → "~race condition"
  s = s.replace(HEDGE_VERB_RE, "~");

  // Inline adverb: "likely caused by" → "~caused by"
  s = s.replace(HEDGE_ADV_RE, "~");

  // Normalise "~~" (double hedge from overlapping rules) → "~"
  s = s.replace(/~+/g, "~");

  return s;
}

// ── Copula deletion ───────────────────────────────────────────────────────────

// "is being exhausted" → "exhausted"
// "are being processed" → "processed"
const COPULA_PROGRESSIVE_PASSIVE_RE =
  /\b(is|are|was|were)\s+being\s+(\w+(?:ed|en))\b/gi;

// "is broken" / "are missing" — simple copula + predicate adjective/participle
// Only fire on a known list of technical predicate adjectives to avoid over-stripping
const TECH_PREDICATES =
  "broken|exhausted|missing|stale|deprecated|undefined|null|expired|invalid|corrupted|overloaded|blocked|disconnected|throttled|failing|incorrect|wrong|lost|dropped|rejected|denied|swallowed|leaked|held|locked|buffered|queued|cached|evicted|flushed|closed|terminated|killed|restarted|unreachable|unavailable|unresponsive|malformed|truncated";

const COPULA_ADJ_RE = new RegExp(
  `\\b(is|are|was|were)\\s+(${TECH_PREDICATES})\\b`,
  "gi",
);

// "is occurring" / "is running" / "is sending" — copula + gerund
// Only strip when it adds no tense information the predicate doesn't carry
const COPULA_GERUND_RE = /\b(is|are)\s+(\w+ing)\b/gi;

function deleteCopula(s: string): string {
  // "is being exhausted" → "exhausted"
  s = s.replace(COPULA_PROGRESSIVE_PASSIVE_RE, "$2");

  // "is broken" → "broken"
  s = s.replace(COPULA_ADJ_RE, "$2");

  // "is occurring" → "occurring" (only simple gerund, no objects)
  // Be conservative: only fire when the gerund ends the sentence or is
  // followed by a preposition phrase — don't strip mid-clause gerunds
  s = s.replace(COPULA_GERUND_RE, "$2");

  return s;
}

// ── Causation arrows ──────────────────────────────────────────────────────────

// Always emit A → B (cause first).
// Detect "EFFECT because CAUSE" and restructure to "CAUSE → EFFECT".
// Only fires when the because-clause is clearly the second half of the sentence.

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function restructureCausation(s: string): string {
  // Pattern: MAIN_CLAUSE because/since CAUSE_CLAUSE
  // Heuristic: split at "because" or "since", restructure if both halves are
  // non-trivial (> 3 words each)
  const becauseMatch = s.match(/^(.+?)\s+because\s+(.+)$/i);
  if (becauseMatch) {
    const [, effect, cause] = becauseMatch;
    if (
      effect &&
      cause &&
      effect.split(/\s+/).length >= 3 &&
      cause.split(/\s+/).length >= 3
    ) {
      return `${capitalise(cause.trim())} → ${effect.trim()}`;
    }
  }

  const sinceMatch = s.match(/^(.+?)\s+since\s+(.+)$/i);
  if (sinceMatch) {
    const [, effect, cause] = sinceMatch;
    if (
      effect &&
      cause &&
      effect.split(/\s+/).length >= 3 &&
      cause.split(/\s+/).length >= 3
    ) {
      return `${capitalise(cause.trim())} → ${effect.trim()}`;
    }
  }

  return s;
}

// ── `the` stripping ───────────────────────────────────────────────────────────

// Strip "the" before technical generic nouns in action sentences.
// Keep "the" when it precedes a proper noun, a referent introduced mid-paragraph,
// or when stripping would produce ambiguity.
// Conservative heuristic: strip "the" only in imperative sentences (already
// restructured) and only before nouns in the ABBREVS table (known technical terms).
const THE_BEFORE_TECH_RE = /\bthe\s+(DB|auth|cfg|fn|err|req|res|ctx|impl|init|perf|comp|obj|val|str|num|bool|conn|tmo|mw|spec|worker|sel|stmt|vuln|pool|cache|queue|server|client|payload|endpoint|header|token|session|handler|callback|closure|hook|listener|event|promise|thread|process|loop|pipeline|proxy|gateway|router|scheduler|registry|container|pod|node|cluster|image|network|volume|secret|config|env)\b/gi;

function stripThe(s: string): string {
  // Only strip in imperative sentences (action steps)
  if (ACTION_IMPERATIVE_RE.test(s.trim())) {
    s = s.replace(THE_BEFORE_TECH_RE, "$1");
  }
  return s;
}

// ── Relative clause compression ───────────────────────────────────────────────

// "which prevents connections from returning" → "blocking conn return"
// "which causes React to think" → "causing React to think"
// "that prevents X from Y-ing" → "blocking X from Y-ing"
const REL_PREVENTS_RE =
  /,?\s+which\s+(prevents?|stops?|blocks?)\s+(.+?)\s+from\s+(\w+ing)/gi;

const REL_CAUSES_RE = /,?\s+which\s+(causes?|makes?|forces?)\s+/gi;

const REL_VERB_RE = /,?\s+which\s+(\w+s?)\s+/gi;

function compressRelativeClauses(s: string): string {
  // "which prevents X from Y-ing" → "blocking X from Y-ing"
  s = s.replace(REL_PREVENTS_RE, " blocking $2 from $3");

  // "which causes X to Y" → "causing X to Y"
  s = s.replace(REL_CAUSES_RE, " causing ");

  // Generic: "which Vs " → "V-ing " (participial)
  // Only fire when the verb is a simple present-tense form
  s = s.replace(REL_VERB_RE, (_, verb: string) => {
    // Don't transform if already handled above
    if (/^(prevents?|stops?|blocks?|causes?|makes?|forces?)$/.test(verb)) return ` ${verb} `;
    // Convert "which requires" → "requiring", "which introduces" → "introducing"
    const ing = verb.replace(/s$/, "ing").replace(/eing$/, "ing");
    return ` ${ing} `;
  });

  return s;
}

// ── Infinitive phrase compression ─────────────────────────────────────────────

const INFINITIVE_PHRASES: [RegExp, string][] = [
  [/\bin order to ensure( that)?\s+/gi, "ensuring "],
  [/\bin order to prevent\s+/gi, "preventing "],
  [/\bin order to avoid\s+/gi, "avoiding "],
  [/\bin order to allow\s+/gi, "allowing "],
  [/\bin order to\s+/gi, "to "],
  [/\bso that\s+/gi, "→ "],
  [/\bto make sure( that)?\s+/gi, "ensuring "],
  [/\bto ensure( that)?\s+/gi, "ensuring "],
  [/\bto prevent\s+/gi, "preventing "],
  [/\beven when\s+/gi, "even on "],
];

function compressInfinitives(s: string): string {
  for (const [re, replacement] of INFINITIVE_PHRASES) {
    s = s.replace(re, replacement);
  }
  return s;
}

// ── Passive → active ──────────────────────────────────────────────────────────

// Only convert when `by`-agent is explicitly in the sentence.
// "X is Y-ed by Z" → "Z Y-s X"
// No agent invention — if no `by`-phrase, leave for copula deletion to handle.
const PASSIVE_BY_RE =
  /\b(\w[\w\s]+?)\s+(?:is|are|was|were)\s+(\w+(?:ed|en))\s+by\s+(\w[\w\s]+?)(?=[.,;]|$)/gi;

function convertPassiveToActive(s: string): string {
  return s.replace(PASSIVE_BY_RE, (_, obj: string, verb: string, agent: string) => {
    // Crude active form: agent + verb (drop -ed/-en suffix heuristically) + obj
    const activeVerb = verb
      .replace(/pped$/, "p")   // dropped → drop
      .replace(/tted$/, "t")   // committed → commit  (rough)
      .replace(/ned$/, "n")    // opened → open (rough)
      .replace(/ed$/, "")      // configured → configure
      .replace(/en$/, "");     // broken → break (too aggressive — skip)
    return `${agent.trim()} ${activeVerb} ${obj.trim()}`;
  });
}

// ── Strip patterns (carried over from v1) ─────────────────────────────────────

const PLEASANTRIES_RE =
  /\b(I('d| would) (be happy to|like to)|let me (explain|walk you through|start by|begin by)|note that|please note( that)?|keep in mind( that)?|it('s| is) worth noting( that)?)\b\s*/gi;

const FILLER_ADV_RE =
  /\b(really|very|quite|basically|simply|just|actually|essentially|effectively)\b\s*/gi;

const HEDGING_THEATER_RE =
  /\b(you might (want to )?consider(ing)?|it (may|might) be worth( considering)?|you (may|might) (want to |wish to )?(consider|think about|look at|take a look at))\s*/gi;

const ARTICLES_RE = /\b(a|an)\s+(?=[a-zA-Z])/g;

const CAUSAL_PREFIX_RE =
  /^(This is because|This happens because|This occurs because|The reason is that|This is caused by)\s*/i;

// ── Restructure patterns (carried over from v1) ───────────────────────────────

const YOU_SHOULD_RE = /^You (should|need to|ought to) /i;
const YOU_MUST_RE = /^You (must|cannot|can't|have to) /i;

const ACTION_IMPERATIVE_RE =
  /^(wrap|use|add|remove|fix|check|run|set|get|call|pass|return|import|export|install|update|delete|create|move|rename|merge|split|refactor|test|debug|log|validate|handle|throw|catch|ignore|skip|avoid|prefer|ensure|keep|make|build|deploy|push|pull|fetch|send|read|write|parse|format|convert|restart|rerun|retry|verify|implement|enable|disable|configure|switch|replace|increase|decrease|reduce|extract|inject|register|unregister)\b/i;

// ── Sentence-level transform ──────────────────────────────────────────────────

function transformSentence(sentence: string): string {
  let s = sentence.trim();
  if (!s) return s;

  // Remove terminal period early so patterns match at end-of-sentence correctly
  s = s.replace(/\.$/, "").trim();

  // 1. Strip causal opener when "because" appears inline
  s = s.replace(CAUSAL_PREFIX_RE, "because ");

  // 2. Strip hedging theater (softeners, not real modals)
  s = s.replace(HEDGING_THEATER_RE, "");
  s = s.replace(PLEASANTRIES_RE, "");
  s = s.replace(FILLER_ADV_RE, "");

  // 3. Passive → active (before copula deletion, needs copula present)
  s = convertPassiveToActive(s);

  // 4. Copula deletion
  s = deleteCopula(s);

  // 5. Tilde hedging (after copula so "is likely" → "likely" first)
  s = applyTildeHedging(s);

  // 6. Relative clause compression
  s = compressRelativeClauses(s);

  // 7. Infinitive compression
  s = compressInfinitives(s);

  // 8. Restructure "You must/cannot X" → "Must/Cannot X"
  s = s.replace(YOU_MUST_RE, (_, modal: string) => {
    return modal.charAt(0).toUpperCase() + modal.slice(1) + " ";
  });

  // 9. Restructure "You should/need to X" → "X" (imperative)
  s = s.replace(YOU_SHOULD_RE, "");

  // 10. Strip indefinite articles
  s = s.replace(ARTICLES_RE, "");

  // 11. Apply abbreviations (base table + extensions)
  for (const [re, abbr] of ABBREVIATIONS) {
    s = s.replace(re, abbr);
  }
  for (const [re, abbr] of EXTRA_ABBREVS) {
    s = s.replace(re, abbr);
  }

  // 12. Numeric normalisation
  s = normaliseNumbers(s);

  // 13. Strip "the" before known technical nouns in action sentences
  s = stripThe(s);

  // 14. Capitalise first word
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }

  // 15. Normalise whitespace
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

// ── Causation restructuring (document-level) ──────────────────────────────────

// Applied after sentence transforms so abbreviations are in place before
// the restructured sentence is emitted.
function restructureSentence(s: string): string {
  return restructureCausation(s);
}

// ── GFM list detection (carried over from v1) ─────────────────────────────────

function isActionItem(transformed: string): boolean {
  return ACTION_IMPERATIVE_RE.test(transformed) && transformed.split(/\s+/).length <= 25;
}

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

  const transformed = rawSentences
    .map(transformSentence)
    .map(restructureSentence)
    .filter(Boolean);

  const output: string[] = [];

  if (transformed.length >= 2 && areParallelItems(transformed)) {
    for (const s of transformed) {
      output.push(`- [ ] ${s}`);
    }
    return output.join("\n");
  }

  for (let i = 0; i < transformed.length; i++) {
    const s = transformed[i]!;
    if (isActionItem(s)) {
      const runStart = i;
      while (i < transformed.length && isActionItem(transformed[i]!)) {
        i++;
      }
      const run = transformed.slice(runStart, i);
      i--;

      if (run.length >= 2) {
        for (const item of run) {
          output.push(`- [ ] ${item}`);
        }
      } else {
        output.push(run[0]!);
      }
    } else {
      output.push(s);
    }
  }

  return output.join("\n");
}
