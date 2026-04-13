import { arrowsRule } from "./rules/arrows.js";
import { createAbbreviationsRule } from "./rules/abbreviations.js";
import { createFragmentsRule } from "./rules/fragments.js";
import { conjunctionsRule } from "./rules/conjunctions.js";
import { articlesRule } from "./rules/articles.js";
import { punctuationRule } from "./rules/punctuation.js";
import { ventilateRule } from "./rules/ventilate.js";
import type { Rule, ExpandOptions } from "./types.js";

function buildRules(opts?: Partial<ExpandOptions>): Rule[] {
  const disabled = opts?.disableRules ?? new Set<string>();
  const extra = opts?.extraAbbreviations ?? {};

  const all: Rule[] = [
    arrowsRule,
    createAbbreviationsRule(extra),
    createFragmentsRule(opts?.fragmentLevel ?? 1),
    conjunctionsRule,
    articlesRule,
    punctuationRule,
    ventilateRule,
  ];

  return all.filter((r) => !disabled.has(r.name));
}

interface Segment {
  type: "text" | "code";
  content: string;
}

// Split text into alternating text/code segments.
// Code fences (```...```) and inline code (`...`) are preserved verbatim.
export function splitCodeSegments(text: string): Segment[] {
  const segments: Segment[] = [];
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

function joinSegments(segments: Segment[]): string {
  return segments.map((s) => s.content).join("");
}

function applyRules(text: string, rules: Rule[]): string {
  let out = text;
  for (const rule of rules) {
    out = rule.apply(out);
  }
  return out;
}

// Expand caveman text deterministically.
// Code blocks are passed through unchanged.
export function expandDeterministic(text: string, opts?: Partial<ExpandOptions>): string {
  const rules = buildRules(opts);
  const segments = splitCodeSegments(text);
  const processed = segments.map((seg) => {
    if (seg.type === "code") return seg;
    return { ...seg, content: applyRules(seg.content, rules) };
  });
  return joinSegments(processed);
}

// Count words (rough heuristic for LLM-trigger threshold).
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
