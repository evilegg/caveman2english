#!/usr/bin/env node
/**
 * UST vs Caveman benchmark.
 *
 * Compares:
 *   - Caveman Full (synthetic) → c2e deterministic expansion
 *   - UST (synthetic) → UST deterministic decoder
 *
 * On every corpus entry, measures:
 *   - Token count of encoded form (compression)
 *   - ROUGE-1 of decoded form vs original (fidelity)
 *   - Modal recovery (uncertainty preservation)
 *   - Role recovery (did the decoder emit the right sentence type?)
 *
 * Usage:
 *   npx tsx experiments/ust/benchmark.ts
 */

import { CORPUS } from "../fidelity/corpus.js";
import { encodeCaveman } from "../fidelity/encoder.js";
import {
  rouge1,
  compressionRatio,
  modalRecovery,
  extractModals,
  tokenize,
} from "./scoring.js";
import { encodeUST } from "./encoder.js";
import { decodeUST } from "./decoder.js";
import { expandDeterministic } from "../../src/expand.js";
import { ALL_MARKERS } from "./vocabulary.js";

const ROLE_SYMBOLS = new Set(
  ALL_MARKERS.filter((m) => m.sentencePrefix).map((m) => m.symbol),
);

function countRoleMarkers(text: string): number {
  let count = 0;
  for (const sym of ROLE_SYMBOLS) {
    if (text.includes(sym)) count++;
  }
  return count;
}

function runBenchmark() {
  const rows: string[] = [];
  const caveSummary = { rouge: 0, comp: 0, modal: 0 };
  const ustSummary = { rouge: 0, comp: 0, modal: 0 };
  const n = CORPUS.length;

  for (const entry of CORPUS) {
    const caveEncoded = encodeCaveman(entry.original);
    const caveDecoded = expandDeterministic(caveEncoded, { fragmentLevel: 2 });

    const ustEncoded = encodeUST(entry.original);
    const ustDecoded = decodeUST(ustEncoded);

    const caveR1 = rouge1(caveDecoded, entry.original);
    const ustR1 = rouge1(ustDecoded, entry.original);
    const caveComp = compressionRatio(entry.original, caveEncoded);
    const ustComp = compressionRatio(entry.original, ustEncoded);
    const caveMR = modalRecovery(caveDecoded, entry.original);
    const ustMR = modalRecovery(ustDecoded, entry.original);
    const roles = countRoleMarkers(ustEncoded);

    caveSummary.rouge += caveR1;
    caveSummary.comp += caveComp;
    caveSummary.modal += caveMR;
    ustSummary.rouge += ustR1;
    ustSummary.comp += ustComp;
    ustSummary.modal += ustMR;

    rows.push(
      `${entry.id.padEnd(22)} ` +
        `cave R1=${pct(caveR1)} comp=${pct(caveComp)} modal=${pct(caveMR)} | ` +
        `ust  R1=${pct(ustR1)} comp=${pct(ustComp)} modal=${pct(ustMR)} roles=${roles}`,
    );
  }

  console.log("\n=== UST vs CAVEMAN BENCHMARK ===\n");
  console.log("Format: cave=caveman+c2e expansion   ust=UST+decoder");
  console.log("R1=ROUGE-1  comp=compression  modal=modal-recovery  roles=role markers used\n");
  for (const row of rows) console.log(row);

  console.log("\n=== AVERAGES ===\n");
  console.log(
    `Caveman+c2e:  ROUGE-1=${pct(caveSummary.rouge / n)}  compression=${pct(caveSummary.comp / n)}  modal=${pct(caveSummary.modal / n)}`,
  );
  console.log(
    `UST+decoder:  ROUGE-1=${pct(ustSummary.rouge / n)}  compression=${pct(ustSummary.comp / n)}  modal=${pct(ustSummary.modal / n)}`,
  );

  console.log("\n=== SAMPLE ROUND-TRIPS ===\n");
  for (const entry of CORPUS.slice(0, 3)) {
    console.log(`── ${entry.id}`);
    console.log(`ORIGINAL:   ${entry.original.slice(0, 120)}…`);
    console.log(`UST ENC:    ${encodeUST(entry.original)}`);
    console.log(`UST DEC:    ${decodeUST(encodeUST(entry.original)).replace(/\n/g, " | ")}`);
    console.log(`CAVE ENC:   ${encodeCaveman(entry.original).slice(0, 120)}…`);
    console.log(`CAVE DEC:   ${expandDeterministic(encodeCaveman(entry.original), { fragmentLevel: 2 }).replace(/\n/g, " | ").slice(0, 120)}…`);
    const origModals = extractModals(entry.original);
    if (origModals.length) {
      const ustModals = extractModals(decodeUST(encodeUST(entry.original)));
      const caveModals = extractModals(expandDeterministic(encodeCaveman(entry.original)));
      console.log(
        `MODALS:     orig=${origModals.join(",")}  ust=${ustModals.join(",") || "none"}  cave=${caveModals.join(",") || "none"}`,
      );
    }
    console.log();
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

runBenchmark();
