/**
 * Synthetic UST encoder.
 *
 * Simulates what an LLM following the UST skill prompt would produce.
 * Used to generate (original, ust_encoded) pairs for the benchmark
 * without making live API calls.
 *
 * Strategy: parse the sentence's likely semantic role from its content,
 * emit the appropriate marker, then apply caveman-style content compression.
 */

import { ABBREVIATIONS } from "./shared-abbrevs.js";

// ── Role classification heuristics ──────────────────────────────────────────

const PROBLEM_SIGNALS =
  /\b(error|fail|broken|wrong|incorrect|missing|invalid|bad|issue|bug|problem|crash|leak|vulnerab|exhaust|block|drop|conflict|cannot|can't|unable|doesn't|isn't|won't|not being|returning 4\d\d)\b/i;

const FIX_SIGNALS =
  /\b(you should|should (use|add|wrap|call|implement|set|update|check|ensure|return|move|add)|must (use|add|wrap|call|implement)|need to|fix (this|is to)|solution|resolve|update|add the|use (a|the)?\s+\w+\s+(to|for)|implement)\b/i;

const REASON_SIGNALS =
  /\b(because|this is (because|caused by|due to)|the reason|caused by|due to)\b/i;

const WARNING_SIGNALS =
  /\b(warning|be careful|caution|avoid|never|dangerous|security|vulnerab|attack|malicious|risk|unsafe|could (break|fail|cause problems))\b/i;

const EXAMPLE_SIGNALS = /\b(for example|e\.g\.|such as|like)\b/i;

const SPECIFIC_SIGNALS = /\b(specifically|in particular|the (specific|exact|particular))\b/i;

type Role = "🔴" | "🟢" | "🔵" | "💡" | "🟡" | "🔍" | "📌";

function classifyRole(sentence: string): Role {
  if (WARNING_SIGNALS.test(sentence)) return "🟡";
  if (EXAMPLE_SIGNALS.test(sentence)) return "🔍";
  if (SPECIFIC_SIGNALS.test(sentence)) return "📌";
  if (REASON_SIGNALS.test(sentence)) return "💡";
  if (FIX_SIGNALS.test(sentence)) return "🟢";
  if (PROBLEM_SIGNALS.test(sentence)) return "🔴";
  return "🔵"; // fallback: context
}

// ── Certainty marker injection ───────────────────────────────────────────────

function injectCertainty(sentence: string): string {
  return sentence
    .replace(/\b(might|may)\s+/gi, "? ")
    .replace(/\b(probably|likely)\s+/gi, "~ ")
    .replace(/\b(must|need to)\s+/gi, "! ")
    .replace(/\b(definitely|certainly)\s+/gi, "✅ ");
}

// ── Inline relational markers ────────────────────────────────────────────────

function injectRelational(sentence: string): string {
  return sentence
    .replace(/,?\s+which (causes|leads to|results in|makes)\s+/gi, " ⚡ ")
    .replace(/,?\s+(causing|resulting in)\s+/gi, " ↩ ")
    .replace(/\b(on each|per|every)\s+/gi, "🔁 ");
}

// ── Content compression (mirrors caveman Full) ───────────────────────────────

const ARTICLES_RE = /\b(a|an)\s+/g; // drop "a"/"an" but keep "the"
const FILLER_RE =
  /\b(really|very|quite|basically|simply|just|actually|essentially|effectively|of course|as (a|an) result,?\s*)\b\s*/gi;
const PLEASANTRIES_RE =
  /\b(I('d| would) (be happy to|like to)|let me (explain|walk you through)|note that|please note( that)?|keep in mind( that)?)\b\s*/gi;
// Strip causal phrases that are now encoded by 💡 role marker
const CAUSAL_PREFIX_RE =
  /^(This is because|This happens because|This occurs because|The reason is that|This is caused by)\s*/i;

function compressContent(sentence: string): string {
  let s = sentence;
  s = s.replace(CAUSAL_PREFIX_RE, ""); // role marker handles it
  s = s.replace(FILLER_RE, "");
  s = s.replace(PLEASANTRIES_RE, "");
  s = s.replace(ARTICLES_RE, "");
  for (const [re, abbr] of ABBREVIATIONS) {
    s = s.replace(re, abbr);
  }
  return s.trim();
}

// ── Main encoder ─────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function encodeUST(text: string): string {
  const sentences = splitSentences(text);
  return sentences
    .map((sentence) => {
      const role = classifyRole(sentence);
      let content = injectCertainty(sentence);
      content = injectRelational(content);
      content = compressContent(content);
      // Remove terminal period — UST lines don't need it
      content = content.replace(/\.$/, "").trim();
      return `${role} ${content}`;
    })
    .join("\n");
}
