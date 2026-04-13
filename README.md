# caveman2english

Expands [caveman](https://github.com/JuliusBrussee/caveman) LLM output back into readable English prose.
Caveman is a prompt-engineering technique that cuts output tokens 65–75% by stripping articles, conjunctions, and hedging.
This tool post-processes that compressed output into natural sentences — deterministically, with no API calls required.

## Install

```bash
npm install -g caveman2english
```

## Usage

```bash
# Pipe any caveman output through c2e
echo "DB connection pool exhausted. each req opens new connection. wrap in try-finally." | c2e

# Claude Code Stop hook — translates the last assistant message to stderr
# See examples/claude-code-hook/ for setup
```

## Options

```
--fragment-level 0-3    Fragment completion aggressiveness (default: 1)
--no-abbreviations      Skip abbreviation expansion
--no-fragments          Skip fragment completion
--no-ventilate          Skip one-sentence-per-line formatting
--backend claude|ollama Enable LLM expansion for long responses
--expand-threshold <n>  Word count before LLM kicks in (default: 300)
```

User config lives in `~/.c2e.json` — see `DESIGN.md` for the full schema.

---

## Experiments

Three compression dialect experiments were run to test whether alternative encoding schemes could outperform plain caveman on mechanical reconstruction fidelity.
Each experiment used a 20-entry technical corpus and a synthetic encoder to generate encoded/original pairs without live API calls.
Results were measured on three metrics: ROUGE-1 F1 (word overlap with the original), compression ratio, and modal recovery (fraction of uncertainty words like `should`/`might` preserved through the round-trip).

### Fidelity baseline (`experiment/fidelity-benchmark`)

**Hypothesis:** deterministic c2e recovers most of the readability lost by caveman Full encoding.

**Validation:** encoded the corpus with a synthetic caveman encoder, expanded at fragment levels 1–3, scored against originals.

**Conclusion:** 83% ROUGE-1 and 92.5% modal recovery at 14.2% compression.
Fragment rules under-fired because the synthetic encoder left verbs intact — real Ultra-mode caveman would benefit more from levels 2–3.
Modal recovery is slightly inflated because the synthetic encoder retains `should`, which real caveman strips.

### UST — Unicode Semantic Tokens (`experiment/ust-language`)

**Hypothesis:** replacing caveman's plain compression with emoji role markers (🔴 problem, 🟢 fix, 💡 reason, ⚡ causes) would preserve semantic structure and enable better reconstruction via a dedicated decoder.

**Validation:** built a synthetic UST encoder that classifies each sentence's role and emits the appropriate marker, a decoder that maps markers back to prose prefixes, and ran the same 20-entry benchmark.

**Conclusion:** UST underperformed caveman+c2e on every metric — ROUGE-1 dropped to 80.7%, compression fell to 4.7%, modal recovery fell to 85.0%.
Emoji markers add character overhead without improving fidelity, and the custom decoder introduced artifacts: doubled conjunctions (`because...because`), redundant prefixes (`The fix is to you should...`).
Adding a novel encoded format with a bespoke decoder is worse than the simpler pipeline.

### RFC — Reconstruction-Friendly Caveman (`experiment/rfc-dialect`)

**Hypothesis:** keeping semantic load-bearing words — modal verbs (`should`, `must`, `might`, `likely`) and causal/contrastive conjunctions (`because`, `but`, `however`) — in the encoded form would improve modal recovery and ROUGE-1, at the cost of slightly lower compression.

**Validation:** built an RFC encoder identical to caveman Full except it preserves the words above, then ran the same benchmark using c2e for decoding (no custom decoder needed).

**Conclusion:** hypothesis confirmed.

| System      | ROUGE-1 | Compression | Modal recovery |
| ----------- | ------- | ----------- | -------------- |
| Caveman+c2e | 83.0%   | 14.2%       | 92.5%          |
| UST+decoder | 80.7%   | 4.7%        | 85.0%          |
| RFC+c2e     | 84.7%   | 3.5%        | **100.0%**     |

RFC achieves perfect modal recovery and +1.7% ROUGE-1 with clean, artifact-free round-trips.
The trade-off is real: RFC saves ~3–4% of characters vs ~14% for caveman.
For contexts where modality matters — debugging explanations, security warnings, migration guides — RFC is the better dialect.
For maximum token savings with acceptable fidelity, plain caveman+c2e remains the right choice.

**Key insight:** don't strip semantic load-bearing words and expect the expander to recover them from context.
Keep them in the encoded form, and reconstruction becomes a much easier problem.

### Esperanto (`experiment/esperanto-encoding`)

**Hypothesis:** encoding as terse Esperanto — a constructed language with no indefinite article, unambiguous modal conjugations (`devus` = should, `devas` = must, `eble` = might), and shorter causal conjunctions (`ĉar` = because) — achieves the same losslessness as RFC while offering better LLM compliance, since Esperanto is a real language with training data rather than a bespoke dialect the model has never seen.

**Validation:** built a synthetic encoder that replaces English modals/conjunctions/quantifiers with Esperanto equivalents and converts technical nouns to Esperanto vocabulary, with a decoder that reverses the substitutions and passes the result to c2e.
A four-metric benchmark (ROUGE-1, compression, modal recovery, causal recovery) was run against caveman and RFC on the same 20-entry corpus.
The causal recovery metric was introduced here to specifically track whether `because`/`since` survive the round-trip — a known failure mode for caveman.

**Conclusion:** Esperanto matches RFC on every fidelity metric with marginally better compression.

| System        | ROUGE-1   | Compression | Modal recovery | Causal recovery |
| ------------- | --------- | ----------- | -------------- | --------------- |
| Caveman+c2e   | 83.0%     | 14.2%       | 92.5%          | 100.0%          |
| UST+decoder   | 80.7%     | 4.7%        | 85.0%          | —               |
| RFC+c2e       | **84.7%** | 3.5%        | **100.0%**     | **100.0%**      |
| Esperanto+c2e | 84.4%     | **3.0%**    | **100.0%**     | **100.0%**      |

Round-trips are clean and artifact-free.
One entry (`cache-invalidation`) went negative on compression because Esperanto technical vocabulary (`kaŝmemoro`, `datumbazo`) is longer than the English abbreviations — the encoder should prefer abbreviations for known short forms.

The practical case for Esperanto over RFC is not the numbers — they are nearly identical — but compliance.
When a live LLM is given a system prompt, it is more likely to consistently produce correct Esperanto (a language it was trained on) than to consistently obey a custom "keep these English words, drop everything else" rule it has never seen.
This is an empirical question that requires a live LLM benchmark to resolve.
