# Experiments

This directory contains five encoding experiments that test alternative compression schemes for LLM output.
Each experiment has a synthetic encoder, a benchmark script, and captured results.

## Running the benchmarks

From the repo root:

```bash
npm run benchmark:fidelity    # caveman baseline + c2e expansion
npm run benchmark:ust         # UST emoji-marker encoding
npm run benchmark:rfc         # RFC — modals and conjunctions preserved
npm run benchmark:esperanto   # Esperanto dialect
npm run benchmark:gilfoyle    # Gilfoyle — direct read, no decoder
```

Each command compiles TypeScript via `tsconfig.experiments.json` (output to `dist-exp/`) and runs the benchmark.
Results print to stdout; captured snapshots live in each experiment's `results.txt`.

## Directory structure

```
experiments/
  fidelity/          baseline: synthetic caveman encoder + c2e decode
    corpus.ts        20-entry technical prose corpus (shared by all experiments)
    encoder.ts       encodeCaveman(), extractModals(), tokenize()
    scorer.ts        rouge1(), compressionRatio(), modalRecovery()
    run.ts           benchmark runner
    results.txt
  ust/               Unicode Semantic Token encoding
    shared-abbrevs.ts  abbreviation table imported by rfc/, esperanto/, gilfoyle/
    encoder.ts
    decoder.ts
    benchmark.ts
    results.txt
  rfc/               Reconstruction-Friendly Caveman
    encoder.ts
    benchmark.ts
    results.txt
  esperanto/         Terse Esperanto dialect
    vocabulary.ts    bidirectional translation tables
    encoder.ts
    decoder.ts
    benchmark.ts
    results.txt
  gilfoyle/          Binding-preserving compression, no decoder needed
    encoder.ts
    benchmark.ts
    skill.md         system prompt for live LLM use
    results.txt
  PROPOSALS.md       three proposed follow-on experiments (SLP, DFS, SST)
```

## Shared infrastructure

All experiments import from `experiments/fidelity/`:

- `corpus.ts` — the 20-entry corpus; do not modify entries, add new ones at the end
- `encoder.ts` — `extractModals()` used by all benchmark scripts
- `scorer.ts` — `rouge1()`, `compressionRatio()`, `modalRecovery()`

`experiments/ust/shared-abbrevs.ts` holds the abbreviation table used by the RFC, Esperanto, and Gilfoyle encoders.

## Adding a new experiment

1. Create `experiments/<name>/` with at minimum `encoder.ts` and `benchmark.ts`.
2. `encoder.ts` must export `encode<Name>(text: string): string`.
3. `benchmark.ts` must import `CORPUS` from `../fidelity/corpus.js` and report all five metrics: ROUGE-1, compression, modal recovery, causal recovery, reconstruction-required.
   Copy the metric implementations from `experiments/esperanto/benchmark.ts` — they are stable and shared.
4. Add `"benchmark:<name>": "tsc -p tsconfig.experiments.json && node dist-exp/experiments/<name>/benchmark.js"` to `package.json`.
5. Run `npm run benchmark:<name>` and save the output to `experiments/<name>/results.txt`.
6. If the experiment uses a live LLM dialect (not just a synthetic encoder), add `experiments/<name>/skill.md` — a system prompt sufficient for an LLM to produce the dialect without additional instruction.

That is all that is required.
`tsconfig.experiments.json` at the repo root handles cross-directory TypeScript compilation — no additional tsconfig is needed per experiment.

## Metrics reference

| Metric                  | What it tests                                                           | Implementation                                   |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| ROUGE-1 F1              | Overall fidelity: unigram overlap between decoded output and original   | `scorer.ts:rouge1()`                             |
| Compression             | Character savings of encoded vs original (`1 - len(enc)/len(orig)`)     | `scorer.ts:compressionRatio()`                   |
| Modal recovery          | Fraction of original modal verbs present in decoded output              | `scorer.ts:modalRecovery()`                      |
| Causal recovery         | Fraction of original causal conjunctions present in decoded output      | `esperanto/benchmark.ts:causalRecovery()`        |
| Reconstruction-required | Fraction of encoded sentences with a detectably broken semantic binding | `gilfoyle/benchmark.ts:reconstructionRequired()` |

The last two metrics were introduced in later experiments.
If you are comparing against the fidelity baseline only, causal recovery and reconstruction-required are optional — but including them makes the results directly comparable to the full table in `RESEARCH.md`.
