# Research: Semantic Ligature Preservation in LLM Output Compression

This document covers the methodology, results, and open problems from five
experiments testing encoding schemes for compressible-but-recoverable LLM output.

## The encode/decode pipeline

Caveman compresses LLM output by stripping articles, conjunctions, hedging, and
filler — cutting 65–75% of tokens.
The compressed output is efficient for the person running the session but hard
to share or re-read: fragments require the reader to mentally reconstruct the
missing grammar.

c2e is the decode half of this pipeline:

```
LLM → [caveman encoding] → compressed output → [c2e] → readable prose
```

c2e applies an ordered rule pipeline deterministically — no API calls, no
learned model:

1. Arrow expansion (`→`/`->` → prose phrase)
2. Abbreviation expansion (static dictionary + user overrides)
3. Fragment completion (verbless sentence → grammatical sentence, four levels)
4. Conjunction injection (`Also,` before continuation sentences)
5. Article insertion (`a`/`an` before bare technical nouns)
6. Punctuation normalisation (capitalisation + terminal periods)
7. Ventilation (one sentence per line)

Code fences and inline spans are never touched — the pipeline operates on
plain text segments only.

## The semantic ligature claim

The central finding across all experiments:

> **Stripping semantic load-bearing words and expecting a rule-based expander
> to recover them from context produces genuinely unrecoverable information
> loss.**

Specifically, two word classes cannot be recovered:

- **Modal verbs** (`should`, `must`, `might`, `cannot`) — they change what the
  reader does next. `must configure the timeout` and `configure the timeout`
  are not equivalent: one is an obligation, one is a suggestion.
- **Causal conjunctions** (`because`, `since`, `therefore`) — they are the
  binding between a cause and its effect. Strip `because` and the causal
  relationship becomes two unrelated facts.

These are _semantic ligatures_: scope bindings between a modal and its action,
or a cause and its effect. Breaking them is not compression — it is information
loss that the reader must repair at cognitive cost.

The RFC and Esperanto experiments provide the quantitative evidence:
preserving these words costs roughly 10 percentage points of compression but
buys perfect modal and causal recovery across all 20 corpus entries.

## Benchmark methodology

### Corpus

20 technical prose entries covering realistic LLM explanations: React
re-rendering, database pool exhaustion, race conditions, JWT expiry, SQL
injection, Kubernetes scheduling failures, and similar.
Each entry is 50–90 words of standard English prose — the "ground truth"
before compression.
Source: `experiments/fidelity/corpus.ts`.

### Synthetic encoders

Each experiment uses a synthetic encoder that applies the dialect's rules
deterministically to the corpus without a live LLM.
This isolates the encoding scheme from LLM compliance variance.
The encoders do not strip verbs (real caveman Full does), so the measured
compression ratios are lower than real-world caveman savings.

### Metrics

| Metric                  | Definition                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| ROUGE-1 F1              | Unigram overlap (F1) between the decoded output and the original prose  |
| Compression             | `1 - len(encoded) / len(original)` (character count)                    |
| Modal recovery          | Fraction of original modal verbs present in the decoded output          |
| Causal recovery         | Fraction of original causal conjunctions present in the decoded output  |
| Reconstruction-required | Fraction of encoded sentences with a detectably broken semantic binding |

ROUGE-1 measures overall fidelity.
Modal and causal recovery specifically test the semantic ligature claim.
Reconstruction-required is a direct measure of cognitive overhead: a sentence
that scores positive on this metric requires the reader to infer the missing
half of a binding.

### Reproducibility

All benchmarks run from a clean checkout:

```bash
npm install
npm run benchmark:fidelity    # caveman baseline
npm run benchmark:ust         # UST experiment
npm run benchmark:rfc         # RFC experiment
npm run benchmark:esperanto   # Esperanto experiment
npm run benchmark:gilfoyle    # Gilfoyle experiment
```

Each command compiles TypeScript with `tsconfig.experiments.json` (which sets
`rootDir: "."` to allow cross-directory imports) and runs the benchmark script
under `dist-exp/`.

## Results

| System        | ROUGE-1   | Compression | Modal recovery | Causal recovery | Recon-required |
| ------------- | --------- | ----------- | -------------- | --------------- | -------------- |
| Caveman+c2e   | 83.0%     | **14.2%**   | 92.5%          | 100.0%          | 0.0%†          |
| UST+decoder   | 80.7%     | 4.7%        | 85.0%          | —               | —              |
| RFC+c2e       | **84.7%** | 3.5%        | **100.0%**     | **100.0%**      | 0.0%†          |
| Esperanto+c2e | 84.4%     | 3.0%        | **100.0%**     | **100.0%**      | 0.0%†          |
| Gilfoyle      | 79.5%     | 6.7%        | 22.5%‡         | **100.0%**      | **0.0%**       |

† The reconstruction-required metric uses sentence-boundary heuristics.
The synthetic encoders do not produce orphaned modals at sentence boundaries,
so all systems score 0%.
The metric is most meaningful against real caveman LLM output where the model
aggressively strips within sentences.

‡ Gilfoyle's 22.5% modal recovery is by design.
Social-softening `should` is converted to an imperative; only technically
meaningful modals (`must`, `might`, `cannot`) are preserved.

## Experiment summaries

### Fidelity baseline

**Claim:** deterministic c2e recovers most of the readability lost by caveman
Full encoding.

**Finding:** 83% ROUGE-1 and 92.5% modal recovery at 14.2% compression.
Fragment rules under-fired because the synthetic encoder left verbs intact.
Modal recovery is slightly inflated for the same reason — real caveman Ultra
strips `should`, which the synthetic encoder retains.

### UST — Unicode Semantic Tokens

**Claim:** emoji role markers (🔴 problem, 🟢 fix, 💡 reason, ⚡ causes)
preserve semantic structure and enable better reconstruction via a dedicated
decoder.

**Finding:** UST underperformed caveman+c2e on every metric.
Emoji markers add character overhead without improving fidelity.
The custom decoder introduced artifacts: doubled conjunctions and redundant
prefixes.
Lesson: a novel encoded format with a bespoke decoder is worse than the simpler
prose pipeline.

### RFC — Reconstruction-Friendly Caveman

**Claim:** preserving modal verbs and causal conjunctions in the encoded form
improves modal recovery and ROUGE-1 at the cost of slightly lower compression.

**Finding:** hypothesis confirmed.
RFC achieves perfect modal and causal recovery with +1.7% ROUGE-1 and
clean, artifact-free round-trips.
The compression cost is real but the fidelity gain is consistent across all 20
entries.
This is the strongest quantitative evidence for the semantic ligature claim.

### Esperanto

**Claim:** terse Esperanto — no indefinite article, unambiguous modals
(`devus` = should, `devas` = must, `eble` = might), shorter causal
conjunctions (`ĉar` = because, 3 chars vs 7) — matches RFC losslessness
while offering better LLM compliance, since Esperanto has training data.

**Finding:** Esperanto matches RFC on every fidelity metric at marginally
better compression.
One entry (`cache-invalidation`) went negative on compression because the
Esperanto vocabulary item (`kaŝmemoro`) is longer than the English
abbreviation.
Notable implementation hazard: JavaScript's `\b` word boundary silently fails
for non-ASCII characters, requiring Unicode property lookarounds
(`/(?<!\p{L})ĉar(?!\p{L})/gu`).

### Gilfoyle

**Claim:** stripping only cosmetic padding while restructuring action sentences
to imperatives and converting parallel steps to GFM task lists produces output
readable without any decoder.

**Finding:** causal recovery 100%, reconstruction-required 0%.
Modal recovery 22.5% — by design, not a defect: social-softening `should` is
replaced by an imperative that carries the same information.
ROUGE-1 lower than RFC (79.5% vs 84.7%) because the metric penalises
restructuring: converting `you should wrap` to `wrap` drops two unigrams even
though no information is lost.
Gilfoyle is the only system in this table that needs no decoder at all.

## Open problems

Three proposed experiments are documented in `experiments/PROPOSALS.md`:

**SLP — Symbolic Logic Prose:** replace verbose logical phrases with single
Unicode symbols (`∵` = because, `∀` = every, `¬` = not).
Expected to beat RFC on compression while matching RFC on modal recovery.
Low implementation risk.

**DFS — Domain Frame Slots:** encode technical debugging explanations as typed
semantic frames (`CAUSE:`, `FIX:`, `ENSURES:`).
Expected 55–60% compression at 100% modal recovery — competitive with plain
caveman but lossless.
High implementation risk: slot extraction requires entity recognition.

**SST — S-expression Semantic Tree:** encode sentence meaning as a Lisp-style
tree of semantic predicates.
Most theoretically interesting: directly tests whether an AST-like
representation of meaning is more lossless than prose.

**Gilfoyle v2** (issue #6): increase Gilfoyle compression to 25–35% by adding
tilde hedging notation (`~`), copula deletion, causation arrows (`→`), and a
machine-readable translation corpus (`translations.json`).

**Live LLM compliance test** (not yet run): the synthetic benchmarks test
encoding schemes in isolation.
A live A/B test with a real model is required to measure which dialect — RFC,
Esperanto, or Gilfoyle — produces the most consistent output in practice.
The synthetic results predict RFC and Esperanto should tie on fidelity; the
live test will reveal which one a model actually follows more reliably.
