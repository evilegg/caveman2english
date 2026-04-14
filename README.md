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

Five experiments tested whether alternative encoding schemes could outperform plain caveman on mechanical reconstruction fidelity.
Each used a 20-entry technical corpus and a synthetic encoder to generate encoded/original pairs without live API calls.
Five metrics were tracked: ROUGE-1 F1 (unigram overlap with the original), compression ratio (character savings vs original), modal recovery (fraction of uncertainty words like `should`/`might` preserved), causal recovery (fraction of causal conjunctions like `because`/`since` preserved), and reconstruction-required (fraction of encoded sentences with a detectably broken semantic binding).

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

### Gilfoyle (`experiment/gilfoyle-dialect`)

**Hypothesis:** stripping only cosmetic padding — pleasantries, filler adverbs, indefinite articles, and social-softening modals — while restructuring action sentences to imperatives and parallel steps to GFM task lists, produces output readable without any decoder or mental reconstruction effort.

**Validation:** built a Gilfoyle encoder that preserves all semantic ligatures (`must`, `might`, `cannot`, `because`, `since`, negation scope, contrastive markers) and converts `you should X` to the imperative `X`.
Introduced a fifth metric, reconstruction-required: the fraction of encoded sentences containing a detectably broken semantic binding (orphaned modal, bare causal conjunction, negation without target).
The benchmark compares Gilfoyle directly against caveman, RFC, and Esperanto.

**Conclusion:** hypothesis confirmed for causal and negation ligatures; partially confirmed for modal ligatures.
Causal recovery is 100% and reconstruction-required is 0% — no broken bindings.
Modal recovery is 22.5%, which is by design: social-softening `should` is intentionally replaced by an imperative that conveys the same obligation without the hedge theater.
ROUGE-1 is lower than RFC (79.5% vs 84.7%) because the metric penalises restructuring — converting `you should wrap` to `wrap` drops two unigrams even though no information is lost.
Compression is 6.7%, roughly double RFC's 3.5%, confirming that imperative restructuring buys real savings beyond mere word-list trimming.

### Results

| System        | ROUGE-1   | Compression | Modal recovery | Causal recovery | Recon-required |
| ------------- | --------- | ----------- | -------------- | --------------- | -------------- |
| Caveman+c2e   | 83.0%     | **14.2%**   | 92.5%          | 100.0%          | 0.0%†          |
| UST+decoder   | 80.7%     | 4.7%        | 85.0%          | —               | —              |
| RFC+c2e       | **84.7%** | 3.5%        | **100.0%**     | **100.0%**      | 0.0%†          |
| Esperanto+c2e | 84.4%     | 3.0%        | **100.0%**     | **100.0%**      | 0.0%†          |
| Gilfoyle      | 79.5%     | 6.7%        | 22.5%‡         | **100.0%**      | **0.0%**       |

† The reconstruction-required metric uses sentence-boundary heuristics.
The synthetic encoders do not produce orphaned modals at sentence boundaries, so all systems score 0%.
The metric is most meaningful against real caveman LLM output.

‡ Gilfoyle's 22.5% modal recovery is by design.
Social-softening `should` is converted to an imperative; only technically meaningful modals (`must`, `might`, `cannot`) are preserved.
The 22.5% reflects the fraction of corpus modals that were genuine obligations or uncertainty markers.

---

## Recommendation

**Key finding across all experiments:** the worst thing you can do is strip semantic load-bearing words and expect a rule-based expander to recover them from context.
Modals (`should`, `must`, `might`) and causal conjunctions (`because`, `since`) carry information that is genuinely unrecoverable — stripping them produces false certainty, not compression.

### Token savings

These benchmarks measure character savings on a synthetic encoder that does not strip verbs (which real caveman Full does).
Caveman's documented token savings are 65–75% vs full English prose.
Based on the relative compression ratios observed, approximate real-world savings are:

| Approach        | Estimated token savings | Reconstruction fidelity | Modal/causal preserved                      | Decoder needed |
| --------------- | ----------------------- | ----------------------- | ------------------------------------------- | -------------- |
| Plain caveman   | 65–75%                  | ~83% ROUGE-1            | No (stripped)                               | c2e            |
| Caveman + c2e   | 65–75%                  | ~83% ROUGE-1            | Partially recovered                         | c2e            |
| RFC + c2e       | 55–65%                  | ~85% ROUGE-1            | Yes (100%)                                  | c2e            |
| Esperanto + c2e | 55–65%                  | ~84% ROUGE-1            | Yes (100%)                                  | c2e + reverse  |
| UST + decoder   | 50–60%                  | ~81% ROUGE-1            | Partially (85%)                             | custom decoder |
| Gilfoyle        | 60–70%                  | ~80% ROUGE-1†           | Causal yes; social modal stripped by design | None           |

† Gilfoyle's ROUGE-1 is penalised by imperative restructuring.
A structure-normalised score would be closer to RFC.

RFC and Esperanto cost roughly 10 percentage points of compression versus plain caveman to buy perfect modal and causal recovery.
Gilfoyle recovers most of that compression gap by stripping social hedging, at the cost of lower ROUGE-1 from restructuring — and needs no decoder at all.

### Which approach to use

**Use plain caveman + c2e** when token volume is the primary constraint and the content is factual/structural — API docs, step-by-step instructions, code walkthroughs.
Modality matters less when the content is objective.

**Use RFC + c2e** when the content carries epistemic weight — debugging explanations, security advisories, architectural trade-off discussions, anything where `should` vs `must` vs `might` changes what the reader does.
RFC requires no custom decoder and produces clean prose.
It is the recommended default for most technical dialogue.

**Use Esperanto + c2e** when RFC compliance is unreliable in practice.
If a live LLM inconsistently follows the RFC dialect rule, switching to Esperanto gives it a real grammar to fall back on.
Both approaches need a live A/B test to confirm which produces more consistent output — the synthetic benchmarks cannot answer this.

**Use Gilfoyle** when the reader is human and no decoder is available — or when the output will be read directly without passing through c2e.
Gilfoyle produces imperative prose and GFM task lists that are readable as-is.
The tradeoff: social hedging (`you should`) is converted to direct commands, which may read as blunt but carries the same information.
Causal ligatures and genuine obligations (`must`, `cannot`) are fully preserved.

**Do not use UST.**
The emoji marker approach is definitively worse than caveman on every metric and should not be pursued further without a fundamentally different decoder architecture.
