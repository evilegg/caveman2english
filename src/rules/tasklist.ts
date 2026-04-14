import type { Rule } from "../types.js";

// ---------------------------------------------------------------------------
// Imperative sentence detection
// ---------------------------------------------------------------------------
//
// A sentence is imperative if its first token is a base-form verb.
// We extend the list from fragments.ts with common verbs that appear in
// technical action sequences but would never lead a fragment.

const IMPERATIVE_VERBS =
  /^(wrap|use|add|remove|fix|check|run|set|get|call|pass|return|import|export|install|update|delete|create|move|rename|merge|split|refactor|test|debug|log|validate|handle|throw|catch|ignore|skip|avoid|prefer|ensure|keep|make|build|deploy|push|pull|fetch|send|read|write|parse|format|convert|restart|rerun|retry|verify|enable|disable|inject|extract|configure|register|mount|unmount|require|replace|reset|clear|flush|drain|close|open|start|stop|trigger|emit|listen|subscribe|unsubscribe|initialise|initialize|define|declare|mark|tag|annotate|migrate|rollback|revert|pin|upgrade|downgrade|bump|patch|apply|execute|invoke|load|reload|unload|cache|invalidate|expose|hide|lock|unlock)\b/i;

function isImperative(sentence: string): boolean {
  // Strip leading GFM task prefix if present (e.g. "- [ ] Wrap …").
  const stripped = sentence.replace(/^-\s*\[.\]\s*/, "").trim();
  if (!IMPERATIVE_VERBS.test(stripped)) return false;
  // Reject sentences that contain a copula or auxiliary after the first word.
  // These are predicates ("Cache is stale", "Set has no duplicates"), not commands.
  const rest = stripped.replace(/^\S+\s*/, "");
  if (/\b(is|are|was|were|has|have|had|does|do|did)\b/i.test(rest)) return false;
  return true;
}

// An existing GFM list item starts with "- " or "* " or "N. ".
// We do not re-wrap items that are already in a list.
function isListItem(line: string): boolean {
  return /^(\s*[-*+]\s|\s*\d+\.\s)/.test(line);
}

// ---------------------------------------------------------------------------
// Task-list conversion
// ---------------------------------------------------------------------------
//
// Input is a block of sentences (already ventilated: one per line, separated
// by blank lines).  We scan runs of consecutive imperative sentences.
// A run of ≥ minRun consecutive imperatives → GFM task list.
//
// Non-imperative sentences are emitted as-is.
// The task list is separated from surrounding prose by blank lines.

interface TasklistOpts {
  minRun: number;
}

// Split text into lines, process runs, rejoin.
function applyTasklist(text: string, opts: TasklistOpts): string {
  const { minRun } = opts;

  // Work line-by-line.  Blank lines separate paragraphs; we preserve them.
  const lines = text.split("\n");

  type ProcessedLine =
    | { kind: "blank" }
    | { kind: "list-item"; text: string }
    | { kind: "imperative"; text: string }
    | { kind: "prose"; text: string };

  const classified: ProcessedLine[] = lines.map((line) => {
    if (line.trim() === "") return { kind: "blank" };
    if (isListItem(line)) return { kind: "list-item", text: line };
    if (isImperative(line)) return { kind: "imperative", text: line };
    return { kind: "prose", text: line };
  });

  const output: string[] = [];
  let i = 0;

  while (i < classified.length) {
    const item = classified[i]!;

    if (item.kind === "blank" || item.kind === "prose" || item.kind === "list-item") {
      output.push(item.kind === "blank" ? "" : item.text);
      i++;
      continue;
    }

    // item.kind === "imperative": collect the full run.
    const runStart = i;
    while (i < classified.length && classified[i]!.kind === "imperative") {
      i++;
    }
    const run = classified.slice(runStart, i) as { kind: "imperative"; text: string }[];

    if (run.length >= minRun) {
      // Emit as GFM task list.
      // Add blank line before the list if the previous output line was non-blank prose.
      const lastOut = output[output.length - 1];
      if (lastOut !== undefined && lastOut.trim() !== "") {
        output.push("");
      }
      for (const r of run) {
        // Strip trailing period from the task item text — standard for checkboxes.
        const taskText = r.text.replace(/\.$/, "");
        output.push(`- [ ] ${taskText}`);
      }
      // Add blank line after the list if the next token is non-blank.
      const next = classified[i];
      if (next !== undefined && next.kind !== "blank") {
        output.push("");
      }
    } else {
      // Single imperative (or run below threshold) → emit as prose.
      for (const r of run) {
        output.push(r.text);
      }
    }
  }

  return output.join("\n");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface TasklistOptions {
  /** Minimum consecutive imperative sentences to trigger list conversion (default: 2). */
  minRun?: number;
}

export function createTasklistRule(opts?: TasklistOptions): Rule {
  const minRun = opts?.minRun ?? 2;
  return {
    name: "tasklist",
    apply(text: string): string {
      return applyTasklist(text, { minRun });
    },
  };
}

export const tasklistRule: Rule = createTasklistRule();
