import type { Rule } from "../types.js";

// Normalize punctuation and capitalization.
// Caveman sometimes produces run-on fragments without terminal periods.

// Ensure every sentence (split on whitespace after terminal punctuation)
// starts with a capital letter.
function capitalizeeSentences(text: string): string {
  return text.replace(/([.!?]\s+)([a-z])/g, (_, punct: string, letter: string) =>
    punct + letter.toUpperCase(),
  );
}

// Ensure the very first character is capitalized.
function capitalizeFirst(text: string): string {
  return text.replace(/^([a-z])/, (c) => c.toUpperCase());
}

// Add a terminal period if the text ends without punctuation.
function ensureTerminalPeriod(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return text;
  if (/[.!?`]$/.test(trimmed)) return text;
  // Don't add period after code blocks or list items.
  if (trimmed.endsWith("```")) return text;
  return trimmed + ".";
}

// Collapse multiple spaces (but not newlines).
function collapseSpaces(text: string): string {
  return text.replace(/[^\S\n]+/g, " ");
}

function normalizePunctuation(text: string): string {
  let out = collapseSpaces(text);
  out = capitalizeFirst(out);
  out = capitalizeeSentences(out);
  out = ensureTerminalPeriod(out);
  return out;
}

export const punctuationRule: Rule = {
  name: "punctuation",
  apply: normalizePunctuation,
};
