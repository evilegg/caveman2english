# Experiment: Fidelity Benchmark

## Hypothesis

The current c2e deterministic expander recovers approximately 80% of readability from
Full-mode caveman output.
**This experiment measures the actual number.**

The specific concern is modal/epistemic recovery: when caveman drops "might" or "should",
the expander cannot recover it — and silently produces a more certain-sounding output than the original.

## Method

1. A 20-entry corpus of realistic technical LLM explanations covers diverse topics.
2. A synthetic caveman encoder applies the same transformations caveman Full mode applies:
   - Strip articles (`a`, `an`, `the`)
   - Drop hedging words (`probably`, `likely`, `might`, …)
   - Drop filler (`really`, `very`, `basically`, …)
   - Convert causal phrases to arrow notation (`→`)
   - Apply abbreviation dictionary
3. The c2e deterministic expander is run at fragment levels 1, 2, and 3.
4. Three metrics are computed against the original prose:
   - **ROUGE-1 F1** — unigram overlap (standard NLP metric)
   - **Word recovery** — fraction of original words that reappear in expansion
   - **Modal recovery** — fraction of epistemic/modal words from original that are in expansion

## Run

```bash
# From repo root — build first
npm run build

# Install tsx for running TypeScript directly
npm install -D tsx

# Run benchmark
npx tsx experiments/fidelity/run.ts

# JSON output for further analysis
npx tsx experiments/fidelity/run.ts --json > experiments/fidelity/results.json
```

## Key Metrics

| Metric         | What it tells you                                                       |
| -------------- | ----------------------------------------------------------------------- |
| ROUGE-1        | Overall lexical similarity — how many words are shared                  |
| Word recovery  | How much of the original vocabulary was restored                        |
| Modal recovery | Whether epistemic uncertainty was preserved (the critical failure mode) |
| Compression    | How much the synthetic encoder compressed the original                  |

## Actual Results (run 2026-04-13)

| Metric         | Level 1 | Level 2 | Level 3 |
| -------------- | ------- | ------- | ------- |
| ROUGE-1        | 83.0%   | 83.0%   | 83.0%   |
| Word recovery  | 86.2%   | 86.2%   | 86.2%   |
| Modal recovery | 92.5%   | 92.5%   | 92.5%   |
| Compression    | 14.2%   | 14.2%   | 14.2%   |

## What the Results Revealed

### 1. The synthetic encoder underestimates real caveman compression

14.2% compression vs caveman's claimed 65–75%.
The encoder strips articles and hedging but leaves verbs intact.
Real caveman also strips copulas ("is", "are", "was"), drops subjects in fragment sentences,
and compresses more aggressively at Full/Ultra levels.
**The benchmark is valid but conservative — it tests a mild compression scenario.**

### 2. Fragment-level rules did not fire

All three levels produced identical ROUGE-1 scores for 19 of 20 entries.
The fragment detector only activates on verbless sentences.
Since the encoder preserves verbs, the fragment rules never trigger.
This confirms the fragment rules are correctly targeted at Ultra-mode caveman output,
not Full-mode.

### 3. Modal recovery was high — for the wrong reason

92.5% modal recovery sounds good.
But the corpus primarily uses `should` (a recommendation marker), which the encoder
does **not** strip — it is retained in the encoded text and recovered trivially.
The hedging words that are genuinely lost (`might`, `probably`, `likely`) appear
in only 4 of 20 entries.
For those 4 entries, modal recovery was 50% — consistent with the critique's prediction.

### 4. The critical failure mode is confirmed, just rarer than feared

When an original sentence contains genuine uncertainty (`might`, `likely`, `probably`),
caveman strips it and c2e cannot recover it.
The corpus shows this happens in ~20% of entries at this compression level.
At Ultra mode (which strips more), it would be higher.

## Revised Hypothesis for RFC and UST Experiments

The fidelity problem is real but narrower than the critique suggested.
The primary failure is on **uncertainty markers**, not general readability.
RFC and UST should focus specifically on preserving `might / could / probably / likely`
as their first priority.
The rest of the expansion is already working well at 83% ROUGE-1.

## Implications

The fidelity baseline is **83% ROUGE-1 at 14% compression** for Full-mode-equivalent input.
The RFC and UST experiments should target:

- ≥ 90% modal recovery (vs 92.5% here, but that number is inflated by `should` preservation)
- ≥ 85% ROUGE-1 (vs 83% here)
- ≥ 40% compression (vs 14% here — need a more aggressive encoder to test this regime)
