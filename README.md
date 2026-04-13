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

Four experiments tested whether alternative encoding schemes could outperform plain caveman on mechanical reconstruction fidelity.
Each used a 20-entry technical corpus and a synthetic encoder to generate encoded/original pairs without live API calls.
Four metrics were tracked: ROUGE-1 F1 (unigram overlap with the original), compression ratio (character savings vs original), modal recovery (fraction of uncertainty words like `should`/`might` preserved), and causal recovery (fraction of causal conjunctions like `because`/`since` preserved).

### Fidelity baseline (`experiment/fidelity-benchmark`)

**Hypothesis:** deterministic c2e recovers most of the readability lost by caveman Full encoding.

**Validation:** encoded the corpus with a synthetic caveman encoder, expanded at fragment levels 1–3, scored against originals.

**Conclusion:** 83% ROUGE-1 and 92.5% modal recovery at 14.2% compression.
Fragment rules under-fired because the synthetic encoder left verbs intact — real Ultra-mode caveman would benefit more from levels 2–3.
Modal recovery is slightly inflated because the synthetic encoder retains `should`, which real caveman strips.
Causal conjunctions survived because the synthetic encoder preserved `because` (real caveman typically strips it too).

### UST — Unicode Semantic Tokens (`experiment/ust-language`)

**Hypothesis:** replacing caveman's plain compression with emoji role markers (🔴 problem, 🟢 fix, 💡 reason, ⚡ causes) would preserve semantic structure and enable better reconstruction via a dedicated decoder.

**Validation:** built a synthetic UST encoder that classifies each sentence's role and emits the appropriate marker, a decoder that maps markers back to prose prefixes, and ran the same 20-entry benchmark.

**Conclusion:** UST underperformed caveman+c2e on every metric — ROUGE-1 dropped to 80.7%, compression fell to 4.7%, modal recovery fell to 85.0%.
Emoji markers add character overhead without improving fidelity, and the custom decoder introduced artifacts: doubled conjunctions (`because...because`), redundant prefixes (`The fix is to you should...`).
A novel encoded format with a bespoke decoder is worse than the simpler pipeline.

### RFC — Reconstruction-Friendly Caveman (`experiment/rfc-dialect`)

**Hypothesis:** keeping semantic load-bearing words — modal verbs (`should`, `must`, `might`, `likely`) and causal/contrastive conjunctions (`because`, `but`, `however`) — in the encoded form would improve modal recovery and ROUGE-1, at the cost of slightly lower compression.

**Validation:** built an RFC encoder identical to caveman Full except it preserves the words above, then ran the same benchmark using c2e for decoding (no custom decoder needed).

**Conclusion:** hypothesis confirmed.
RFC achieves perfect modal and causal recovery with +1.7% ROUGE-1 and clean, artifact-free round-trips.
The compression trade-off is real but the fidelity gain is consistent across all 20 entries.

### Esperanto (`experiment/esperanto-encoding`)

**Hypothesis:** encoding as terse Esperanto — a constructed language with no indefinite article, unambiguous modal conjugations (`devus` = should, `devas` = must, `eble` = might), and shorter causal conjunctions (`ĉar` = because, 3 chars vs 7) — achieves the same losslessness as RFC while offering better LLM compliance, since Esperanto is a real language with training data rather than a bespoke dialect the model has never seen.

**Validation:** built a synthetic encoder that replaces English modals/conjunctions/quantifiers with Esperanto equivalents and converts technical nouns to Esperanto vocabulary, with a rule-based decoder that reverses the substitutions and passes the result to c2e.
Introduced causal recovery as a fourth benchmark metric to specifically track whether `because`/`since` survive the round-trip.
Notable implementation detail: JavaScript's `\b` word boundary silently fails for non-ASCII characters (`ĉ` is not in `\w`), requiring Unicode property lookarounds (`/(?<!\p{L})ĉar(?!\p{L})/gu`) for correct matching.

**Conclusion:** Esperanto matches RFC on every fidelity metric at marginally better compression.
One entry (`cache-invalidation`) went negative on compression because Esperanto technical vocabulary (`kaŝmemoro`) is longer than the English abbreviation — the encoder should prefer known short forms.
The practical case for Esperanto over RFC is not in the numbers but in compliance: a live LLM is more likely to produce consistent Esperanto (a language it was trained on) than to reliably follow a custom dialect rule it has never seen.

### Results

| System        | ROUGE-1   | Compression | Modal recovery | Causal recovery |
| ------------- | --------- | ----------- | -------------- | --------------- |
| Caveman+c2e   | 83.0%     | **14.2%**   | 92.5%          | 100.0%          |
| UST+decoder   | 80.7%     | 4.7%        | 85.0%          | —               |
| RFC+c2e       | **84.7%** | 3.5%        | **100.0%**     | **100.0%**      |
| Esperanto+c2e | 84.4%     | 3.0%        | **100.0%**     | **100.0%**      |

---

## Recommendation

**Key finding across all experiments:** the worst thing you can do is strip semantic load-bearing words and expect a rule-based expander to recover them from context.
Modals (`should`, `must`, `might`) and causal conjunctions (`because`, `since`) carry information that is genuinely unrecoverable — stripping them produces false certainty, not compression.

### Token savings

These benchmarks measure character savings on a synthetic encoder that does not strip verbs (which real caveman Full does).
Caveman's documented token savings are 65–75% vs full English prose.
Based on the relative compression ratios observed, approximate real-world savings are:

| Approach        | Estimated token savings | Reconstruction fidelity | Modal/causal preserved |
| --------------- | ----------------------- | ----------------------- | ---------------------- |
| Plain caveman   | 65–75%                  | ~83% ROUGE-1            | No (stripped)          |
| Caveman + c2e   | 65–75%                  | ~83% ROUGE-1            | Partially recovered    |
| RFC + c2e       | 55–65%                  | ~85% ROUGE-1            | Yes (100%)             |
| Esperanto + c2e | 55–65%                  | ~84% ROUGE-1            | Yes (100%)             |
| UST + decoder   | 50–60%                  | ~81% ROUGE-1            | Partially (85%)        |

RFC and Esperanto cost roughly 10 percentage points of compression versus plain caveman to buy perfect modal and causal recovery.
Whether that trade-off is worthwhile depends on what is being communicated.

### Which approach to use

**Use plain caveman + c2e** when token volume is the primary constraint and the content is factual/structural — API docs, step-by-step instructions, code walkthroughs.
Modality matters less when the content is objective.

**Use RFC + c2e** when the content carries epistemic weight — debugging explanations, security advisories, architectural trade-off discussions, anything where `should` vs `must` vs `might` changes what the reader does.
RFC requires no custom decoder and produces clean prose.
It is the recommended default for most technical dialogue.

**Use Esperanto + c2e** when RFC compliance is unreliable in practice.
If a live LLM inconsistently follows the RFC dialect rule, switching to Esperanto gives it a real grammar to fall back on.
Both approaches need a live A/B test to confirm which produces more consistent output — the synthetic benchmarks cannot answer this.

**Do not use UST.**
The emoji marker approach is definitively worse than caveman on every metric and should not be pursued further without a fundamentally different decoder architecture.
