#!/usr/bin/env node
/**
 * RFC vs Caveman benchmark.
 *
 * Compares:
 *   - Caveman Full (synthetic) → c2e deterministic expansion
 *   - RFC (synthetic) → c2e deterministic expansion
 *
 * RFC hypothesis: keeping modals (should/must/might) and causal conjunctions
 * (because/since) in the encoded form improves modal recovery and ROUGE-1
 * at the cost of slightly worse compression.
 *
 * Usage:
 *   npm run benchmark:rfc
 */

import { CORPUS } from "../fidelity/corpus.js";
import { encodeCaveman } from "../fidelity/encoder.js";
import { rouge1, compressionRatio, modalRecovery } from "../fidelity/scorer.js";
import { extractModals } from "../fidelity/encoder.js";
import { encodeRFC } from "./encoder.js";
import { expandDeterministic } from "../../src/expand.js";

function runBenchmark() {
  const rows: string[] = [];
  const caveSummary = { rouge: 0, comp: 0, modal: 0 };
  const rfcSummary = { rouge: 0, comp: 0, modal: 0 };
  const n = CORPUS.length;

  for (const entry of CORPUS) {
    const caveEncoded = encodeCaveman(entry.original);
    const caveDecoded = expandDeterministic(caveEncoded, { fragmentLevel: 2 });

    const rfcEncoded = encodeRFC(entry.original);
    const rfcDecoded = expandDeterministic(rfcEncoded, { fragmentLevel: 2 });

    const caveR1 = rouge1(caveDecoded, entry.original);
    const rfcR1 = rouge1(rfcDecoded, entry.original);
    const caveComp = compressionRatio(entry.original, caveEncoded);
    const rfcComp = compressionRatio(entry.original, rfcEncoded);
    const caveMR = modalRecovery(caveDecoded, entry.original);
    const rfcMR = modalRecovery(rfcDecoded, entry.original);

    caveSummary.rouge += caveR1;
    caveSummary.comp += caveComp;
    caveSummary.modal += caveMR;
    rfcSummary.rouge += rfcR1;
    rfcSummary.comp += rfcComp;
    rfcSummary.modal += rfcMR;

    rows.push(
      `${entry.id.padEnd(22)} ` +
        `cave R1=${pct(caveR1)} comp=${pct(caveComp)} modal=${pct(caveMR)} | ` +
        `rfc  R1=${pct(rfcR1)} comp=${pct(rfcComp)} modal=${pct(rfcMR)}`,
    );
  }

  console.log("\n=== RFC vs CAVEMAN BENCHMARK ===\n");
  console.log("Both decoded with c2e expandDeterministic at fragmentLevel=2");
  console.log("R1=ROUGE-1  comp=compression  modal=modal-recovery\n");
  for (const row of rows) console.log(row);

  console.log("\n=== AVERAGES ===\n");
  console.log(
    `Caveman+c2e:  ROUGE-1=${pct(caveSummary.rouge / n)}  compression=${pct(caveSummary.comp / n)}  modal=${pct(caveSummary.modal / n)}`,
  );
  console.log(
    `RFC+c2e:      ROUGE-1=${pct(rfcSummary.rouge / n)}  compression=${pct(rfcSummary.comp / n)}  modal=${pct(rfcSummary.modal / n)}`,
  );

  console.log("\n=== SAMPLE ROUND-TRIPS ===\n");
  for (const entry of CORPUS.slice(0, 3)) {
    console.log(`── ${entry.id}`);
    console.log(`ORIGINAL:   ${entry.original.slice(0, 120)}…`);
    console.log(`RFC ENC:    ${encodeRFC(entry.original)}`);
    console.log(
      `RFC DEC:    ${expandDeterministic(encodeRFC(entry.original), { fragmentLevel: 2 }).replace(/\n/g, " | ")}`,
    );
    console.log(`CAVE ENC:   ${encodeCaveman(entry.original).slice(0, 120)}…`);
    console.log(
      `CAVE DEC:   ${expandDeterministic(encodeCaveman(entry.original), { fragmentLevel: 2 }).replace(/\n/g, " | ").slice(0, 120)}…`,
    );
    const origModals = extractModals(entry.original);
    if (origModals.length) {
      const rfcModals = extractModals(
        expandDeterministic(encodeRFC(entry.original), { fragmentLevel: 2 }),
      );
      const caveModals = extractModals(
        expandDeterministic(encodeCaveman(entry.original)),
      );
      console.log(
        `MODALS:     orig=${origModals.join(",")}  rfc=${rfcModals.join(",") || "none"}  cave=${caveModals.join(",") || "none"}`,
      );
    }
    console.log();
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

runBenchmark();
