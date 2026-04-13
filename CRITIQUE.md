# Critique: The Premise of Lossy Re-Translation

## The Information-Theoretic Problem

Caveman was designed for _human_ readers who fill in linguistic gaps from context and domain knowledge.
It was never designed for _machine_ re-translation.
This distinction matters enormously.

Consider "auth broken."
That fragment could be a contraction of at least five different sentences:

- "The authentication system is broken." (declarative fact)
- "Authentication was broken by this change." (causal, past)
- "Authentication might be broken." (uncertain, present)
- "The auth middleware is broken in production." (specific scope)
- "I think auth is broken because of X." (epistemic hedge)

Every one of those sentences carries different semantic weight.
The current c2e expander picks one reconstruction heuristically and has no way to know it chose wrong.
This is not a fixable engineering problem — the information was never written down.

## What Caveman Actually Drops (and Why It Matters for Re-Translation)

| Dropped element          | Example                       | Why hard to recover                                                |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------ |
| Definiteness             | "the" vs "a"                  | Requires discourse model — is this thing already mentioned?        |
| Modality                 | might/should/must/could       | Epistemic state of the writer — unknowable from compressed form    |
| Causal conjunctions      | because/since/so              | Logical relationship between clauses — must be inferred            |
| Contrastive conjunctions | but/however/although          | Whether something is surprising or expected — unknowable           |
| Hedging                  | probably/likely/I think       | Writer's confidence — the most dangerous thing to hallucinate back |
| Tense precision          | was/is/will be                | Without context, we must guess                                     |
| Scope                    | "in production" vs "in tests" | Lost in abbreviation                                               |

Hedging is the most dangerous category to lose.
When an LLM says "might cause a re-render" and caveman strips "might", our expander confidently outputs "causes a re-render" — a false certainty that could mislead an engineer.

## Are There Better Compression Dialects?

### Option 1: Reconstruction-Friendly Caveman (RFC)

The minimal change: keep exactly the words that are hardest to recover, drop everything else.

Keep:

- `the` (definiteness encodes discourse state — very hard to reconstruct)
- Modality words: `might`, `should`, `must`, `could`, `would`, `will`
- Causal connectives: `because`, `since`, `so`, `therefore`, `thus`
- Contrastive connectives: `but`, `however`, `although`, `while`

Drop:

- `a`, `an` (recoverable via heuristic)
- Filler and hedging intensity: `really`, `very`, `basically`, `just`
- Pleasantries: `I'd be happy to`, `let me`, `note that`
- Non-essential `is`/`are` in noun-phrase descriptions

RFC output of the canonical example:

```
New obj ref created each render. Inline obj prop = new ref each render. Should wrap in useMemo.
```

vs caveman Full:

```
New obj ref each render. Inline obj prop = new ref. Wrap in useMemo.
```

Difference: RFC keeps `Should` — a single word that completely changes the meaning.
Token cost: ~5–10% more tokens than caveman Full.
Re-expansion quality: dramatically better because the hardest-to-infer words are preserved.

### Option 2: Unicode Semantic Tokens (UST)

Replace prose sentence structure with an explicit semantic layer using a designed vocabulary of Unicode symbols.
The LLM outputs structured semantic annotations alongside compressed content.
A deterministic decoder expands them back with perfect fidelity on the structural level.

Proposed core vocabulary:

| Symbol | Role                 | Decoded prefix                        |
| ------ | -------------------- | ------------------------------------- |
| 🔴     | PROBLEM / BUG        | "The problem is…"                     |
| 🟢     | FIX / SOLUTION       | "The fix is…" / "To resolve this,…"   |
| 🔵     | CONTEXT / NOTE       | "Note that…" / "For context,…"        |
| 🟡     | WARNING              | "Warning:…" / "Be aware that…"        |
| 💡     | EXPLANATION / WHY    | "This is because…" / "The reason is…" |
| ⚡     | CAUSES (strong)      | "…causes…"                            |
| ↩      | RESULTS IN           | "…results in…"                        |
| 🔁     | EACH TIME / PER      | "on each…" / "per…"                   |
| ✅     | DEFINITE / CONFIRMED | "definitely" / "certainly"            |
| ❓     | UNCERTAIN            | "possibly" / "might"                  |
| ⚠️     | IMPORTANT            | "Importantly,…"                       |
| 📌     | SPECIFICALLY         | "Specifically,…"                      |

UST-encoded version of the canonical example:

```
🔴 obj ref new 🔁 render ⚡ re-render
🔵 inline obj prop = new ref 🔁 render
🟢 useMemo
```

The critical difference: we now know which sentence is the problem, which is context, and which is the fix.
Caveman loses all three distinctions.

Emoji are typically 1–3 tokens each in modern tokenizers.
The net compression vs. full English is still 50–60%, slightly below caveman's 65–75%, but the re-expansion is largely deterministic.

### Option 3: Predicate-Argument Notation (PAN)

A formally structured notation inspired by logic programming and semantic role labeling:

```
PROB(re-render) CAUSE(new-ref, each-render) FIX(useMemo) CONF(high)
DETAIL(inline-prop = new-ref, each-render)
```

This is the most machine-readable of the three options.
It preserves: subject, predicate, object, causality, confidence, and scope.
Re-expansion is completely deterministic — no heuristics required.

The tradeoff: it's the most foreign to natural LLM output patterns and requires the most
"training" via the system prompt.
Whether LLMs can reliably maintain PAN format across long responses is an empirical question.

### Option 4: Round-Trip Corpus Training

If we generate large numbers of (original_prose, compressed) pairs we can:

1. **Measure** what information is actually lost at each caveman level
2. **Train or fine-tune** a small local model to expand more faithfully
3. **Evaluate** UST and RFC head-to-head against caveman on standardised benchmarks

This is an empirical approach rather than a design approach — it tells us the facts rather than assuming them.

## What the Current c2e Expander Is Actually Doing

Calling the current expander "re-translation" is generous.
It is doing:

- **Abbreviation reversal** — genuinely lossless, dictionary-based
- **Arrow notation reversal** — genuinely lossless, rule-based
- **Grammatical rehabilitation** — adding articles and verbs back using _structural_ heuristics, not _semantic_ ones
- **Fragment completion** — pattern-matching with high false-positive risk at levels 2–3

The fragment completion at level 3 is particularly optimistic: inferring past/present tense from neighboring sentences works sometimes, but has no access to the actual discourse structure caveman dropped.

## Recommendation

Three experiments with clear success criteria are proposed:

1. **`experiment/fidelity-benchmark`** — Measure the round-trip fidelity of current c2e before claiming any quality numbers. Synthetic encoder + ROUGE-1 + semantic similarity scoring. Establishes baselines for all subsequent experiments.

2. **`experiment/ust-language`** — Implement UST: a designed Claude skill that outputs semantic annotations + compressed content, plus a deterministic decoder. Measure token cost and re-expansion quality vs. caveman.

3. **`experiment/rfc-dialect`** — Implement RFC: a caveman variant that keeps modality and conjunctions, plus a targeted RFC-aware expander. Measure token cost vs. caveman and re-expansion quality vs. c2e.

## Designer's Response to the Critique

The critique is correct on the information-theoretic core.
The current c2e is most accurately described as _grammatical restoration_ rather than _semantic re-translation_.
For the majority of technical output this is fine — the semantic loss in "wrap in useMemo" vs "you should wrap this in useMemo" is low.
The cases where it fails badly are: uncertainty, scope qualifiers, and contrastive structure.

These experiments are ordered by expected impact and implementation risk:

| Experiment            | Token savings vs English | Re-expansion fidelity | Implementation risk                    |
| --------------------- | ------------------------ | --------------------- | -------------------------------------- |
| Caveman + current c2e | ~65-75%                  | ~50-60% (estimate)    | — baseline                             |
| RFC + c2e             | ~55-65%                  | ~75-85% (estimate)    | Low — compatible with existing         |
| UST + decoder         | ~50-60%                  | ~85-95% (estimate)    | Medium — needs LLM cooperation         |
| PAN + parser          | ~45-55%                  | ~95-99% (estimate)    | High — LLM format compliance uncertain |

If UST achieves its estimated fidelity at near-caveman token cost, it is the clear winner and should replace caveman as the preferred compression format.
If LLMs cannot reliably maintain UST format, RFC is the pragmatic fallback.

The fidelity benchmark is the prerequisite for all other comparisons.
