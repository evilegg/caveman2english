# Experiment Proposals: Beyond Prose Compression

## Background

Three experiments have established a baseline:

| System      | ROUGE-1 | Compression | Modal recovery |
| ----------- | ------- | ----------- | -------------- |
| Caveman+c2e | 83.0%   | 14.2%       | 92.5%          |
| UST+decoder | 80.7%   | 4.7%        | 85.0%          |
| RFC+c2e     | 84.7%   | 3.5%        | 100.0%         |

The key finding from RFC: **preserving semantic load-bearing words produces
better mechanical reconstruction than stripping them and hoping the expander
recovers them from context.**
The key finding from UST: **adding a novel encoded format with a bespoke
decoder underperforms the simpler prose pipeline.**

The experiments below test three fundamentally different hypotheses about
what the right _representation_ for compressible-but-recoverable technical prose
looks like.
They are ordered from most prose-like (incremental from RFC) to most
structural (furthest from prose).

---

## Survey of Relevant Prior Art

### Abstract Meaning Representation (AMR)

AMR encodes sentence meaning as a rooted directed acyclic graph.
Nodes are concepts; edges are labeled semantic roles (`:ARG0`, `:ARG1`,
`:cause`, `:polarity`, `:mod`).
It is used in academic NLP as a semantic annotation format.

A simple causal sentence produces something like:

```
(exhaust-01
  :ARG1 (pool :mod (connect-01 :ARG1 (database)))
  :cause (open-01
    :ARG0 (request :quant every)
    :ARG1 (connection)
    :manner (release-01 :polarity - :ARG1 connection)))
```

**Problem for this use case:** AMR is verbose — roughly 120–150% the token
count of the original sentence.
AMR-to-text generation (the "decoder" step) is its own research problem;
the best generators (SPRING, Penman) achieve ~40 BLEU, which is acceptable
for machine translation but produces unnatural prose.
Full AMR is ruled out: its overhead exceeds the compression gained.

### Universal Dependencies (UD)

UD encodes grammatical relationships as typed arcs: `nsubj`, `obj`, `advmod`,
`advcl:because`, `aux`.
It is language-universal and unambiguous syntactically.

**Problem for this use case:** dependency structure captures _syntax_, not
_semantics_.
`should wrap` and `wrap` have the same dependency structure; UD loses modality.
It solves the wrong problem — our reconstruction errors are semantic, not
syntactic.

### Frame Semantics / FrameNet Slot-Filling

FrameNet defines ~1,200 named semantic frames (Causation, Cure, Warning,
etc.) with labeled slot structures.
Encoding a sentence as `FRAME:Causation CAUSE:exhaustion EFFECT:pool_failure`
is compact and unambiguous.

**Problem for this use case:** FrameNet is general-purpose; a domain-specific
frame ontology for technical debugging would need to be designed.
Slot labels add token overhead; the full FrameNet vocabulary is too large for
an LLM to learn from a system prompt alone.
A stripped-down, domain-specific slot-filling scheme is worth experimenting
with — see **Experiment 2** below.

### Simplified Technical English (STE / ASD-STE100)

STE is an existing industry standard for aerospace maintenance manuals: ~875
approved words, active voice only, ≤20 words per sentence, no subordinate
clauses.
It achieves ~10–15% length reduction through forced brevity, not semantic
abstraction.

**Not useful here:** STE is a readability standard, not a compression format.
It still requires a human reader to parse; it doesn't enable mechanical
expansion.
Its compression is similar to RFC but without modal/conjunction preservation.

### First-Order Logic (FOL)

FOL encodes propositions as predicates with explicit quantifiers, operators,
and negation:
`EXHAUSTED(pool) ← ∀r∈REQ: OPENS(r,conn) ∧ ¬RELEASES(r,conn)`

**Partially useful:** FOL is maximally precise — every logical relationship is
explicit.
But LLMs generate invalid FOL frequently (mismatched parentheses, type errors,
malformed quantifiers).
The decoder (FOL → prose) also needs to handle an infinite class of formulae,
which is a research problem.
A restricted subset of FOL — a few operators, no quantifier binding — might
be tractable.
This motivates **Experiment 3** below.

---

## Proposed Experiments

### Experiment 1: Symbolic Logic Prose (SLP)

**Branch:** `experiment/slp-dialect`

#### Concept

RFC keeps all semantic load-bearing _words_.
SLP keeps those words and additionally replaces verbose logical _phrases_ with
single Unicode symbols that modern tokenizers encode as 1–2 tokens:

| Phrase                           | Symbol | Tokens |
| -------------------------------- | ------ | ------ |
| because / since / due to         | ∵      | 1      |
| therefore / so / thus            | ∴      | 1      |
| every / each / all / for each    | ∀      | 1      |
| not / without / fails to / never | ¬      | 1      |
| and (logical)                    | ∧      | 1      |
| leads to / causes / results in   | →      | 1      |

SLP encoding of the db-pool example:

```
pool exhausted ∵ ∀ req opens conn ¬ releases
should wrap ∀ DB call in try-finally [ensures: conn released ∀ err]
```

Compare to RFC:

```
DB connection pool is being exhausted because each request opens connection
without releasing it
You should wrap every DB call in try-finally block to ensure connections always
released even when error occurs
```

SLP saves an additional 6–8 tokens per sentence over RFC by replacing
multi-word phrases with single symbols.
Unlike caveman, which strips logical content, SLP _reencodes_ it with higher
density.

#### Hypothesis

Unicode logic symbols are unambiguous (∵ can only mean "because"), while
natural language connectives are polysemous (caveman's `→` means several
things; "because" buried in prose can be dropped accidentally).
SLP should achieve better compression than RFC (closer to 10–12%) while
maintaining equal or better modal recovery, because the logical structure is
more explicit and survives the encoding step intact.

#### Validation

1. Implement `encodesSLP(text)`: RFC encoder + multi-word phrase → symbol
   substitution.
2. Implement `decodeSLP(text)`: symbol expansion (`∵` → "because", `∀ X` →
   "every X", `¬ V` → "does not V" / "without V-ing") + RFC-style c2e
   expansion.
3. Run the same 20-entry corpus benchmark.
4. Compare ROUGE-1, compression, modal recovery vs RFC and caveman.

#### Expected outcome

SLP should beat RFC on compression (more symbols = fewer tokens) and match RFC
on modal recovery (both preserve `should`/`must`/`might`).
ROUGE-1 might drop slightly because the decoder must infer whether `¬ V` means
"does not V" or "without V-ing" — but this is deterministic given the
grammatical context.

#### Risk factors

- LLMs may not reliably output `∵`/`∀`/`¬` instead of prose equivalents — the
  skill prompt must be very explicit.
- Tokenizer behavior varies: GPT tokenizers may encode `∀` differently than
  Claude's.
- `¬ releases` vs `¬ release` (verb form) requires normalization in the decoder.

---

### Experiment 2: Domain Frame Slots (DFS)

**Branch:** `experiment/dfs-dialect`

#### Concept

Technical debugging explanations have a narrow, predictable semantic structure.
Rather than compressing prose, DFS encodes the _semantic content_ into a small
set of typed frames with labeled slots.
This is FrameNet-inspired but designed specifically for the corpus domain
(software debugging, architecture explanations).

A 7-frame ontology covers the corpus:

| Frame     | Slots                                         |
| --------- | --------------------------------------------- |
| `PROBLEM` | `what`, `where`, `severity?`                  |
| `CAUSE`   | `effect`, `condition`, `agent?`, `frequency?` |
| `FIX`     | `modal`, `action`, `target`, `mechanism?`     |
| `ENSURES` | `outcome`, `scope?`                           |
| `WARNING` | `risk`, `condition`, `severity?`              |
| `EXAMPLE` | `instance`, `context?`                        |
| `CONTEXT` | `fact`                                        |

Encoding of the db-pool example:

```
CAUSE: effect=pool.exhausted condition=req.opens(conn).¬releases agent=each_req
FIX: modal=should action=wrap target=DB_calls mechanism=try-finally
ENSURES: outcome=conn.released scope=on_error
```

Compare to original prose (≈60 words):

```
The database connection pool is being exhausted because each request is opening
a new connection without releasing it. This is likely caused by missing error
handling in the query function, which prevents connections from returning to the
pool. You should wrap every database call in a try-finally block to ensure
connections are always released, even when an error occurs.
```

DFS encoding: ~25 tokens.
That is ~60% compression — close to caveman Full — while preserving causality,
modality, and scope explicitly in typed slots.

#### Hypothesis

Typed slots make each semantic component independently addressable: `modal=should`
can never be lost the way "should" is lost in caveman prose.
A template-based decoder that maps `FIX: modal=X action=Y target=Z` →
"You X Y Z" should achieve near-perfect modal recovery and high ROUGE-1, at
compression rates competitive with caveman.

#### Validation

1. Design the 7-frame ontology from corpus analysis; verify it covers all 20
   entries.
2. Implement `encodeDFS(text)`: sentence classification → frame type,
   entity/predicate extraction → slot values, abbreviation compression on
   slot values.
3. Implement `decodeDFS(text)`: frame-type → sentence template, slot value
   substitution, c2e expansion on slot values.
4. Benchmark against all prior experiments.

#### Expected outcome

DFS is the most structured approach and should achieve the highest modal recovery
(100%, because `modal=should` is explicit) and the best compression (the frame
syntax is very compact).
ROUGE-1 may be lower than prose-based approaches because template sentences
are shorter and less natural than the originals.
The real test is whether the slot extraction (synthetic encoder) is accurate —
this is harder than phrase-level compression.

#### Risk factors

- Slot extraction requires entity recognition, verb extraction, and frame
  classification — harder to implement reliably than prose transformation.
- Templates produce formulaic prose; ROUGE-1 will under-reward naturalness.
- Frame coverage: a 7-frame ontology may not cover all sentence types in the
  corpus, leaving some sentences unclassified.
- LLM compliance: getting a live LLM to output valid DFS consistently is harder
  than RFC, because the format is more foreign.

---

### Experiment 3: S-expression Semantic Tree (SST)

**Branch:** `experiment/sst-dialect`

#### Concept

ASTs in programming languages represent code as a tree of typed nodes with
typed children.
SST applies the same idea to prose meaning: represent the semantic content
as a Lisp-style s-expression tree where:

- Each node is a semantic predicate (`cause`, `problem`, `fix`, `ensures`,
  `warning`, `each`, `not`)
- Leaf nodes are abbreviated noun phrases or verb phrases
- Modal verbs are explicit nodes wrapping their scope

```scheme
(cause
  (problem pool.exhausted)
  (and
    (each req (opens conn))
    (not (releases conn))))
(fix (should (wrap every.DB_call try-finally)))
(ensures conn.released on_error)
```

Unlike DFS (which encodes into a flat key-value schema), SST encodes the
_hierarchical_ structure of the meaning.
The `(each req ...)` node makes the universal quantification explicit and
scoped to `req`; the `(not (releases conn))` node marks negation at exactly
the right scope.
This is the closest the existing experiments have come to a true AST.

Token count for the db-pool example: ~35–40 tokens vs ~65 in the original.
That's ~40–45% compression while being structurally complete.

Encoding comparison:

| Format   | db-pool encoding                                                                       | Tokens |
| -------- | -------------------------------------------------------------------------------------- | ------ |
| Original | "The database connection pool is being exhausted because…"                             | ~65    |
| Caveman  | "DB connection pool being exhausted because each req opens conn…"                      | ~55    |
| RFC      | "DB connection pool being exhausted because each req opens connection without…"        | ~52    |
| DFS      | `CAUSE: effect=pool.exhausted condition=req.opens(conn).¬releases agent=each_req`      | ~25    |
| SST      | `(cause (problem pool.exhausted) (and (each req (opens conn)) (not (releases conn))))` | ~35    |

SST sits between DFS (most compressed, least natural) and RFC (least
compressed, most natural) in the tradeoff space.

#### Hypothesis

Explicit tree structure captures scope, negation, and quantification in ways
that prose cannot without verbose phrasing.
`(not (releases conn))` is unambiguous; "without releasing" is not (does it
mean "failed to release" or "intentionally skipped release"?).
A recursive tree decoder that traverses the s-expression and maps each predicate
to a phrase should produce more accurate prose than a linear expander working on
compressed prose.

This approach directly answers the user's question about ASTs: an s-expression
semantic tree is a _meaning_ AST, not a syntax AST.
It encodes the predicate-argument structure of the sentence rather than its
grammatical parse tree, giving it the benefits of structural representation
without the verbosity of AMR.

#### Validation

1. Define the predicate vocabulary (~15 predicates: `cause`, `fix`, `problem`,
   `ensures`, `warning`, `example`, `context`, `each`, `not`, `should`,
   `must`, `might`, `and`, `or`, `if`).
2. Implement `encodeSST(text)`: sentence splitting → predicate classification
   → recursive argument extraction → s-expression serialization with
   abbreviations on leaf values.
3. Implement `decodeSST(text)`: recursive s-expression parser → predicate
   dispatch → phrase template, c2e expansion on leaf values.
4. Benchmark against all prior experiments.

#### Expected outcome

SST should match DFS on modal recovery (both use explicit node types for
modality) but achieve better ROUGE-1 because the tree structure captures more
nuanced relationships (scope, negation, quantification) that DFS's flat slots
cannot represent.
Compression will be between DFS and RFC.

The real test is whether the synthetic encoder can reliably extract
predicate-argument structure.
Leaf-node quality (how well entity/predicate extraction works) is the main
variable.

#### Risk factors

- S-expression parsing is brittle: a single mismatched parenthesis breaks
  the decoder.
- Predicate vocabulary design is hard: too few predicates → imprecision, too
  many → LLM can't remember them.
- The scope decisions in the encoder are subtle: should `(not (releases conn))`
  be inside or outside `(each req ...)`? Both are semantically valid but produce
  different decoded sentences.
- LLM compliance: s-expressions are less natural to LLMs than prose or
  key-value pairs; the skill prompt must include many examples.

---

## Comparison Framework

All experiments should use the existing 20-entry corpus and report the same
four metrics:

| Metric          | Definition                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ROUGE-1 F1      | Unigram overlap between decoded output and original                                                                            |
| Compression     | `1 - len(encoded) / len(original)` (character count)                                                                           |
| Modal recovery  | Fraction of original modals present in decoded output                                                                          |
| Causal recovery | NEW: fraction of causal conjunctions (because/since/∵) present in decoded output — specifically tracks what RFC proved matters |

The causal recovery metric is new but warranted: RFC showed that causal
conjunctions are as important as modals.
Adding it makes the benchmark more sensitive to the specific semantic content
these experiments are designed to preserve.

## Ranking the experiments by expected payoff

| Experiment | Expected ROUGE-1 | Expected compression | Modal recovery | Implementation risk |
| ---------- | ---------------- | -------------------- | -------------- | ------------------- |
| SLP        | ~84% (≈RFC)      | ~10–12%              | 100%           | Low                 |
| DFS        | ~78–80%          | ~55–60%              | 100%           | Medium              |
| SST        | ~80–83%          | ~40–45%              | 100%           | High                |

**Recommended order:** SLP first (incremental, low risk, high compression
payoff), then SST (AST hypothesis, most theoretically interesting), then DFS
(most structured, highest implementation cost).

SLP is the most actionable: it extends RFC with a handful of symbol
substitution rules, uses the same decoder pipeline, and directly tests whether
symbol density beats word density for compressed prose.
If SLP beats RFC on compression without sacrificing fidelity, it becomes the
recommended dialect for token-sensitive contexts.

SST is the most theoretically interesting: it directly answers whether an
AST-like representation of meaning is more lossless than prose representation.
The predicate vocabulary of ~15 nodes is small enough to fit in a system
prompt, and the decoder is mechanically derivable from a grammar rather than
requiring learned heuristics.

DFS is the most aggressive compression attempt: 55–60% at 100% modal recovery
would substantially outperform caveman on both dimensions.
But the slot extraction problem is harder than phrase-level compression, and
the risk of poor coverage on edge cases is real.
