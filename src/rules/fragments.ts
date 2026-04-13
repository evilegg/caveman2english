import type { Rule, FragmentLevel } from "../types.js";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

// Split a block of text into sentences, preserving the terminal punctuation
// on each sentence. Splits on terminal-punct + whitespace.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// True if the sentence contains a finite verb or assignment operator.
// Intentionally broad so we don't over-fire on valid English.
const VERB_RE =
  /\b(is|are|was|were|has|have|had|do|does|did|will|would|can|could|should|must|need|occur|occur|occur|return|throws?|calls?|sets?|gets?|runs?|fails?|passes?|takes?|makes?|uses?|adds?|removes?|creates?|updates?|deletes?|contains?|requires?|causes?|shows?|needs?|starts?|stops?|leads?|means?|results?)\b|[=:]/i;
function hasVerb(sentence: string): boolean {
  if (VERB_RE.test(sentence)) return true;
  // Count -ed words as verbs only when they are NOT the first word.
  // Sentence-initial -ed words are adjectives ("Malformed", "Cached", etc.).
  const edMatch = /\b\w+ed\b/.exec(sentence);
  return !!edMatch && edMatch.index > 0;
}

// True if the sentence looks like an imperative command: starts with a verb
// in base form. We leave these untouched at all levels.
const IMPERATIVE_RE =
  /^(wrap|use|add|remove|fix|check|run|set|get|call|pass|return|import|export|install|update|delete|create|move|rename|merge|split|refactor|test|debug|log|validate|handle|throw|catch|ignore|skip|avoid|prefer|ensure|keep|make|build|deploy|push|pull|fetch|send|read|write|parse|format|convert|restart|rerun|retry|verify)\b/i;

function isImperative(sentence: string): boolean {
  return IMPERATIVE_RE.test(sentence.trim());
}

// ---------------------------------------------------------------------------
// Level 1 — conservative (original behaviour)
// ---------------------------------------------------------------------------
// Only fires on a narrow list of adjective-prefix patterns.

const CONSERVATIVE_ADJ_RE =
  /^(New|Old|Large|Small|Missing|Extra|Wrong|Bad|Good|High|Low|Empty|Full|Multiple|Single|Same|Different|Stale|Broken|Invalid|Expired|Uncached|Duplicate)\b/i;

function completeConservative(sentence: string): string {
  const t = sentence.trim();
  if (!t || hasVerb(t) || isImperative(t)) return sentence;
  if (!CONSERVATIVE_ADJ_RE.test(t)) return sentence;

  const withArticle = /^[aeiou]/i.test(t) ? `An ${t}` : `A ${t}`;
  return withArticle.replace(/\.$/, " exists.");
}

// ---------------------------------------------------------------------------
// Level 2 — moderate
// ---------------------------------------------------------------------------
// Broader verbless detection; pattern-based verb injection.

// Adjectives that can lead a fragment. Broader than conservative list.
const LEADING_ADJ_RE =
  /^(missing|wrong|broken|bad|invalid|incorrect|stale|old|new|large|small|empty|full|high|low|multiple|single|same|different|extra|unused|undefined|null|unset|malformed|duplicate|circular|async|sync|cached|uncached|expired|outdated|slow|fast|incomplete|redundant|deprecated)\b/i;

// Prepositions that begin a contextual phrase (time/place/frequency).
const PREP_RE = /\b(in|on|at|per|each|every|with|without|for|during|before|after|across|between|inside|outside|via|through)\b/i;

// Extract leading adjective + rest from an adj-led fragment.
// "Missing auth token" → { adj: "Missing", rest: "auth token" }
function parseAdjLed(sentence: string): { adj: string; rest: string } | null {
  const m = sentence.match(/^(\w+)\s+(.+?)\.?$/i);
  if (!m || !LEADING_ADJ_RE.test(m[1]!)) return null;
  return { adj: m[1]!, rest: m[2]! };
}

// "Missing auth token." → "The auth token is missing."
// "Wrong object reference each render." → "The object reference is wrong on each render."
function completeAdjLed(sentence: string): string {
  const parsed = parseAdjLed(sentence);
  if (!parsed) return sentence;

  const { adj, rest } = parsed;
  // Split rest into noun-phrase and trailing prepositional phrase (if any).
  const prepMatch = rest.match(PREP_RE);
  let nounPhrase: string;
  let prepPhrase: string;

  if (prepMatch?.index !== undefined && prepMatch.index > 0) {
    nounPhrase = rest.slice(0, prepMatch.index).trim();
    const rawPrep = rest.slice(prepMatch.index).trim();
    // Normalise bare frequency words to "on each …"
    prepPhrase = /^(each|every|per)\b/i.test(rawPrep) ? `on ${rawPrep}` : rawPrep;
  } else {
    // "each/every/per" at start of a bare frequency phrase without explicit prep.
    const freqMatch = rest.match(/\b(each|every|per)\b/i);
    if (freqMatch?.index !== undefined && freqMatch.index > 0) {
      nounPhrase = rest.slice(0, freqMatch.index).trim();
      prepPhrase = `on ${rest.slice(freqMatch.index).trim()}`;
    } else {
      nounPhrase = rest;
      prepPhrase = "";
    }
  }

  if (!nounPhrase) return sentence;

  const noun = nounPhrase.trim();
  const tail = prepPhrase ? ` ${prepPhrase}` : "";
  return `The ${noun} is ${adj.toLowerCase()}${tail}.`;
}

// "Cache miss each render." → "Cache miss occurs on each render."
// Fires when sentence has a noun phrase followed by a bare frequency/location
// expression and no verb at all.
function completeNounPlusPrepPhrase(sentence: string): string {
  const t = sentence.replace(/\.$/, "");
  // Match: [noun-ish words] [each/every/per <noun>] or [in/on/at <noun>]
  const m = t.match(/^(.+?)\s+(each|every|per|in|on|at|after|before|during)\s+(.+)$/i);
  if (!m) return sentence;

  const subject = m[1]!.trim();
  const prep = m[2]!.toLowerCase();
  const obj = m[3]!.trim();

  // Normalise bare frequency words to "on"
  const normalizedPrep = ["each", "every", "per"].includes(prep) ? "on each" : prep;
  return `${subject} occurs ${normalizedPrep} ${obj}.`;
}

function completeModerate(sentence: string): string {
  const t = sentence.trim();
  if (!t || hasVerb(t) || isImperative(t)) return sentence;

  // Try adj-led first.
  if (LEADING_ADJ_RE.test(t)) {
    return completeAdjLed(t);
  }

  // Try noun + bare prep phrase.
  const nounPrep = completeNounPlusPrepPhrase(t);
  if (nounPrep !== sentence) return nounPrep;

  // Conservative fallback: only fire if starts with a known narrow adj.
  if (CONSERVATIVE_ADJ_RE.test(t)) {
    const withArticle = /^[aeiou]/i.test(t) ? `An ${t}` : `A ${t}`;
    return withArticle.replace(/\.$/, " exists.");
  }

  return sentence;
}

// ---------------------------------------------------------------------------
// Level 3 — aggressive (context-aware)
// ---------------------------------------------------------------------------
// Processes sentences with a sliding window.
// Uses the previous sentence for:
//   1. Article selection — "the" if the fragment noun was mentioned before
//   2. Verb tense — "is" vs "was" matching the prior sentence's tense
//   3. Preposition normalisation for bare frequency phrases

// Extract the dominant content nouns from a sentence (rough heuristic:
// non-stopword tokens ≥ 4 chars).
const STOPWORDS = new Set([
  "this", "that", "with", "from", "into", "onto", "over", "then",
  "also", "when", "where", "what", "which", "have", "been", "will",
  "each", "every", "some", "them", "they", "their", "your", "just",
]);

function contentWords(sentence: string): Set<string> {
  return new Set(
    sentence
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

// Determine if prior sentence uses past tense.
function inferPastTense(prior: string): boolean {
  if (/\b(was|were|had|did|failed|caused|broke|led|made|resulted)\b/i.test(prior)) return true;
  // Also catch general -ed verbs (e.g. "re-rendered", "disconnected"),
  // but skip sentence-initial -ed words which are adjectives.
  const edMatch = /\b\w+ed\b/.exec(prior);
  return !!edMatch && edMatch.index > 0;
}

function completeAggressive(sentence: string, priorSentence: string): string {
  const t = sentence.trim();
  if (!t || hasVerb(t) || isImperative(t)) return sentence;

  const usePast = inferPastTense(priorSentence);
  const copula = usePast ? "was" : "is";
  const priorWords = contentWords(priorSentence);

  // Try adj-led completion with context-aware article and tense.
  if (LEADING_ADJ_RE.test(t)) {
    const parsed = parseAdjLed(t);
    if (parsed) {
      const { adj, rest } = parsed;

      // Determine noun phrase vs trailing prep phrase (same logic as level 2).
      const prepMatch = rest.match(PREP_RE);
      let nounPhrase: string;
      let prepPhrase: string;

      if (prepMatch?.index !== undefined && prepMatch.index > 0) {
        nounPhrase = rest.slice(0, prepMatch.index).trim();
        const rawPrep = rest.slice(prepMatch.index).trim();
        prepPhrase = /^(each|every|per)\b/i.test(rawPrep) ? `on ${rawPrep}` : rawPrep;
      } else {
        const freqMatch = rest.match(/\b(each|every|per)\b/i);
        if (freqMatch?.index !== undefined && freqMatch.index > 0) {
          nounPhrase = rest.slice(0, freqMatch.index).trim();
          prepPhrase = `on ${rest.slice(freqMatch.index).trim()}`;
        } else {
          nounPhrase = rest;
          prepPhrase = "";
        }
      }

      if (nounPhrase) {
        // Use "the" if any word from the noun phrase appeared in the prior sentence.
        const nounWords = contentWords(nounPhrase);
        const nounMentionedBefore = [...nounWords].some((w) => priorWords.has(w));
        const article = nounMentionedBefore ? "The" : "The"; // always "the" for context mode
        const tail = prepPhrase ? ` ${prepPhrase}` : "";
        return `${article} ${nounPhrase} ${copula} ${adj.toLowerCase()}${tail}.`;
      }
    }
  }

  // Noun + bare prep phrase with context-aware preposition.
  const nounPrep = completeNounPlusPrepPhrase(t);
  if (nounPrep !== t && nounPrep !== sentence) {
    // Adjust tense of "occurs" if past context.
    return usePast ? nounPrep.replace(/\boccurs\b/, "occurred") : nounPrep;
  }

  // Conservative fallback.
  if (CONSERVATIVE_ADJ_RE.test(t)) {
    const withArticle = /^[aeiou]/i.test(t) ? `An ${t}` : `A ${t}`;
    const base = withArticle.replace(/\.$/, "");
    return `${base} ${copula === "was" ? "existed" : "exists"}.`;
  }

  return sentence;
}

function completeWithContext(sentences: string[]): string[] {
  return sentences.map((sentence, i) => {
    const prior = i > 0 ? (sentences[i - 1] ?? "") : "";
    return completeAggressive(sentence, prior);
  });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFragmentsRule(level: FragmentLevel): Rule {
  if (level === 0) {
    return { name: "fragments(off)", apply: (text) => text };
  }

  if (level === 1) {
    return {
      name: "fragments(conservative)",
      apply(text) {
        return splitSentences(text).map(completeConservative).join(" ");
      },
    };
  }

  if (level === 2) {
    return {
      name: "fragments(moderate)",
      apply(text) {
        return splitSentences(text).map(completeModerate).join(" ");
      },
    };
  }

  // level === 3
  return {
    name: "fragments(aggressive)",
    apply(text) {
      return completeWithContext(splitSentences(text)).join(" ");
    },
  };
}

// Default export for backward compatibility.
export const fragmentsRule: Rule = createFragmentsRule(1);
