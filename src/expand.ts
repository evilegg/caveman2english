import { arrowsRule } from "./rules/arrows.js";
import { abbreviationsRule } from "./rules/abbreviations.js";
import { fragmentsRule } from "./rules/fragments.js";
import { conjunctionsRule } from "./rules/conjunctions.js";
import { punctuationRule } from "./rules/punctuation.js";
import type { Rule } from "./types.js";

// The ordered deterministic rule pipeline.
// Code fences and inline code spans are extracted before applying rules
// and re-injected afterwards so they are never modified.
const RULES: Rule[] = [
  arrowsRule,
  abbreviationsRule,
  fragmentsRule,
  conjunctionsRule,
  punctuationRule,
];

interface Segment {
  type: "text" | "code";
  content: string;
}

// Split text into alternating text/code segments.
// Code fences (```...```) and inline code (`...`) are preserved verbatim.
export function splitCodeSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match fenced code blocks first, then inline code spans.
  const CODE_RE = /```[\s\S]*?```|`[^`\n]+`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", content: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

// Rejoin segments back into a single string.
function joinSegments(segments: Segment[]): string {
  return segments.map((s) => s.content).join("");
}

// Apply the deterministic rule pipeline to a plain-text segment.
function applyRules(text: string, rules: Rule[] = RULES): string {
  let out = text;
  for (const rule of rules) {
    out = rule.apply(out);
  }
  return out;
}

// Expand caveman text deterministically.
// Code blocks are passed through unchanged.
export function expandDeterministic(text: string): string {
  const segments = splitCodeSegments(text);
  const processed = segments.map((seg) => {
    if (seg.type === "code") return seg;
    return { ...seg, content: applyRules(seg.content) };
  });
  return joinSegments(processed);
}

// Count words (rough heuristic for LLM-trigger threshold).
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
