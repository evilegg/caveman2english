#!/usr/bin/env node
/**
 * Gilfoyle vs Caveman vs RFC vs Esperanto benchmark.
 *
 * Compares four encoding strategies on the 20-entry technical corpus:
 *   - Caveman Full (synthetic) → c2e deterministic expansion
 *   - RFC (synthetic)          → c2e deterministic expansion
 *   - Esperanto (synthetic)    → Esperanto decoder → c2e expansion
 *   - Gilfoyle (synthetic)     → direct read (no decoder needed)
 *
 * Metrics:
 *   ROUGE-1              unigram overlap with original
 *   compression          character savings vs original
 *   modal recovery       fraction of uncertainty words preserved
 *   causal recovery      fraction of causal conjunctions preserved
 *   reconstruction-req   fraction of sentences where a binding was broken
 *                        and the reader must infer the missing half
 *
 * The reconstruction-required metric is new here. It measures the fraction of
 * output sentences that contain a detectable broken binding: a modal verb
 * stripped from its action, a causal conjunction stripped from its clause, or
 * a negation stripped from its target. Gilfoyle should score 0% on this metric
 * (no broken bindings); caveman should score highest.
 *
 * Usage:
 *   npm run benchmark:gilfoyle
 */

import { CORPUS } from "../fidelity/corpus.js";
import { encodeCaveman, extractModals } from "../fidelity/encoder.js";
import { rouge1, compressionRatio, modalRecovery } from "../fidelity/scorer.js";
import { expandDeterministic } from "../../src/expand.js";
import { encodeRFC } from "../rfc/encoder.js";
import { encodeEsperanto } from "../esperanto/encoder.js";
import { decodeEsperanto } from "../esperanto/decoder.js";
import { encodeGilfoyle } from "./encoder.js";

// ── Causal recovery ───────────────────────────────────────────────────────────

const CAUSAL_RE = /\b(because|since|therefore|thus|hence|so that)\b/gi;

function extractCausals(text: string): string[] {
  return Array.from(text.matchAll(CAUSAL_RE), (m) => m[0].toLowerCase());
}

function causalRecovery(decoded: string, original: string): number {
  const origCausals = extractCausals(original);
  if (origCausals.length === 0) return 1;
  const decodedCausals = new Set(extractCausals(decoded));
  return origCausals.filter((c) => decodedCausals.has(c)).length / origCausals.length;
}

// ── Reconstruction-required metric ───────────────────────────────────────────

/**
 * A "broken binding" is a sentence in the encoded output where a semantic
 * ligature was stripped, forcing the reader to mentally reconstruct it.
 *
 * Detection heuristics:
 * 1. Modal without its action: a modal verb (should/must/might/cannot) appears
 *    but is followed immediately by end-of-sentence (the action was stripped).
 *    e.g. "should" at end of sentence without a following verb phrase.
 *
 * 2. Causal conjunction without its cause clause: "because" or "since" appears
 *    at the start or end of a sentence with no following clause.
 *    e.g. sentence ending in "because" or beginning with "because" and nothing after.
 *
 * 3. Negation scope broken: "not", "never", "without", "no" appears at the end
 *    of a sentence with no following target.
 *    e.g. "without releasing" is fine; "without" alone at end is broken.
 *
 * Returns fraction of sentences with a broken binding.
 */
function reconstructionRequired(encoded: string): number {
  const sentences = encoded
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^-\s*\[.\]\s*/, "").trim()) // strip GFM task prefix
    .filter(Boolean);

  if (sentences.length === 0) return 0;

  let broken = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    const last = words[words.length - 1]?.toLowerCase().replace(/[.,;:!?]$/, "") ?? "";
    const first = words[0]?.toLowerCase() ?? "";

    // Modal at end of sentence (action stripped)
    if (/^(should|must|might|cannot|could|would|will)$/.test(last)) {
      broken++;
      continue;
    }

    // "because" or "since" at start with nothing after (clause stripped)
    if (
      (first === "because" || first === "since") &&
      words.length <= 2
    ) {
      broken++;
      continue;
    }

    // Bare negation at end (target stripped)
    if (/^(not|never|without|no)$/.test(last)) {
      broken++;
      continue;
    }

    // "because" appears mid-sentence but is the last word
    // e.g. "pool exhausted because" — clause was stripped
    if (last === "because" || last === "since") {
      broken++;
      continue;
    }
  }

  return broken / sentences.length;
}

// ── Benchmark runner ──────────────────────────────────────────────────────────

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function runBenchmark() {
  const sums = {
    cave: { rouge: 0, comp: 0, modal: 0, causal: 0, recon: 0 },
    rfc: { rouge: 0, comp: 0, modal: 0, causal: 0, recon: 0 },
    eo: { rouge: 0, comp: 0, modal: 0, causal: 0, recon: 0 },
    gf: { rouge: 0, comp: 0, modal: 0, causal: 0, recon: 0 },
  };
  const n = CORPUS.length;
  const rows: string[] = [];

  for (const entry of CORPUS) {
    // Encode
    const caveEncoded = encodeCaveman(entry.original);
    const rfcEncoded = encodeRFC(entry.original);
    const eoEncoded = encodeEsperanto(entry.original);
    const gfEncoded = encodeGilfoyle(entry.original);

    // Decode — Gilfoyle needs no decoder (direct read)
    const caveDecoded = expandDeterministic(caveEncoded, { fragmentLevel: 2 });
    const rfcDecoded = expandDeterministic(rfcEncoded, { fragmentLevel: 2 });
    const eoDecoded = decodeEsperanto(eoEncoded);
    const gfDecoded = gfEncoded; // Gilfoyle is directly readable

    // Score
    const caveR1 = rouge1(caveDecoded, entry.original);
    const rfcR1 = rouge1(rfcDecoded, entry.original);
    const eoR1 = rouge1(eoDecoded, entry.original);
    const gfR1 = rouge1(gfDecoded, entry.original);

    const caveComp = compressionRatio(entry.original, caveEncoded);
    const rfcComp = compressionRatio(entry.original, rfcEncoded);
    const eoComp = compressionRatio(entry.original, eoEncoded);
    const gfComp = compressionRatio(entry.original, gfEncoded);

    const caveMR = modalRecovery(caveDecoded, entry.original);
    const rfcMR = modalRecovery(rfcDecoded, entry.original);
    const eoMR = modalRecovery(eoDecoded, entry.original);
    const gfMR = modalRecovery(gfDecoded, entry.original);

    const caveCR = causalRecovery(caveDecoded, entry.original);
    const rfcCR = causalRecovery(rfcDecoded, entry.original);
    const eoCR = causalRecovery(eoDecoded, entry.original);
    const gfCR = causalRecovery(gfDecoded, entry.original);

    const caveRecon = reconstructionRequired(caveEncoded);
    const rfcRecon = reconstructionRequired(rfcEncoded);
    const eoRecon = reconstructionRequired(eoEncoded);
    const gfRecon = reconstructionRequired(gfEncoded);

    sums.cave.rouge += caveR1;
    sums.cave.comp += caveComp;
    sums.cave.modal += caveMR;
    sums.cave.causal += caveCR;
    sums.cave.recon += caveRecon;

    sums.rfc.rouge += rfcR1;
    sums.rfc.comp += rfcComp;
    sums.rfc.modal += rfcMR;
    sums.rfc.causal += rfcCR;
    sums.rfc.recon += rfcRecon;

    sums.eo.rouge += eoR1;
    sums.eo.comp += eoComp;
    sums.eo.modal += eoMR;
    sums.eo.causal += eoCR;
    sums.eo.recon += eoRecon;

    sums.gf.rouge += gfR1;
    sums.gf.comp += gfComp;
    sums.gf.modal += gfMR;
    sums.gf.causal += gfCR;
    sums.gf.recon += gfRecon;

    rows.push(
      `${entry.id.padEnd(22)} ` +
        `cave R1=${pct(caveR1)} comp=${pct(caveComp)} modal=${pct(caveMR)} causal=${pct(caveCR)} recon=${pct(caveRecon)} | ` +
        `rfc  R1=${pct(rfcR1)} comp=${pct(rfcComp)} modal=${pct(rfcMR)} causal=${pct(rfcCR)} recon=${pct(rfcRecon)} | ` +
        `eo   R1=${pct(eoR1)} comp=${pct(eoComp)} modal=${pct(eoMR)} causal=${pct(eoCR)} recon=${pct(eoRecon)} | ` +
        `gf   R1=${pct(gfR1)} comp=${pct(gfComp)} modal=${pct(gfMR)} causal=${pct(gfCR)} recon=${pct(gfRecon)}`,
    );
  }

  const avg = (s: typeof sums.cave) => ({
    rouge: s.rouge / n,
    comp: s.comp / n,
    modal: s.modal / n,
    causal: s.causal / n,
    recon: s.recon / n,
  });

  const caveAvg = avg(sums.cave);
  const rfcAvg = avg(sums.rfc);
  const eoAvg = avg(sums.eo);
  const gfAvg = avg(sums.gf);

  console.log("\n=== GILFOYLE vs ESPERANTO vs RFC vs CAVEMAN BENCHMARK ===\n");
  console.log(
    "cave=caveman+c2e  rfc=RFC+c2e  eo=Esperanto+decoder+c2e  gf=Gilfoyle (direct read)",
  );
  console.log(
    "R1=ROUGE-1  comp=compression  modal=modal-recovery  causal=causal-recovery  recon=reconstruction-required\n",
  );

  for (const row of rows) console.log(row);

  console.log("\n=== AVERAGES ===\n");
  console.log(
    `Caveman+c2e:   ROUGE-1=${pct(caveAvg.rouge)}  comp=${pct(caveAvg.comp)}  modal=${pct(caveAvg.modal)}  causal=${pct(caveAvg.causal)}  recon=${pct(caveAvg.recon)}`,
  );
  console.log(
    `RFC+c2e:       ROUGE-1=${pct(rfcAvg.rouge)}  comp=${pct(rfcAvg.comp)}  modal=${pct(rfcAvg.modal)}  causal=${pct(rfcAvg.causal)}  recon=${pct(rfcAvg.recon)}`,
  );
  console.log(
    `Esperanto+c2e: ROUGE-1=${pct(eoAvg.rouge)}  comp=${pct(eoAvg.comp)}  modal=${pct(eoAvg.modal)}  causal=${pct(eoAvg.causal)}  recon=${pct(eoAvg.recon)}`,
  );
  console.log(
    `Gilfoyle:      ROUGE-1=${pct(gfAvg.rouge)}  comp=${pct(gfAvg.comp)}  modal=${pct(gfAvg.modal)}  causal=${pct(gfAvg.causal)}  recon=${pct(gfAvg.recon)}`,
  );

  console.log("\n=== SAMPLE ROUND-TRIPS ===\n");
  for (const entry of CORPUS.slice(0, 3)) {
    const gfEncoded = encodeGilfoyle(entry.original);
    const caveEncoded = encodeCaveman(entry.original);
    const caveDecoded = expandDeterministic(caveEncoded, { fragmentLevel: 2 });

    console.log(`── ${entry.id}`);
    console.log(`ORIGINAL:  ${entry.original.slice(0, 130)}`);
    console.log(`GF:        ${gfEncoded.replace(/\n/g, " | ")}`);
    console.log(`CAVE ENC:  ${caveEncoded.replace(/\n/g, " | ").slice(0, 130)}`);
    console.log(`CAVE DEC:  ${caveDecoded.replace(/\n/g, " | ").slice(0, 130)}`);

    const origModals = extractModals(entry.original);
    const origCausals = extractCausals(entry.original);
    if (origModals.length || origCausals.length) {
      const gfModals = extractModals(gfEncoded);
      const gfCausals = extractCausals(gfEncoded);
      const caveModals = extractModals(caveDecoded);
      const caveCausals = extractCausals(caveDecoded);
      if (origModals.length) {
        console.log(
          `MODALS:    orig=${origModals.join(",")}  gf=${gfModals.join(",") || "none"}  cave=${caveModals.join(",") || "none"}`,
        );
      }
      if (origCausals.length) {
        console.log(
          `CAUSALS:   orig=${origCausals.join(",")}  gf=${gfCausals.join(",") || "none"}  cave=${caveCausals.join(",") || "none"}`,
        );
      }
    }
    console.log();
  }

  console.log("=== RECONSTRUCTION-REQUIRED NOTE ===\n");
  console.log(
    "recon measures the fraction of encoded sentences where a semantic binding was",
  );
  console.log(
    "detectably broken (modal at sentence-end, bare 'because', negation without target).",
  );
  console.log(
    "Gilfoyle should score 0% because it preserves all bindings.",
  );
  console.log(
    "Caveman strips modal+action and causal+clause, so its recon score is the baseline cost.\n",
  );

  // ROUGE-1 caveat
  console.log("=== ROUGE-1 CAVEAT ===\n");
  console.log(
    "Gilfoyle restructures prose to GFM lists and imperatives.",
  );
  console.log(
    "ROUGE-1 penalises restructuring: 'You should wrap' → 'Wrap' drops 'you' and 'should'",
  );
  console.log(
    "from the unigram set even though no information was lost.",
  );
  console.log(
    "A lower ROUGE-1 for Gilfoyle vs RFC is expected and does not indicate information loss.\n",
  );
}

runBenchmark();
