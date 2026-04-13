#!/usr/bin/env node
/**
 * Esperanto vs Caveman vs RFC benchmark.
 *
 * Compares three encoding strategies on the 20-entry technical corpus:
 *   - Caveman Full (synthetic) → c2e deterministic expansion
 *   - RFC (synthetic)          → c2e deterministic expansion
 *   - Esperanto (synthetic)    → Esperanto decoder → c2e expansion
 *
 * Metrics:
 *   ROUGE-1         unigram overlap with original
 *   compression     character savings vs original
 *   modal recovery  fraction of uncertainty words (should/must/might/…) preserved
 *   causal recovery fraction of causal conjunctions (because/since/…) preserved
 *
 * The causal recovery metric is new here: it directly tests whether the
 * structured encoding of causal relationships (ĉar → because) survives the
 * round-trip, complementing modal recovery.
 *
 * Usage:
 *   npm run benchmark:esperanto
 */

import { CORPUS } from "../fidelity/corpus.js";
import { encodeCaveman } from "../fidelity/encoder.js";
import { rouge1, compressionRatio, modalRecovery } from "../fidelity/scorer.js";
import { extractModals } from "../fidelity/encoder.js";
import { expandDeterministic } from "../../src/expand.js";
import { encodeRFC } from "../rfc/encoder.js";
import { encodeEsperanto } from "./encoder.js";
import { decodeEsperanto } from "./decoder.js";

// ── Causal recovery metric ───────────────────────────────────────────────────

const CAUSAL_RE = /\b(because|since|therefore|thus|hence|so that)\b/gi;

function extractCausals(text: string): string[] {
  return Array.from(text.matchAll(CAUSAL_RE), (m) => m[0].toLowerCase());
}

/**
 * Fraction of causal conjunctions from the original that appear in the
 * decoded text.  Returns 1 when the original has none (vacuously true).
 */
function causalRecovery(decoded: string, original: string): number {
  const origCausals = extractCausals(original);
  if (origCausals.length === 0) return 1;
  const decodedCausals = new Set(extractCausals(decoded));
  const recovered = origCausals.filter((c) => decodedCausals.has(c)).length;
  return recovered / origCausals.length;
}

// ── Benchmark runner ─────────────────────────────────────────────────────────

function runBenchmark() {
  const rows: string[] = [];
  const caveSummary = { rouge: 0, comp: 0, modal: 0, causal: 0 };
  const rfcSummary = { rouge: 0, comp: 0, modal: 0, causal: 0 };
  const eoSummary = { rouge: 0, comp: 0, modal: 0, causal: 0 };
  const n = CORPUS.length;

  for (const entry of CORPUS) {
    const caveEncoded = encodeCaveman(entry.original);
    const caveDecoded = expandDeterministic(caveEncoded, { fragmentLevel: 2 });

    const rfcEncoded = encodeRFC(entry.original);
    const rfcDecoded = expandDeterministic(rfcEncoded, { fragmentLevel: 2 });

    const eoEncoded = encodeEsperanto(entry.original);
    const eoDecoded = decodeEsperanto(eoEncoded);

    const caveR1 = rouge1(caveDecoded, entry.original);
    const rfcR1 = rouge1(rfcDecoded, entry.original);
    const eoR1 = rouge1(eoDecoded, entry.original);

    const caveComp = compressionRatio(entry.original, caveEncoded);
    const rfcComp = compressionRatio(entry.original, rfcEncoded);
    const eoComp = compressionRatio(entry.original, eoEncoded);

    const caveMR = modalRecovery(caveDecoded, entry.original);
    const rfcMR = modalRecovery(rfcDecoded, entry.original);
    const eoMR = modalRecovery(eoDecoded, entry.original);

    const caveCR = causalRecovery(caveDecoded, entry.original);
    const rfcCR = causalRecovery(rfcDecoded, entry.original);
    const eoCR = causalRecovery(eoDecoded, entry.original);

    caveSummary.rouge += caveR1;
    caveSummary.comp += caveComp;
    caveSummary.modal += caveMR;
    caveSummary.causal += caveCR;
    rfcSummary.rouge += rfcR1;
    rfcSummary.comp += rfcComp;
    rfcSummary.modal += rfcMR;
    rfcSummary.causal += rfcCR;
    eoSummary.rouge += eoR1;
    eoSummary.comp += eoComp;
    eoSummary.modal += eoMR;
    eoSummary.causal += eoCR;

    rows.push(
      `${entry.id.padEnd(22)} ` +
        `cave R1=${pct(caveR1)} comp=${pct(caveComp)} modal=${pct(caveMR)} causal=${pct(caveCR)} | ` +
        `rfc  R1=${pct(rfcR1)} comp=${pct(rfcComp)} modal=${pct(rfcMR)} causal=${pct(rfcCR)} | ` +
        `eo   R1=${pct(eoR1)} comp=${pct(eoComp)} modal=${pct(eoMR)} causal=${pct(eoCR)}`,
    );
  }

  console.log("\n=== ESPERANTO vs RFC vs CAVEMAN BENCHMARK ===\n");
  console.log("cave=caveman+c2e  rfc=RFC+c2e  eo=Esperanto+decoder+c2e");
  console.log(
    "R1=ROUGE-1  comp=compression  modal=modal-recovery  causal=causal-recovery\n",
  );
  for (const row of rows) console.log(row);

  console.log("\n=== AVERAGES ===\n");
  console.log(
    `Caveman+c2e:  ROUGE-1=${pct(caveSummary.rouge / n)}  comp=${pct(caveSummary.comp / n)}  modal=${pct(caveSummary.modal / n)}  causal=${pct(caveSummary.causal / n)}`,
  );
  console.log(
    `RFC+c2e:      ROUGE-1=${pct(rfcSummary.rouge / n)}  comp=${pct(rfcSummary.comp / n)}  modal=${pct(rfcSummary.modal / n)}  causal=${pct(rfcSummary.causal / n)}`,
  );
  console.log(
    `Esperanto+c2e:ROUGE-1=${pct(eoSummary.rouge / n)}  comp=${pct(eoSummary.comp / n)}  modal=${pct(eoSummary.modal / n)}  causal=${pct(eoSummary.causal / n)}`,
  );

  console.log("\n=== SAMPLE ROUND-TRIPS ===\n");
  for (const entry of CORPUS.slice(0, 3)) {
    const eoEncoded = encodeEsperanto(entry.original);
    const eoDecoded = decodeEsperanto(eoEncoded);
    const caveEncoded = encodeCaveman(entry.original);
    const caveDecoded = expandDeterministic(caveEncoded, { fragmentLevel: 2 });

    console.log(`── ${entry.id}`);
    console.log(`ORIGINAL:  ${entry.original.slice(0, 120)}…`);
    console.log(`EO ENC:    ${eoEncoded.replace(/\n/g, " | ")}`);
    console.log(`EO DEC:    ${eoDecoded.replace(/\n/g, " | ")}`);
    console.log(`CAVE ENC:  ${caveEncoded.slice(0, 120)}…`);
    console.log(
      `CAVE DEC:  ${caveDecoded.replace(/\n/g, " | ").slice(0, 120)}…`,
    );

    const origModals = extractModals(entry.original);
    const origCausals = extractCausals(entry.original);
    if (origModals.length || origCausals.length) {
      const eoModals = extractModals(eoDecoded);
      const eoCausals = extractCausals(eoDecoded);
      const caveModals = extractModals(caveDecoded);
      const caveCausals = extractCausals(caveDecoded);
      if (origModals.length) {
        console.log(
          `MODALS:    orig=${origModals.join(",")}  eo=${eoModals.join(",") || "none"}  cave=${caveModals.join(",") || "none"}`,
        );
      }
      if (origCausals.length) {
        console.log(
          `CAUSALS:   orig=${origCausals.join(",")}  eo=${eoCausals.join(",") || "none"}  cave=${caveCausals.join(",") || "none"}`,
        );
      }
    }
    console.log();
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

runBenchmark();
