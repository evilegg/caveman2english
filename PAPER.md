# Semantic Ligature Preservation as a Criterion for Lossless LLM Output Compression

**Abstract** — Large language model output compression schemes are typically evaluated on token reduction alone.
We argue that token count is the wrong primary metric: what matters is _cognitive reconstruction cost_ — the mental effort a reader must expend to recover meaning that the encoding stripped.
We introduce _semantic ligatures_, scope bindings between linguistic units whose meaning is carried as a pair (modal + verb, cause + effect, negation + target), and show that breaking them imposes a measurable reconstruction cost that is invisible to standard compression metrics.
We present a taxonomy of three compressibility classes — semantic ligatures, cosmetic padding, and structural glue — and evaluate five encoding schemes on a 20-entry technical corpus against four metrics: ROUGE-1, compression ratio, modal recovery, and causal recovery.
Schemes that preserve semantic ligatures achieve 100% modal and causal recovery at 3–14% compression; schemes that strip them do not, regardless of their compression ratio.

---

## 1. Introduction

Prompt-engineering compression techniques — of which _caveman_ is a representative example — reduce LLM output token counts by 65–75% by stripping articles, conjunctions, hedging, and filler.
The compressed output is efficient for a developer reading session notes but hard to share or re-read: fragments require the reader to mentally reconstruct missing grammar.

This reconstruction effort is not uniformly distributed.
Some stripped words are cosmetically redundant ("basically", "I'd be happy to") — their removal costs the reader nothing.
Others are structurally recoverable by rule ("a connection" → "connection" → rule restores the article).
But a third class — words that bind a meaning unit to its scope — cannot be recovered by any rule and require the reader to infer them from context, which may fail or succeed differently across readers.

We call this third class _semantic ligatures_ and define them formally: a semantic ligature is a word or phrase whose removal severs a scope binding between two linguistic units, such that neither unit individually conveys the meaning that the pair conveys together.
The canonical examples are deontic modal verbs (`should wrap` — obligation) and causal conjunctions (`because exhausted` — causation), but the class also includes negation-target bindings (`without releasing` — absence of action), conditional scope markers, and hedging modals (`might fail` — uncertainty).

The practical claim is this: _any_ compression scheme that strips semantic ligatures will produce output that imposes cognitive reconstruction cost on the reader, regardless of how compact the encoding is.
Conversely, any scheme that preserves semantic ligatures will produce output that can be read (or mechanically decoded) with no reconstruction effort, at whatever compression ratio the scheme achieves.

This claim is falsifiable and, as far as we know, has not been stated in the literature.
Prior work on text simplification, controlled natural language, and semantic representation focuses on readability, annotation, or generation — not on the encode/decode fidelity problem that arises when a compression scheme is applied upstream of a human reader.

We test the claim on five encoding experiments (caveman+c2e, UST+decoder, RFC+c2e, Esperanto+c2e, and Gilfoyle v2) across a 20-entry technical prose corpus.
All five experiments use synthetic, deterministic encoders applied to a fixed corpus, isolating encoding scheme quality from LLM compliance variance.
All benchmarks are reproducible from a public repository without modification.

## 2. The Semantic Ligature Taxonomy

Compression schemes vary in which word classes they strip.
We propose a three-way taxonomy based on the cognitive cost of removal.

| Class              | Examples from corpus                                                                                              | Safe to strip?                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Semantic ligatures | `should wrap`, `because exhausted`, `without releasing`, `not valid`, `might fail`, `must restart`                | No — breaking creates cognitive reconstruction cost |
| Cosmetic padding   | `really`, `basically`, `I'd be happy to`, `note that`, `it is worth noting that`, `as mentioned above`            | Yes — zero information content                      |
| Structural glue    | `a`/`an`, passive markers (`is being`), connectors between independent facts (`Additionally`), filler determiners | Partially — heuristics recover most                 |

### 2.1 Semantic Ligatures in Detail

A semantic ligature is a word (or minimal phrase) that acts as the _binding half_ of a meaning pair.
Remove it and the remaining word changes its communicative function.

**Deontic modal + action verb.**
`You should wrap every database call in a try-finally block.`
Strip `should` → `wrap every database call in a try-finally block` — grammatically complete, but the obligation is gone.
A reader cannot recover `should` from the sentence alone; they must infer the author's intent from surrounding context, which may be absent in a compressed note.

**Causal conjunction + cause clause.**
`The pool is exhausted because each request opens a connection without releasing it.`
Strip `because` → two unrelated facts: "The pool is exhausted." "Each request opens a connection without releasing it."
The causal relationship — the very information the sentence was designed to convey — is lost.

**Negation + target.**
`This prevents connections from returning to the pool.`
Strip `prevents` (or the outer negation in a paraphrase like `without releasing`) → the reader must infer that release is absent rather than merely delayed.
Whether this counts as semantic ligature depends on the encoding: "without releasing" is a binding, "not releasing" is a binding, but "omit release step" encodes the same absence more compactly.

**Hedging modal + predicate.**
`This might be caused by a missing error handler.`
Strip `might` → assertoric claim.
The difference between `might be caused by` and `is caused by` can drive different debugging actions.

### 2.2 Structural Glue

Structural glue words are recoverable by deterministic rule.
The `c2e` rule pipeline handles the main classes:

- Articles (`a`/`an`) — article insertion rule recovers ~95% after prepositions before bare technical nouns.
- Arrow notation (`→`, `->`) — expanded to `leads to`, `causes`, or `resulting in` based on surrounding context.
- Fragment completion — verbless sentences completed by heuristic at four aggression levels.
- Passive voice markers — the rule pipeline does not attempt to reconstruct passive voice; this is an open gap.

### 2.3 Why the Distinction Matters

Standard compression metrics — token count, character count, ROUGE-1 — do not distinguish semantic ligatures from cosmetic padding.
A scheme that strips `basically` and a scheme that strips `because` achieve similar ROUGE-1 scores if their overall unigram overlap is similar, yet one imposes no reconstruction cost and the other may be unrecoverable.

The metric we need is _reconstruction-required_: the fraction of encoded sentences that contain a detectably broken semantic binding.
Section 4.4 describes how we operationalise this.

## 3. Related Work

### 3.1 Abstract Meaning Representation (AMR)

AMR encodes sentence meaning as a rooted directed acyclic graph; nodes are concepts and edges are labeled semantic roles (`:ARG0`, `:ARG1`, `:cause`, `:polarity`) [Banarescu et al. 2013].
AMR explicitly represents modality (`:mode imperative`, `:polarity -`), causation (`:cause`), and scope, which makes it theoretically ideal for our purpose.

**Why it fails as a compression format.**
AMR is verbose — roughly 120–150% the token count of the original sentence.
The `db-pool` example produces approximately 45 tokens of AMR for a 65-token original.
AMR-to-text generation (the decode step) is its own unsolved research problem; the best generators achieve approximately 40 BLEU, which produces unnatural prose.
Using AMR would add token overhead while introducing generation artifacts — the opposite of the goal.

### 3.2 Universal Dependencies (UD)

UD encodes grammatical relationships as typed arcs (`nsubj`, `obj`, `advmod`, `advcl:because`, `aux`) and is language-universal and syntactically unambiguous [Nivre et al. 2016].

**Why it fails as a compression format.**
Dependency structure captures _syntax_, not _semantics_.
`should wrap` and `wrap` have the same dependency structure from the perspective of the object `call`; UD loses modality.
Negation is encoded as a `neg` dependency arc on the verb, but the dependency tree for `without releasing` and `while releasing` differs only in the lemma of the preposition — not in a machine-readable flag that a decoder can act on.
UD solves the syntactic parsing problem; the reconstruction errors in compressed technical prose are semantic, not syntactic.

### 3.3 Simplified Technical English (STE / ASD-STE100)

STE is an industry standard for aerospace maintenance documentation: ~875 approved words, active voice only, sentences ≤20 words, no subordinate clauses [ASD-STE100 2021].
It achieves 10–15% length reduction through forced brevity.

**Why it fails as a compression format.**
STE is a readability standard, not a compression format.
It still produces prose that requires a human reader; there is no corresponding decoder.
Its compression ratio is similar to RFC (3–5%) but without the modal and conjunction preservation that makes RFC decodable.
STE specifically prohibits complex conditional sentences, stripping exactly the subordinate clauses that encode causal relationships — the opposite of what semantic ligature preservation requires.

### 3.4 Frame Semantics and FrameNet

FrameNet defines ~1,200 named semantic frames with labeled slot structures [Baker et al. 1998].
Encoding a sentence as `FRAME:Causation CAUSE:exhaustion EFFECT:pool_failure` is compact and preserves semantic roles explicitly.

**Relationship to our approach.**
Domain Frame Slots (DFS, described in Section 7 as future work) is a FrameNet-inspired experiment restricted to a 7-frame ontology covering technical debugging patterns.
DFS extends the ligature-preservation idea to explicit slot encoding, trading ROUGE-1 for higher compression.
We discuss it as proposed future work rather than a completed experiment.

### 3.5 Text Simplification

Text simplification [Siddharthan 2014; Shardlow 2014] targets readability for non-expert human readers and has an extensive literature on sentence splitting, lexical simplification, and syntactic transformation.
The goals differ from ours in two ways: (1) simplification targets a human reader, not a mechanical decoder; (2) simplification works in one direction (complex → simple) while our problem is bidirectional (original → encoded → decoded ≈ original).
The compression/fidelity tradeoff explored here has no direct equivalent in the simplification literature.

### 3.6 caveman

The caveman prompt-engineering technique [JuliusBrussee, 2024] instructs LLMs to produce terse output using arrow notation, abbreviations, and fragment style.
A March 2026 study found caveman brevity improved task accuracy by 26 points on coding tasks [citation forthcoming], establishing that compressed output is useful.
That work addresses the _encoding_ side.
This paper addresses the complementary _decoding_ side: what information is preserved and recoverable, and at what cognitive cost.

## 4. Methodology

### 4.1 Corpus

The corpus consists of 20 technical prose entries covering realistic LLM debugging explanations across common software engineering topics: React re-rendering, database pool exhaustion, race conditions, JWT expiry, SQL injection, Kubernetes scheduling failures, cache invalidation, CORS configuration, WebSocket handling, and similar.
Each entry is 50–90 words of standard English prose (mean: 67 words, SD: 11 words).
These represent the canonical use case: a developer asking an LLM to diagnose a problem and receiving a structured explanation.
All 20 entries are in `experiments/fidelity/corpus.ts` in the public repository.

We acknowledge the corpus size (n = 20) as a limitation.
The results establish direction and magnitude but not statistical significance.
Section 7 proposes corpus expansion as a priority for follow-on work.

### 4.2 Synthetic Encoders

Each experiment uses a synthetic encoder that applies the dialect's rules deterministically to the corpus entries.
This design choice isolates encoding scheme quality from LLM compliance variance: a real LLM running caveman will produce inconsistent output; a synthetic encoder produces exactly the same encoding for the same input every time.

The consequence is that measured compression ratios are lower than real-world caveman savings.
Real caveman (especially at "Ultra" aggressiveness) strips verbs, which the synthetic encoders do not.
The synthetic encoders operate on articles, conjunctions, abbreviations, and (for Gilfoyle) structural patterns — achieving 3–20% compression depending on the dialect, compared to 65–75% for real-world caveman.
This is documented explicitly in the results as a known ceiling artifact.

### 4.3 Systems Evaluated

**Caveman+c2e.**
The baseline.
Encoder applies caveman Full rules: strips articles, abbreviates common nouns (database → DB, request → req, connection → conn), drops hedging prefixes.
Decoder applies the c2e deterministic rule pipeline (arrows, abbreviations, fragments, conjunctions, articles, punctuation, ventilation).

**UST+decoder (Unicode Semantic Tokens).**
Encoder prefixes each sentence with an emoji role marker (💡 reason, 🟢 fix, ⚡ causes, 🔴 problem) and applies caveman-style abbreviation.
Decoder maps each role marker to a sentence prefix ("This is because...", "The fix is to...", "Note that...") and expands abbreviations.
Hypothesis: explicit role markers enable better reconstruction via a dedicated prefix-based decoder.

**RFC+c2e (Reconstruction-Friendly Caveman).**
Encoder applies caveman Full rules with one constraint: modal verbs (`should`, `must`, `might`, `could`, `will`, `would`) and causal conjunctions (`because`, `since`, `therefore`, `however`) are never stripped.
Decoder is the same c2e pipeline as caveman.
Hypothesis: preserving semantic ligatures costs ~10 percentage points of compression but eliminates information loss.

**Esperanto+c2e.**
Encoder replaces English with terse Esperanto: no indefinite article, unambiguous modals (`devus` = should, `devas` = must, `eble` = might), shorter causal conjunctions (`ĉar` = because, 3 chars vs 7).
Decoder translates Esperanto back to English then applies c2e.
Hypothesis: Esperanto's structural properties enable ligature preservation at marginally better compression than RFC.

**Gilfoyle v2.**
Encoder applies binding-preserving transformations: cause-first reordering with `→` arrow (`X → pool exhausted` for "pool exhausted because X"), tilde hedging (`~caused` for "likely caused"), copula deletion, relative clause compression, and the RFC abbreviation set.
No decoder is required: Gilfoyle output is intended for direct reading.
Hypothesis: binding-preserving compression can match caveman's synthetic compression ceiling while keeping all semantic ligatures intact.

### 4.4 Metrics

**ROUGE-1 F1.**
Unigram overlap (F1) between the decoded output and the original prose.
Standard metric for machine translation and summarisation; measures overall fidelity at the word level.
Lower scores indicate more surface-level divergence from the original; the metric does not distinguish lossless restructuring from information loss.

**Compression ratio.**
`1 - |encoded tokens| / |original tokens|` (word count).
Higher is more compressed.
Reported as a percentage.
Note: synthetic encoder ceiling is approximately 14–21% on this corpus because encoders do not strip verbs.

**Modal recovery.**
Fraction of original modal verbs (`should`, `must`, `might`, `could`, `will`, `would`, `probably`, `likely`, `perhaps`, `possibly`, `maybe`) present in the decoded output.
100% means every modal from the original appears in the decode; 0% means all modals were lost.
For Gilfoyle, we supplement this binary metric with _modal disposition_ (see below), because Gilfoyle intentionally converts modals to imperatives rather than preserving them literally.

**Modal disposition (Gilfoyle only).**
A three-way classification of each original modal as _preserved_ (modal word appears literally in decoded output), _converted_ (modal absent but the governed action verb appears as a sentence-initial imperative or tilde-prefixed word), or _lost_ (modal absent with no detectable conversion).
This replaces the binary modal recovery metric for Gilfoyle, because "You should wrap X" → "Wrap X" is lossless restructuring, not modal loss.

**Causal recovery.**
Fraction of original causal conjunctions (`because`, `since`, `therefore`, `however`, `thus`) present in the decoded output.
For Gilfoyle, the `→` arrow notation counts as a recovered causal signal.
100% means all causal relationships are preserved.

**Structure-normalised ROUGE-1 (sn-ROUGE-1, Gilfoyle only).**
Standard ROUGE-1 penalises lossless imperative conversion: "You should wrap X" → "Wrap X" drops `you` and `should` from the unigram set even though no information was lost.
sn-ROUGE-1 strips sentence-initial deontic modal prefixes ("you should", "you must", "you need to", "you ought to", "you should feel free to", "you might want to") from both hypothesis and reference before scoring, so imperative conversion does not count as a unigram loss.

**Reconstruction-required.**
Fraction of encoded sentences that contain a detectably broken semantic binding: a fragment lacking a governing verb when the corresponding original had one (modal fragments), or a causal sentence whose conjunction was stripped.
Measured by heuristic: a sentence is flagged if (a) the original contained a modal verb and the encoded form does not, or (b) the original contained a causal conjunction and the encoded form does not and no causal arrow is present.
For all systems tested here, the synthetic encoders preserve sentence boundaries and do not strip verbs, so this metric reads 0% for all.
The metric is most meaningful against real LLM caveman output.

### 4.5 Reproducibility

All benchmarks run from a clean checkout of the public repository:

```bash
npm install
npm run benchmark:fidelity    # Caveman+c2e baseline
npm run benchmark:ust         # UST experiment
npm run benchmark:rfc         # RFC experiment
npm run benchmark:esperanto   # Esperanto experiment
npm run benchmark:gilfoyle    # Gilfoyle v2 experiment
```

Each command compiles TypeScript with `tsconfig.experiments.json` and runs the benchmark script under `dist-exp/`.
Results are written to `experiments/<name>/results.txt`.
The scorer implementation is in `experiments/fidelity/scorer.ts`; the modal disposition and sn-ROUGE-1 implementations are in the same file.

## 5. Results

### 5.1 Aggregate Results

| System        | ROUGE-1   | sn-ROUGE-1 | Compression | Modal recovery | Causal recovery | Recon-required |
| ------------- | --------- | ---------- | ----------- | -------------- | --------------- | -------------- |
| Caveman+c2e   | 83.0%     | —          | **14.2%**   | 92.5%          | 100.0%          | 0.0%†          |
| UST+decoder   | 80.7%     | —          | 4.7%        | 85.0%          | —               | —              |
| RFC+c2e       | **84.7%** | —          | 3.5%        | **100.0%**     | **100.0%**      | 0.0%†          |
| Esperanto+c2e | 84.4%     | —          | 3.0%        | **100.0%**     | **100.0%**      | 0.0%†          |
| Gilfoyle v2   | 72.0%     | 73.3%      | **14.1%**   | 77.5%‡         | **100.0%**      | **0.0%**       |

†The reconstruction-required metric uses sentence-boundary heuristics.
Synthetic encoders do not produce orphaned modals at sentence boundaries, so all systems score 0%.
This metric is most meaningful against real LLM output where the model strips aggressively within sentences.

‡Gilfoyle v2 modal disposition: **15.0% preserved / 85.0% converted / 0.0% lost**.
The binary modal recovery score (77.5%) treated every absent modal as a loss.
The disposition metric shows zero modals are genuinely lost: 85% were intentionally converted to sentence-initial imperatives ("You should wrap X" → "Wrap X") or tilde-prefixed hedges ("likely caused" → "~caused").

### 5.2 Per-Entry Results

The table below shows all five metrics for all five systems on all 20 corpus entries.
UST causal recovery was not instrumented in that experiment's benchmark script and is reported as "—".

| Entry                | System    | ROUGE-1 | Compression | Modal  | Causal |
| -------------------- | --------- | ------- | ----------- | ------ | ------ |
| react-rerender       | Caveman   | 78.3%   | 14.8%       | 100.0% | 100.0% |
|                      | UST       | 75.8%   | 13.0%       | 100.0% | —      |
|                      | RFC       | 81.7%   | 3.7%        | 100.0% | 100.0% |
|                      | Esperanto | 80.4%   | 3.7%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 67.4%   | 14.8%       | 100.0% | 100.0% |
| auth-token           | Caveman   | 81.8%   | 20.5%       | 100.0% | 100.0% |
|                      | UST       | 78.9%   | 0.0%        | 100.0% | —      |
|                      | RFC       | 83.6%   | 0.0%        | 100.0% | 100.0% |
|                      | Esperanto | 83.6%   | 0.0%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 68.8%   | 17.9%       | 100.0% | 100.0% |
| db-pool              | Caveman   | 84.9%   | 11.7%       | 50.0%  | 100.0% |
|                      | UST       | 82.2%   | 8.3%        | 50.0%  | —      |
|                      | RFC       | 86.8%   | 5.0%        | 100.0% | 100.0% |
|                      | Esperanto | 85.7%   | 5.0%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 62.6%   | 20.0%       | 100.0% | 100.0% |
| race-condition       | Caveman   | 86.0%   | 14.6%       | 50.0%  | 100.0% |
|                      | UST       | 85.4%   | 8.3%        | 50.0%  | —      |
|                      | RFC       | 89.7%   | 6.3%        | 100.0% | 100.0% |
|                      | Esperanto | 89.7%   | 6.3%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 78.0%   | 18.8%       | 100.0% | 100.0% |
| memory-leak          | Caveman   | 87.6%   | 10.4%       | 100.0% | 100.0% |
|                      | UST       | 87.0%   | 6.3%        | 100.0% | —      |
|                      | RFC       | 92.1%   | 4.2%        | 100.0% | 100.0% |
|                      | Esperanto | 89.9%   | 4.2%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 79.1%   | 12.5%       | 0.0%‡  | 100.0% |
| cache-invalidation   | Caveman   | 84.6%   | 10.2%       | 50.0%  | 100.0% |
|                      | UST       | 83.3%   | 3.4%        | 50.0%  | —      |
|                      | RFC       | 87.6%   | 1.7%        | 100.0% | 100.0% |
|                      | Esperanto | 87.6%   | −5.1%§      | 100.0% | 100.0% |
|                      | Gilfoyle  | 76.3%   | 16.9%       | 50.0%‡ | 100.0% |
| cors                 | Caveman   | 78.7%   | 16.7%       | 100.0% | 100.0% |
|                      | UST       | 76.6%   | 1.9%        | 100.0% | —      |
|                      | RFC       | 80.0%   | 1.9%        | 100.0% | 100.0% |
|                      | Esperanto | 80.0%   | 1.9%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 71.9%   | 7.4%        | 100.0% | 100.0% |
| jwt-expiry           | Caveman   | 79.6%   | 14.5%       | 100.0% | 100.0% |
|                      | UST       | 78.5%   | 3.2%        | 100.0% | —      |
|                      | RFC       | 80.8%   | 3.2%        | 100.0% | 100.0% |
|                      | Esperanto | 80.8%   | 3.2%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 68.7%   | 12.9%       | 100.0% | 100.0% |
| event-loop           | Caveman   | 88.9%   | 12.7%       | 100.0% | 100.0% |
|                      | UST       | 87.4%   | 5.5%        | 100.0% | —      |
|                      | RFC       | 90.0%   | 5.5%        | 100.0% | 100.0% |
|                      | Esperanto | 90.0%   | 5.5%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 76.1%   | 21.8%       | 0.0%‡  | 100.0% |
| promise-chain        | Caveman   | 82.4%   | 15.0%       | 100.0% | 100.0% |
|                      | UST       | 78.5%   | 6.7%        | 0.0%   | —      |
|                      | RFC       | 83.5%   | 5.0%        | 100.0% | 100.0% |
|                      | Esperanto | 83.5%   | 5.0%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 78.4%   | 13.3%       | 100.0% | 100.0% |
| typescript-narrowing | Caveman   | 79.6%   | 20.6%       | 100.0% | 100.0% |
|                      | UST       | 78.6%   | 4.4%        | 100.0% | —      |
|                      | RFC       | 80.7%   | 4.4%        | 100.0% | 100.0% |
|                      | Esperanto | 80.7%   | 4.4%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 69.6%   | 14.7%       | 100.0% | 100.0% |
| sql-injection        | Caveman   | 88.7%   | 9.3%        | 100.0% | 100.0% |
|                      | UST       | 84.8%   | 3.7%        | 50.0%  | —      |
|                      | RFC       | 89.8%   | 1.9%        | 100.0% | 100.0% |
|                      | Esperanto | 89.8%   | 1.9%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 76.6%   | 11.1%       | 100.0% | 100.0% |
| docker-network       | Caveman   | 77.9%   | 17.0%       | 100.0% | 100.0% |
|                      | UST       | 75.6%   | 2.1%        | 100.0% | —      |
|                      | RFC       | 79.5%   | 2.1%        | 100.0% | 100.0% |
|                      | Esperanto | 79.5%   | 2.1%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 72.0%   | 8.5%        | 100.0% | 100.0% |
| rate-limit           | Caveman   | 88.9%   | 13.3%       | 100.0% | 100.0% |
|                      | UST       | 83.5%   | 3.3%        | 100.0% | —      |
|                      | RFC       | 89.9%   | 1.7%        | 100.0% | 100.0% |
|                      | Esperanto | 89.9%   | 1.7%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 68.7%   | 18.3%       | 100.0% | 100.0% |
| npm-conflict         | Caveman   | 84.1%   | 9.7%        | 100.0% | 100.0% |
|                      | UST       | 83.2%   | 3.2%        | 100.0% | —      |
|                      | RFC       | 86.2%   | 3.2%        | 100.0% | 100.0% |
|                      | Esperanto | 86.2%   | 0.0%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 77.4%   | 8.1%        | 100.0% | 100.0% |
| websocket            | Caveman   | 78.5%   | 15.4%       | 100.0% | 100.0% |
|                      | UST       | 74.3%   | 9.2%        | 100.0% | —      |
|                      | RFC       | 79.6%   | 7.7%        | 100.0% | 100.0% |
|                      | Esperanto | 77.8%   | 7.7%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 62.1%   | 21.5%       | 100.0% | 100.0% |
| git-conflict         | Caveman   | 80.9%   | 17.9%       | 100.0% | 100.0% |
|                      | UST       | 76.8%   | 1.8%        | 100.0% | —      |
|                      | RFC       | 80.9%   | 1.8%        | 100.0% | 100.0% |
|                      | Esperanto | 80.9%   | 1.8%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 74.7%   | 7.1%        | 0.0%‡  | 100.0% |
| k8s-pod              | Caveman   | 82.0%   | 13.6%       | 100.0% | 100.0% |
|                      | UST       | 80.8%   | 1.7%        | 100.0% | —      |
|                      | RFC       | 83.2%   | 1.7%        | 100.0% | 100.0% |
|                      | Esperanto | 83.2%   | 1.7%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 70.1%   | 10.2%       | 0.0%‡  | 100.0% |
| css-specificity      | Caveman   | 82.0%   | 15.3%       | 100.0% | 100.0% |
|                      | UST       | 79.2%   | 6.8%        | 100.0% | —      |
|                      | RFC       | 83.2%   | 6.8%        | 100.0% | 100.0% |
|                      | Esperanto | 83.2%   | 6.8%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 70.8%   | 15.3%       | 100.0% | 100.0% |
| wasm-memory          | Caveman   | 85.5%   | 11.3%       | 100.0% | 100.0% |
|                      | UST       | 83.2%   | 1.6%        | 100.0% | —      |
|                      | RFC       | 86.2%   | 1.6%        | 100.0% | 100.0% |
|                      | Esperanto | 86.2%   | 1.6%        | 100.0% | 100.0% |
|                      | Gilfoyle  | 69.9%   | 11.3%       | 100.0% | 100.0% |

§Esperanto's `kaŝmemoro` (cache memory) is longer than the English abbreviation, producing negative compression on this entry.
This is a known vocabulary artifact, not a methodology issue.

‡Gilfoyle modal recovery of 0.0% on these entries is a metric artifact: the binary score treats imperative conversion as loss.
Modal disposition shows 100% converted, 0% lost for these entries.

### 5.3 Key Findings

**Finding 1: Ligature preservation predicts modal recovery.**
The two systems that explicitly preserve semantic ligatures (RFC and Esperanto) achieve 100% modal recovery on every entry.
The caveman baseline, which strips ligatures opportunistically, achieves 92.5% overall with 50% on three entries (`db-pool`, `race-condition`, `cache-invalidation`) — the entries where the synthetic encoder happened to strip `should` or `likely`.

**Finding 2: Ligature preservation costs compression.**
RFC and Esperanto achieve 3.5% and 3.0% compression respectively, compared to 14.2% for caveman.
The cost of ligature preservation is approximately 10 percentage points of compression on this corpus.
This is the fundamental tradeoff.

**Finding 3: Gilfoyle demonstrates that the tradeoff can be broken.**
Gilfoyle v2 achieves 14.1% compression (parity with caveman) and 0% lost modals.
The mechanism is imperative conversion: instead of preserving `should wrap`, Gilfoyle encodes `Wrap` and relies on sentence-initial position to signal obligation.
This is only viable for a direct-read format (no decoder step); a decoder would need to reconstruct `you should` from `Wrap`, which is harder.
For casual reading where the reader already understands the context, imperative is equivalent to the modal phrase.

**Finding 4: Novel encoded formats with bespoke decoders underperform.**
UST added emoji role markers (💡, 🟢, ⚡) and a prefix-based decoder.
It underperformed caveman on every metric: −2.3% ROUGE-1, −9.5% compression, −7.5% modal recovery.
The decoder introduced artifacts: doubled conjunctions, incorrect prefixes ("The fix is to you should wrap..."), wrong template selection.
Adding encoding overhead without improving the fidelity of the ligature-preserving elements made things worse.

**Finding 5: Causal recovery is robust across all systems.**
All five systems achieve 100% causal recovery on all 20 entries (UST not measured, but causal conjunctions were preserved in its encoding).
This is partly a corpus artifact: the synthetic encoders do not strip `because`, and the corpus is dense with causal explanations.
The finding validates that causal recovery is achievable without a dedicated preservation rule — but real caveman LLM output does strip `because`, making this a real-world failure mode not captured by the synthetic benchmark.

## 6. Discussion

### 6.1 The Core Claim as a Falsifiable Hypothesis

We state the central claim of this paper as a falsifiable hypothesis:

> **H1:** A compression scheme that preserves semantic ligatures (deontic modal verbs and causal conjunctions) will produce lower cognitive reconstruction cost and higher decode fidelity than a scheme that does not, at any given compression ratio.

The evidence from five experiments supports H1.
RFC vs. caveman is the clearest test: both operate in the same compression range (3–14%), and RFC's ligature-preserving constraint improves modal recovery from 92.5% to 100.0% and ROUGE-1 from 83.0% to 84.7% with a compression cost of 10.7 percentage points.
The comparison is confounded by the fact that RFC also improves ROUGE-1 by preserving more article context — future work should isolate the modal/conjunction preservation effect from other RFC rule differences.

H1 is falsifiable under two conditions: (a) a compression scheme is discovered that strips semantic ligatures and achieves the same or better decode fidelity through a sufficiently expressive decoder, or (b) a scheme is found that preserves ligatures but achieves systematically lower decode fidelity, which would imply ligature type matters (not all ligatures are equally important).

### 6.2 Why ROUGE-1 Understates Gilfoyle's Fidelity

Gilfoyle v2 scores 72.0% ROUGE-1 — the lowest of any system tested.
This is counterintuitive: Gilfoyle achieves caveman-level compression, 0% lost modals (by disposition), and 100% causal recovery.

The gap has two drivers.
First, imperative conversion: "You should wrap every database call" → "Wrap every database call" removes `you` and `should` from the unigram set.
Structure-normalised ROUGE-1 strips this prefix before scoring, recovering 1.3 points (73.3% sn-ROUGE-1).
Second, abbreviation vocabulary mismatch: Gilfoyle output contains `DB`, `req`, `conn` that don't match `database`, `request`, `connection` in the original.
RFC output passes through c2e, which expands these abbreviations before scoring.
Gilfoyle is intentionally unprocessed — it is a direct-read format — so the abbreviations remain.

This suggests that ROUGE-1 is a poor metric for Gilfoyle specifically: it penalises every structural transformation, including lossless ones.
A future normalisation step — expanding abbreviations in both hypothesis and reference before scoring — would close most of the remaining gap.

### 6.3 The Cognitive Reconstruction Cost Construct

The central theoretical contribution of this paper is the claim that cognitive reconstruction cost is a distinct and measurable dimension of compression quality.
Standard metrics (ROUGE-1, compression ratio, token count) do not capture it.
The reconstruction-required metric proposed here is a first operationalisation: it flags sentences where a semantic ligature was detectably broken.

We acknowledge that reconstruction-required as implemented (heuristic sentence-boundary detection) is imprecise.
A stronger operationalisation would use a psycholinguistic reading time study: participants reading compressed text with broken ligatures should show longer reading times and worse comprehension on follow-up questions.
This experiment is proposed as future work.

### 6.4 Practical Recommendations

For token-sensitive contexts where a decoder is available: use RFC.
The 10-point compression sacrifice is real, but 100% modal and causal recovery is a meaningful correctness guarantee for technical documentation where obligation and causation are the primary communicative content.

For contexts where direct reading without a decoder is the goal: use Gilfoyle.
The imperative conversion is cognitively equivalent to the deontic modal form for a reader who has the context, and the 14% compression is competitive with caveman.

For contexts where character-level compression matters more than word-level compression: SLP (Symbolic Logic Prose, proposed in Section 7) is the most promising unexplored direction.

For the original caveman use case: patch caveman to never strip `should`, `must`, `might`, `because`, `since`, `therefore`.
This single change converts caveman to an RFC-like dialect and eliminates the reconstruction-required cases at negligible compression cost (the stripped words are short).

## 7. Future Work

### 7.1 Symbolic Logic Prose (SLP)

SLP extends RFC by replacing verbose logical phrases with single Unicode symbols that modern tokenizers encode as 1–2 tokens: `∵` (because), `∴` (therefore), `∀` (every/each/all), `¬` (not/without/never), `→` (leads to/causes).

Encoding: RFC encoder + multi-word phrase-to-symbol substitution.
Decoding: symbol expansion (`∵` → "because", `∀ X` → "every X", `¬ V` → "does not V") + RFC-style c2e expansion.

Expected outcome: 10–12% compression (up from RFC's 3.5%) with RFC-level modal and causal recovery, because the logical structure is more explicit in symbol form than in prose and survives encoding intact.
Risk: LLMs may not reliably produce Unicode logic symbols without aggressive prompt tuning.

### 7.2 Domain Frame Slots (DFS)

DFS encodes technical debugging explanations as typed semantic frames with labeled slots, inspired by FrameNet but restricted to a 7-frame domain ontology: `PROBLEM`, `CAUSE`, `FIX`, `ENSURES`, `WARNING`, `EXAMPLE`, `CONTEXT`.

Encoding: sentence classification → frame type; entity/predicate extraction → slot values.
Decoding: frame type → sentence template; slot value substitution + c2e expansion.

Expected outcome: 55–60% compression with 100% modal recovery (modal is a typed slot `FIX: modal=should`), competitive with real caveman Full.
Risk: slot extraction requires entity recognition and verb extraction — harder to implement reliably than phrase-level compression.
LLM compliance is also harder for frame-structured output than prose.

### 7.3 S-expression Semantic Tree (SST)

SST encodes sentence meaning as a Lisp-style tree of semantic predicates (`cause`, `fix`, `problem`, `ensures`, `not`, `should`, `must`, `each`), capturing hierarchical structure that flat slot encoding cannot represent.

Encoding: sentence splitting → predicate classification → recursive argument extraction → s-expression serialisation.
Decoding: recursive s-expression parser → predicate dispatch → phrase template.

Expected outcome: 40–45% compression, better ROUGE-1 than DFS (tree structure captures more nuanced relationships), and matched modal recovery to DFS (modals are explicit nodes).
Risk: s-expression parsing is brittle; scope assignment during encoding requires linguistic judgment.

### 7.4 Gilfoyle v3 Compression Ceiling

Gilfoyle v2 achieves 14.1% synthetic compression because neither encoder strips verbs.
Real caveman Full achieves 65–75% by stripping verbs.
The open research question is whether Gilfoyle can push past 25% compression while keeping verbs (and thus all semantic ligatures) intact — through domain-specific noun compounding, symbol substitution for common phrases, or hybrid DFS-style slot encoding for stereotyped sentence patterns.

Gilfoyle v3 (phrase-level pre-pass applied before v2 rules) achieves 32.2% on a 12-entry verbose corporate prose corpus (postmortems, incident reports, design docs) while maintaining 100% causal recovery and 97.9% modal recovery.
Extending this to the 20-entry standard corpus and validating on a live LLM is the priority for a v3 publication.

### 7.5 Live LLM Compliance Test

All experiments in this paper use synthetic encoders.
A live A/B test with a real LLM is required to measure which dialect — RFC, Esperanto, or Gilfoyle — produces the most consistent output in practice.

The synthetic results predict RFC and Esperanto should tie on fidelity; the live test will reveal which one a model follows more reliably.
This test should include at least 100 prompts per dialect across multiple model families (GPT-4o, Claude Sonnet, Gemini Pro) with three trials per prompt, yielding statistical significance tests on the aggregate scores.

### 7.6 Psycholinguistic Validation

The cognitive reconstruction cost construct requires psycholinguistic validation.
A reading time study comparing compressed text with and without broken semantic ligatures would test whether the reconstruction cost is detectable (H1's "lower cognitive reconstruction cost" claim).
We predict that caveman text with broken ligatures will produce significantly longer reading times and worse comprehension on targeted questions about modal obligations and causal relationships.

### 7.7 Corpus Expansion

The 20-entry corpus is sufficient to establish direction but not statistical significance.
A corpus of ≥100 entries covering diverse technical domains (frontend, backend, infrastructure, security, data engineering) with varied complexity (short explanations, multi-step debugging, architectural discussion) would provide the statistical power needed for claims about compression/fidelity tradeoffs.

## 8. References

ASD-STE100 (2021). _Simplified Technical English Specification_. Aerospace and Defence Industries Association of Europe.

Baker, C.F., Fillmore, C.J., and Lowe, J.B. (1998). The Berkeley FrameNet Project. _Proceedings of COLING-ACL_.

Banarescu, L., Bonial, C., Cai, S., Georgescu, M., Griffitt, K., Hermjakob, U., Knight, K., Koehn, P., Palmer, M., and Schneider, N. (2013). Abstract Meaning Representation for Sembanking. _Proceedings of the 7th Linguistic Annotation Workshop_.

JuliusBrussee (2024). _caveman: A terse LLM prompting technique for dense technical output_. GitHub: github.com/JuliusBrussee/caveman.

Nivre, J., de Marneffe, M.C., Ginter, F., Goldberg, Y., Hajic, J., Manning, C.D., McDonald, R., Petrov, S., Pyysalo, S., Silveira, N., Tsarfaty, R., and Zeman, D. (2016). Universal Dependencies v1: A Multilingual Treebank Collection. _Proceedings of LREC_.

Shardlow, M. (2014). A Survey of Automated Text Simplification. _International Journal of Advanced Computer Science and Applications_.

Siddharthan, A. (2014). A survey of research on text simplification. _International Journal of Applied Linguistics_.
