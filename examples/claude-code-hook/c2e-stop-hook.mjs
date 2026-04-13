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
 */

import { execSync } from "child_process";

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
  } catch (err) {
    process.stderr.write(`[c2e-stop-hook] Translation failed: ${String(err)}\n`);
  }

  process.exit(0);
});
