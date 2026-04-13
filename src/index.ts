#!/usr/bin/env node
import { Command } from "commander";
import { createInterface } from "readline";
import { expandDeterministic, wordCount } from "./expand.js";
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
    (process.env["C2E_BACKEND"] as BackendName | undefined) ?? "none",
  )
  .option(
    "-m, --model <name>",
    "Model name for the LLM backend",
    process.env["C2E_MODEL"],
  )
  .option(
    "-u, --url <url>",
    "Ollama base URL",
    process.env["OLLAMA_URL"] ?? "http://localhost:11434",
  )
  .option(
    "-e, --expand",
    "Enable LLM expansion for responses exceeding --expand-threshold",
    false,
  )
  .option(
    "-t, --expand-threshold <n>",
    "Word count threshold for triggering LLM expansion",
    String(process.env["C2E_EXPAND_THRESHOLD"] ?? "300"),
  )
  .option(
    "-f, --fragment-level <n>",
    "Fragment completion level: 0=off 1=conservative 2=moderate 3=aggressive",
    String(process.env["C2E_FRAGMENT_LEVEL"] ?? "1"),
  )
  .parse(process.argv);

const opts = program.opts<{
  backend: BackendName;
  model?: string;
  url: string;
  expand: boolean;
  expandThreshold: string;
  fragmentLevel: string;
}>();

const options: ExpandOptions = {
  backend: opts.backend as BackendName,
  model: opts.model,
  ollamaUrl: opts.url,
  expand: opts.expand,
  expandThreshold: parseInt(opts.expandThreshold, 10),
  fragmentLevel: (parseInt(opts.fragmentLevel, 10) as FragmentLevel) ?? 1,
};

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
  // Always apply deterministic rules first.
  let output = expandDeterministic(input, options);

  // Optionally apply LLM expansion if response is long enough.
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

async function main(): Promise<void> {
  const backend = await buildBackend(options);

  // If stdin is a TTY (interactive), read a single line for testing.
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

  // Streaming pipe mode: buffer full input then process.
  // (Streaming token-by-token would break multi-sentence rules like conjunctions.)
  const chunks: Buffer[] = [];
  process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
  process.stdin.on("end", async () => {
    const input = Buffer.concat(chunks).toString("utf8");
    const result = await processInput(input, backend);
    process.stdout.write(result);
    // Preserve trailing newline from original.
    if (input.endsWith("\n") && !result.endsWith("\n")) {
      process.stdout.write("\n");
    }
  });
}

main().catch((err) => {
  process.stderr.write(`[caveman2english] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
