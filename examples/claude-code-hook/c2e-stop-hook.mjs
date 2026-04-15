#!/usr/bin/env node
/**
 * Claude Code Stop hook — translates the last assistant message from
 * caveman to readable English and prints it to stderr (shown in terminal).
 *
 * Install:
 *   1. Copy this file anywhere on your PATH or reference it by absolute path.
 *   2. Add the Stop hook to your ~/.claude/settings.json (see settings.json
 *      in this directory for an example).
 *   3. Make sure `caveman2english` (or `c2e`) is on your PATH:
 *        npm install -g caveman2english
 *        # or: npm link  (from the caveman2english repo root)
 *
 * How it works:
 *   Claude Code calls this script with the conversation JSON on stdin when
 *   Claude finishes a response.
 *   The script extracts the last assistant message, pipes it through c2e,
 *   and writes the translated version to stderr — visible in your terminal.
 *
 * The original caveman output still streams live as Claude generates it.
 * The translated version appears below it as a "Translation:" block once
 * the full response is done.
 *
 * Smart no-op detection:
 *   Short responses with no caveman signals (abbreviations, fragments,
 *   arrows) are skipped — they're already readable prose and translation
 *   would be a no-op.  Threshold is configurable via C2E_SKIP_THRESHOLD
 *   (default: 15 words).  Set to 0 to always translate.
 *
 * Clarification suggestion:
 *   After translation, if the expanded text is still dense (many verbless
 *   sentences survived expansion, or the original was heavily abbreviated),
 *   a pre-drafted clarification request is printed to stderr.
 *   The user decides whether to send it — the hook never injects turns.
 *   Thresholds: C2E_CLARIFY_FRAGMENT_THRESHOLD (default: 3),
 *               C2E_CLARIFY_ABBREV_RATIO (default: 0.3).
 */

import { execSync } from "child_process";

// ── Caveman signal detection ──────────────────────────────────────────────────

// Built-in abbreviation keys (mirrored from src/rules/abbreviations.ts).
// Hook is self-contained — we don't import from the compiled package.
const ABBREV_KEYS = [
  "DB", "DBs", "env", "cfg", "fn", "fns", "arg", "args",
  "param", "params", "prop", "props", "ref", "refs", "repo", "repos",
  "dep", "deps", "pkg", "pkgs", "dir", "dirs", "msg", "msgs",
  "err", "errs", "req", "res", "ctx", "impl", "init", "perf",
  "auth", "authz", "creds", "comp", "comps",
  "w", "wo",
  "val", "vals", "obj", "objs", "arr", "arrs",
  "str", "strs", "num", "nums", "bool", "int",
];

// Build a regex matching any abbreviation as a whole word / token.
// Escape special chars (e.g. "w/"), then sort longest-first.
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const ABBREV_RE = new RegExp(
  `(?:^|\\s|[([{])(${ABBREV_KEYS.slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join("|")})(?=$|\\s|[)\\]},.:;!?])`,
  "gi",
);

// True if the sentence contains a finite verb or assignment.
// Mirrors hasVerb() from src/rules/fragments.ts.
const VERB_RE =
  /\b(is|are|was|were|has|have|had|do|does|did|will|would|can|could|should|must|need|return|throws?|calls?|sets?|gets?|runs?|fails?|passes?|takes?|makes?|uses?|adds?|removes?|creates?|updates?|deletes?|contains?|requires?|causes?|shows?|needs?|starts?|stops?|leads?|means?|results?)\b|[=:]/i;

function sentenceHasVerb(sentence) {
  if (VERB_RE.test(sentence)) return true;
  // -ed words are verbs only when they are NOT the first word
  // (sentence-initial -ed words are adjectives: "Malformed", "Cached", etc.)
  const edMatch = /\b\w+ed\b/.exec(sentence);
  return !!edMatch && edMatch.index > 0;
}

/**
 * Count verbless sentences in text.
 * Splits on terminal punctuation and checks each sentence for a verb.
 */
function countFragments(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let frags = 0;
  for (const s of sentences) {
    // Skip single-word sentences — not enough context to judge
    if (s.split(/\s+/).length < 2) continue;
    if (!sentenceHasVerb(s)) frags++;
  }
  return frags;
}

/** Count abbreviation hits in text. */
function countAbbreviations(text) {
  return (text.match(ABBREV_RE) ?? []).length;
}

/** True if text contains caveman-style arrows. */
function hasArrows(text) {
  return /→|->|=>/.test(text);
}

/**
 * True if text has GFM structural markers (headers, bullets, fences).
 * GFM structure is itself a caveman signal — always translate.
 */
function hasGfmStructure(text) {
  return /^#{1,6}\s|^[-*]\s|^```/m.test(text);
}

/**
 * Decide whether text needs c2e translation.
 *
 * Returns `{ translate: boolean, reason: string }`.
 *
 * Skip criteria (ALL must hold):
 *   1. word count ≤ threshold
 *   2. zero abbreviation hits
 *   3. zero verbless sentences
 *   4. no arrows
 *   5. no GFM structure
 *
 * If any signal is present, translate.
 */
function needsTranslation(text, threshold) {
  // GFM structure: always translate regardless of word count
  if (hasGfmStructure(text)) {
    return { translate: true, reason: "gfm structure" };
  }

  const words = text.trim().split(/\s+/).length;
  const abbrevCount = countAbbreviations(text);
  const fragCount = countFragments(text);
  const arrowPresent = hasArrows(text);

  const signals = [];
  if (abbrevCount > 0) signals.push(`${abbrevCount} abbreviation${abbrevCount !== 1 ? "s" : ""}`);
  if (arrowPresent) signals.push("arrow");
  if (fragCount > 0) signals.push(`${fragCount} fragment${fragCount !== 1 ? "s" : ""}`);

  // If word count exceeds threshold, always translate
  if (words > threshold) {
    const allSignals = signals.length > 0 ? signals.join(", ") : `${words} words`;
    return { translate: true, reason: allSignals };
  }

  if (signals.length === 0) {
    return { translate: false, reason: "no signals" };
  }

  return { translate: true, reason: signals.join(", ") };
}

// ── Clarification suggestion ──────────────────────────────────────────────────

/**
 * Decide whether the response is still too dense to parse after c2e expansion.
 *
 * Runs AFTER translation, so it reflects post-expansion complexity.
 * Uses two token-free structural signals:
 *
 *   1. Fragment density in the translated text: verbless sentences that survived
 *      expansion indicate the response resisted c2e's fragment completion.
 *   2. Abbreviation-per-word ratio in the original text: dense technical shorthand
 *      that wasn't in the dict and passed through unchanged.
 *
 * Thresholds are configurable via env vars:
 *   C2E_CLARIFY_FRAGMENT_THRESHOLD  (default: 3)
 *   C2E_CLARIFY_ABBREV_RATIO        (default: 0.3)
 *
 * Returns { clarify: boolean, reason: string }.
 */
function needsClarification(originalText, translatedText, opts = {}) {
  const { fragmentThreshold = 3, abbrevRatioThreshold = 0.3 } = opts;

  const signals = [];

  // Signal 1: verbless sentences that survived expansion
  const postFragments = countFragments(translatedText);
  if (postFragments >= fragmentThreshold) {
    signals.push(`${postFragments} fragment${postFragments !== 1 ? "s" : ""} survived expansion`);
  }

  // Signal 2: abbreviation density in the original (unknown shorthand passed through)
  const originalWords = originalText.trim().split(/\s+/).length;
  if (originalWords > 0) {
    const abbrevCount = countAbbreviations(originalText);
    const ratio = abbrevCount / originalWords;
    if (ratio >= abbrevRatioThreshold) {
      signals.push(`abbreviation ratio ${Math.round(ratio * 100)}%`);
    }
  }

  if (signals.length === 0) return { clarify: false, reason: "" };
  return { clarify: true, reason: signals.join(", ") };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const raw = [];
process.stdin.on("data", (chunk) => raw.push(chunk));
process.stdin.on("end", () => {
  let event;
  try {
    event = JSON.parse(Buffer.concat(raw).toString("utf8"));
  } catch {
    process.exit(0);
  }

  // Extract the last assistant message from the transcript.
  const transcript = event.transcript ?? [];
  const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) process.exit(0);

  const content =
    typeof lastAssistant.content === "string"
      ? lastAssistant.content
      : lastAssistant.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n") ?? "";

  if (!content.trim()) process.exit(0);

  // Smart no-op detection
  const skipThreshold = parseInt(process.env["C2E_SKIP_THRESHOLD"] ?? "15", 10);
  const { translate, reason } = needsTranslation(content, skipThreshold);

  if (!translate) {
    process.stderr.write(`[c2e] skipped (${reason})\n`);
    process.exit(0);
  }

  process.stderr.write(`[c2e] translating: ${reason}\n`);

  // Resolve c2e binary — prefer local install, fall back to global.
  const c2eBin = process.env["C2E_BIN"] ?? "c2e";

  // Extra c2e flags can be set via C2E_FLAGS env var, e.g.:
  //   C2E_FLAGS="--fragment-level 2 --no-ventilate"
  const extraFlags = process.env["C2E_FLAGS"] ?? "";

  try {
    const translated = execSync(`${c2eBin} ${extraFlags}`, {
      input: content,
      encoding: "utf8",
      timeout: 10_000,
    });

    const divider = "─".repeat(60);
    process.stderr.write(`\n${divider}\n📖 Translation:\n${divider}\n${translated}\n`);

    // Clarification suggestion — fires after translation, reflects post-expansion complexity
    const fragThreshold = parseInt(process.env["C2E_CLARIFY_FRAGMENT_THRESHOLD"] ?? "3", 10);
    const abbrevThreshold = parseFloat(process.env["C2E_CLARIFY_ABBREV_RATIO"] ?? "0.3");
    const { clarify, reason } = needsClarification(content, translated, {
      fragmentThreshold: fragThreshold,
      abbrevRatioThreshold: abbrevThreshold,
    });
    if (clarify) {
      process.stderr.write(
        `[c2e] Dense response (${reason}). Send to clarify:\n> Can you walk me through that in plain English?\n`,
      );
    }
  } catch (err) {
    process.stderr.write(`[c2e-stop-hook] Translation failed: ${String(err)}\n`);
  }

  process.exit(0);
});
