#!/usr/bin/env node
import { Command } from "commander";
import { createInterface } from "readline";
import { watchFile, readFileSync } from "fs";
import { expandDeterministic, wordCount } from "./expand.js";
import { loadUserConfig, mergeConfig } from "./config.js";
import type { LlmBackend } from "./backends/base.js";
import type { BackendName, ExpandOptions, FragmentLevel } from "./types.js";

const program = new Command();

program
  .name("caveman2english")
  .alias("c2e")
  .description("Expand LLM caveman output into readable English prose")
  .version("0.1.0")
  .option(
    "-b, --backend <name>",
    "LLM backend for expansion: none | ollama | claude",
    process.env["C2E_BACKEND"] as BackendName | undefined,
  )
  .option("-m, --model <name>", "Model name for the LLM backend", process.env["C2E_MODEL"])
  .option("-u, --url <url>", "Ollama base URL", process.env["OLLAMA_URL"])
  .option("-e, --expand", "Enable LLM expansion for long responses", false)
  .option(
    "-t, --expand-threshold <n>",
    "Word count threshold for LLM expansion",
    process.env["C2E_EXPAND_THRESHOLD"],
  )
  .option(
    "-f, --fragment-level <n>",
    "Fragment completion level: 0=off 1=conservative 2=moderate 3=aggressive",
    process.env["C2E_FRAGMENT_LEVEL"],
  )
  // Rule-disable flags — each disables a named rule in the pipeline.
  .option("--no-arrows", "Disable arrow notation expansion (→ / ->)")
  .option("--no-abbreviations", "Disable abbreviation expansion")
  .option("--no-fragments", "Disable fragment sentence completion (equiv. --fragment-level 0)")
  .option("--no-conjunctions", "Disable conjunction restoration")
  .option("--no-articles", "Disable article insertion heuristic")
  .option("--no-ventilate", "Disable ventilated-prose line splitting")
  .option("--no-tasklist", "Disable GFM task list conversion for imperative sequences")
  .option(
    "--tasklist-min-run <n>",
    "Minimum consecutive imperatives before converting to task list (default: 2)",
    process.env["C2E_TASKLIST_MIN_RUN"],
  )
  // Watch mode.
  .option("-w, --watch <file>", "Watch a file and translate new content as it is appended")
  .parse(process.argv);

const opts = program.opts<{
  backend?: BackendName;
  model?: string;
  url?: string;
  expand: boolean;
  expandThreshold?: string;
  fragmentLevel?: string;
  arrows: boolean;
  abbreviations: boolean;
  fragments: boolean;
  conjunctions: boolean;
  articles: boolean;
  ventilate: boolean;
  tasklist: boolean;
  tasklistMinRun?: string;
  watch?: string;
}>();

// Build the disabled-rules set from --no-* flags.
const disabledRules = new Set<string>();
if (!opts.arrows) disabledRules.add("arrows");
if (!opts.abbreviations) disabledRules.add("abbreviations");
if (!opts.fragments) disabledRules.add("fragments(conservative)"); // name varies by level
if (!opts.conjunctions) disabledRules.add("conjunctions");
if (!opts.articles) disabledRules.add("articles");
if (!opts.ventilate) disabledRules.add("ventilate");
if (!opts.tasklist) disabledRules.add("tasklist");

// Resolve fragment level — --no-fragments forces 0.
const rawFragmentLevel = opts.fragments === false ? 0 : parseInt(opts.fragmentLevel ?? "1", 10);

// Build a Partial so mergeConfig can distinguish "not set" from "set to default".
const cliOpts: Partial<ExpandOptions> = {
  backend: opts.backend,
  model: opts.model,
  ollamaUrl: opts.url,
  expand: opts.expand || undefined, // false = not provided
  expandThreshold: opts.expandThreshold ? parseInt(opts.expandThreshold, 10) : undefined,
  fragmentLevel: opts.fragments === false
    ? 0
    : opts.fragmentLevel
    ? (parseInt(opts.fragmentLevel, 10) as FragmentLevel)
    : undefined,
  disableRules: disabledRules.size ? disabledRules : undefined,
  extraAbbreviations: {},
  tasklistMinRun: opts.tasklistMinRun ? parseInt(opts.tasklistMinRun, 10) : undefined,
};

const options = mergeConfig(cliOpts, loadUserConfig());

// Patch the disabled set for the final (potentially merged) fragment level,
// since the rule name includes the level string.
const fragRuleName = `fragments(${
  ["off", "conservative", "moderate", "aggressive"][options.fragmentLevel] ?? "conservative"
})`;
if (!opts.fragments) {
  options.disableRules.add(fragRuleName);
}

async function buildBackend(opts: ExpandOptions): Promise<LlmBackend | null> {
  if (!opts.expand || opts.backend === "none") return null;

  if (opts.backend === "ollama") {
    const { OllamaBackend } = await import("./backends/ollama.js");
    return new OllamaBackend(opts.ollamaUrl, opts.model);
  }

  if (opts.backend === "claude") {
    const apiKey = process.env["ANTHROPIC_API_KEY"] ?? "";
    const { ClaudeBackend } = await import("./backends/claude.js");
    return new ClaudeBackend(apiKey, opts.model);
  }

  throw new Error(`Unknown backend: ${opts.backend}`);
}

async function processInput(input: string, backend: LlmBackend | null): Promise<string> {
  let output = expandDeterministic(input, options);

  if (backend && wordCount(input) >= options.expandThreshold) {
    try {
      output = await backend.expand(output);
    } catch (err) {
      process.stderr.write(
        `[caveman2english] LLM expansion failed, using deterministic output: ${String(err)}\n`,
      );
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------

function watchFileMode(filePath: string, backend: LlmBackend | null): void {
  let lastSize = 0;

  try {
    const initial = readFileSync(filePath);
    lastSize = initial.length;
  } catch {
    // File doesn't exist yet — start from 0.
  }

  process.stderr.write(`[caveman2english] Watching ${filePath} for new content…\n`);

  watchFile(filePath, { interval: 200 }, async (curr) => {
    if (curr.size <= lastSize) return; // truncation or no change

    const buf = Buffer.alloc(curr.size - lastSize);
    const { openSync, readSync, closeSync } = await import("fs");
    const fd = openSync(filePath, "r");
    readSync(fd, buf, 0, buf.length, lastSize);
    closeSync(fd);
    lastSize = curr.size;

    const newContent = buf.toString("utf8");
    const result = await processInput(newContent, backend);
    process.stdout.write(result);
    if (!result.endsWith("\n")) process.stdout.write("\n");
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const backend = await buildBackend(options);

  // Watch mode — monitor a file instead of reading stdin.
  if (opts.watch) {
    watchFileMode(opts.watch, backend);
    return; // keep process alive; watchFile holds the event loop
  }

  // Interactive TTY — read lines until EOF.
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    const lines: string[] = [];
    rl.on("line", (line) => lines.push(line));
    rl.on("close", async () => {
      const result = await processInput(lines.join("\n"), backend);
      process.stdout.write(result + "\n");
    });
    return;
  }

  // Pipe mode — buffer full input then process.
  const chunks: Buffer[] = [];
  process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
  process.stdin.on("end", async () => {
    const input = Buffer.concat(chunks).toString("utf8");
    const result = await processInput(input, backend);
    process.stdout.write(result);
    if (input.endsWith("\n") && !result.endsWith("\n")) {
      process.stdout.write("\n");
    }
  });
}

main().catch((err) => {
  process.stderr.write(`[caveman2english] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
