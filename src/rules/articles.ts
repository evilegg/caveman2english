import type { Rule } from "../types.js";

// Insert indefinite articles (a / an) before bare technical nouns that
// caveman commonly strips.
//
// Scope is intentionally narrow to keep false-positive rate low:
//   - Only fires after prepositions (in, to, from, with, …)
//   - Never fires when a determiner (the / a / an / this / …) is already there
//   - Only targets a curated list of singular countable tech nouns
//
// We do NOT attempt to insert "the" — definiteness requires semantic context
// that deterministic rules cannot reliably infer.

const TECH_NOUNS = new Set([
  "function",
  "component",
  "object",
  "array",
  "string",
  "number",
  "boolean",
  "variable",
  "parameter",
  "argument",
  "callback",
  "promise",
  "request",
  "response",
  "error",
  "exception",
  "middleware",
  "handler",
  "listener",
  "module",
  "package",
  "dependency",
  "endpoint",
  "route",
  "controller",
  "service",
  "repository",
  "migration",
  "transaction",
  "connection",
  "query",
  "trigger",
  "hook",
  "plugin",
  "wrapper",
  "proxy",
  "schema",
  "model",
  "interface",
  "class",
  "instance",
  "constructor",
]);

// Determiners — if the noun is already preceded by one of these, skip.
const DETERMINERS = new Set([
  "the", "a", "an", "this", "that", "these", "those",
  "my", "your", "its", "our", "their",
  "any", "each", "every", "no", "some", "another",
]);

// Prepositions after which we insert the article.
const PREPOSITIONS = new Set([
  "in", "on", "at", "to", "for", "with", "from", "as", "of",
  "by", "via", "into", "onto", "through", "between", "inside", "outside",
  "after", "before", "during", "without", "within", "around",
]);

// Optional adjectives that may appear between the preposition and the noun.
const ADJECTIVE_RE =
  /^(new|old|existing|missing|broken|invalid|stale|simple|complex|async|sync|local|global|private|public|static|dynamic|custom|default|base|abstract|raw|parsed|formatted|cached|fresh|empty|full|shared|unique|duplicate)\s+/i;

function insertArticles(text: string): string {
  // Tokenise by whitespace, preserving the original tokens and the spaces
  // between them so we can reconstruct the string exactly.
  const tokens = text.split(/(\s+)/);
  const result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;

    // Skip whitespace tokens — just accumulate them.
    if (/^\s+$/.test(tok)) {
      result.push(tok);
      continue;
    }

    const lower = tok.toLowerCase().replace(/[^a-z]/g, "");

    // Is this token a preposition?
    if (PREPOSITIONS.has(lower)) {
      result.push(tok);

      // Look ahead past whitespace.
      let j = i + 1;
      while (j < tokens.length && /^\s+$/.test(tokens[j]!)) j++;

      if (j < tokens.length) {
        const nextTok = tokens[j]!;
        const nextLower = nextTok.toLowerCase().replace(/[^a-z]/g, "");

        // Already has a determiner — don't insert.
        if (DETERMINERS.has(nextLower)) continue;

        // Check for optional adjective prefix.
        let adjPrefix = "";
        let nounTok = nextTok;
        let nounLower = nextLower;

        if (!TECH_NOUNS.has(nounLower)) {
          // Maybe adjective + noun? Only if both are single tokens.
          const adjMatch = ADJECTIVE_RE.exec(nextTok);
          if (adjMatch) {
            adjPrefix = adjMatch[0];
            nounTok = nextTok.slice(adjPrefix.length);
            nounLower = nounTok.toLowerCase().replace(/[^a-z]/g, "");
          }
        }

        if (TECH_NOUNS.has(nounLower)) {
          // Determine a vs an based on the first sound after the preposition.
          const firstWord = (adjPrefix || nounTok).trim().toLowerCase();
          const article = /^[aeiou]/.test(firstWord) ? "an" : "a";
          // Insert article + space before the whitespace run leading to nextTok.
          // We splice it in by modifying the next whitespace token.
          tokens[i + 1] = (tokens[i + 1] ?? " ") + `${article} `;
        }
      }
      continue;
    }

    result.push(tok);
  }

  return result.join("");
}

export const articlesRule: Rule = {
  name: "articles",
  apply: insertArticles,
};
