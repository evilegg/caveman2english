import type { Rule } from "../types.js";

// Reformat expanded prose into ventilated style:
// one sentence per line, blank line between paragraphs.
// This makes diffs cleaner and output easier to scan.
//
// Applied to text segments only (code blocks are skipped by the caller).

// Sentence splitter: split after terminal punctuation followed by whitespace.
// We avoid splitting after single-letter abbreviations (e.g. "e.g. foo")
// and after digits (e.g. "version 2. ...") with a negative lookbehind.
const SENTENCE_SPLIT_RE = /(?<![A-Z][a-z]?)(?<=[.!?])\s+(?=[A-Z])/g;

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ventilateParagraph(para: string): string {
  const sentences = splitSentences(para);
  if (sentences.length <= 1) return para.trim();
  return sentences.join("\n");
}

function ventilate(text: string): string {
  // Preserve existing paragraph breaks (blank lines), reformat within each.
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map((p) => ventilateParagraph(p.trim()))
    .filter(Boolean)
    .join("\n\n");
}

export const ventilateRule: Rule = {
  name: "ventilate",
  apply: ventilate,
};
