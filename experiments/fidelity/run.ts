#!/usr/bin/env node
/**
 * Fidelity benchmark runner.
 *
 * Usage:
 *   npx tsx experiments/fidelity/run.ts
 *   npx tsx experiments/fidelity/run.ts --json > results.json
 *
 * What it measures:
 *   For each corpus entry:
 *     1. Apply synthetic caveman encoding
 *     2. Run c2e deterministic expander at fragment levels 1, 2, 3
 *     3. Score each expansion against the original
 *   Outputs a table comparing ROUGE-1, word recovery, and modal recovery.
 *
 * Why modal recovery matters:
 *   Modality words (might, should, could) are the hardest semantic information
 *   to recover. A high compression + low modal recovery score means the expander
 *   is hallucinating certainty that wasn't in the original.
 */

import { CORPUS } from "./corpus.js";
import { encodeCaveman, extractModals, lostWords } from "./encoder.js";
import {
  scoreExpansion,
  averageScores,
  formatScore,
  type BenchmarkResult,
} from "./scorer.js";
import { expandDeterministic } from "../../src/expand.js";

const LEVELS = [
  { label: "level-1 (conservative)", fragmentLevel: 1 as const },
  { label: "level-2 (moderate)", fragmentLevel: 2 as const },
  { label: "level-3 (aggressive)", fragmentLevel: 3 as const },
] as const;

function runBenchmark(): BenchmarkResult[] {
  return CORPUS.map((entry) => {
    const encoded = encodeCaveman(entry.original);
    const expanded: Record<string, string> = {};
    const scores: Record<string, ReturnType<typeof scoreExpansion>> = {};

    for (const { label, fragmentLevel } of LEVELS) {
      const exp = expandDeterministic(encoded, { fragmentLevel });
      expanded[label] = exp;
      scores[label] = scoreExpansion(entry.original, encoded, exp);
    }

    return { id: entry.id, topic: entry.topic, original: entry.original, encoded, expanded, scores };
  });
}

function printTable(results: BenchmarkResult[]): void {
  console.log("\n=== FIDELITY BENCHMARK RESULTS ===\n");
  console.log(
    "Synthetic caveman encoder applied to 20-entry corpus, expanded at three fragment levels.\n",
  );

  // Per-entry summary
  for (const r of results) {
    console.log(`━━ ${r.id} — ${r.topic}`);
    console.log(`   ENCODED: ${r.encoded.slice(0, 120)}${r.encoded.length > 120 ? "…" : ""}`);
    const origModals = extractModals(r.original);
    const lost = lostWords(r.original, r.encoded);
    console.log(
      `   LOST WORDS (sample): ${lost.slice(0, 10).join(", ")}` +
        (origModals.length ? ` | MODALS IN ORIGINAL: ${origModals.join(", ")}` : ""),
    );
    for (const { label } of LEVELS) {
      const s = r.scores[label]!;
      console.log(`   [${label}] ${formatScore(s)}`);
    }
    console.log();
  }

  // Aggregate averages
  console.log("=== AGGREGATED AVERAGES ===\n");
  for (const { label } of LEVELS) {
    const avg = averageScores(results.map((r) => r.scores[label]!));
    console.log(`[${label}]`);
    console.log(`  ROUGE-1:         ${(avg.rouge1 * 100).toFixed(1)}%`);
    console.log(`  Word recovery:   ${(avg.wordRecovery * 100).toFixed(1)}%`);
    console.log(`  Modal recovery:  ${(avg.modalRecovery * 100).toFixed(1)}%`);
    console.log(`  Compression:     ${(avg.compressionRatio * 100).toFixed(1)}%`);
    console.log(
      `  Avg modals orig: ${avg.originalModalCount.toFixed(1)} | in expansion: ${avg.expandedModalCount.toFixed(1)}`,
    );
    console.log();
  }

  // Modal recovery analysis
  console.log("=== MODAL RECOVERY DETAIL ===");
  console.log(
    "Entries where original had modality words and level-1 failed to recover any:\n",
  );
  const failures = results.filter(
    (r) =>
      extractModals(r.original).length > 0 && r.scores["level-1 (conservative)"]!.modalRecovery === 0,
  );
  for (const f of failures) {
    const modals = extractModals(f.original);
    console.log(`  ${f.id}: original modals=${modals.join(",")} | none recovered`);
  }

  console.log("\n=== INTERPRETATION ===");
  const l1avg = averageScores(results.map((r) => r.scores["level-1 (conservative)"]!));
  const l3avg = averageScores(results.map((r) => r.scores["level-3 (aggressive)"]!));
  console.log(
    `Level 1 ROUGE-1 ${(l1avg.rouge1 * 100).toFixed(1)}% vs level 3 ${(l3avg.rouge1 * 100).toFixed(1)}%`,
  );
  if (l1avg.modalRecovery < 0.1) {
    console.log(
      `⚠ Modal recovery is critically low (${(l1avg.modalRecovery * 100).toFixed(1)}%). ` +
        `The expander is hallucinating certainty that was not in the original text.`,
    );
  }
  console.log(
    `Compression (synthetic encoder): ${(l1avg.compressionRatio * 100).toFixed(1)}% token reduction`,
  );
}

const results = runBenchmark();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(results, null, 2));
} else {
  printTable(results);
}
