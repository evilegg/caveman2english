# caveman2english — Design Document

## Problem

[JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) is a prompt-engineering skill
that instructs LLMs to output terse, fragment-heavy prose to reduce output tokens by 65–75%.
The tradeoff: the output is hard to read for humans who didn't opt into it.

This project is a **lightweight post-processing tool** that expands caveman output back into
readable English without losing the token-saving benefits of the technique.

## Goals

1. **Primary**: deterministic, rule-based expansion that works offline with no LLM calls.
2. **Secondary**: optional LLM expansion for long/nuanced responses where deterministic rules fall short.
3. **Integration**: work as a streaming pipe in the Claude Code terminal.
4. **Pluggable**: deterministic default; ollama or Claude API as optional upgrade backends.

## Non-goals

- Perfect semantic reversal (caveman is intentionally lossy).
- Replacing caveman — the savings stay, we just post-process.
- Heavy NLP dependencies or trained models.

## Feasibility

Caveman transformations cluster into two categories:

| Category                            | Reversible? | Strategy                     |
| ----------------------------------- | ----------- | ---------------------------- |
| Arrow notation (`→`)                | Yes         | Simple regex substitution    |
| Tech abbreviations (DB, auth, etc.) | Yes         | Static dictionary            |
| Missing conjunctions / articles     | Partially   | Heuristic insertion          |
| Dropped fragments → full sentences  | Partially   | Pattern-based verb injection |
| Dropped hedging / caveats           | No          | LLM expansion only           |
| Shortened synonyms                  | Sometimes   | Dictionary if common         |

Deterministic expansion can recover ~80% of readability from Full-mode caveman.
Ultra-mode output benefits more from an LLM pass.
LLM expansion is expected to be needed <5% of responses.

## Architecture

```
stdin (caveman text)
      │
      ▼
 ┌─────────────┐
 │  Tokenizer  │  Split into logical blocks (code fence aware)
 └──────┬──────┘
        │
        ▼
 ┌─────────────────┐
 │  Rule Pipeline  │  Ordered deterministic transforms (see below)
 └──────┬──────────┘
        │
        ├── response is short? ──► stdout (done)
        │
        └── response is long AND --expand set?
                    │
                    ▼
             ┌───────────────┐
             │  LLM Backend  │  pluggable: none | ollama | claude
             └──────┬────────┘
                    ▼
                 stdout
```

### Deterministic Rule Pipeline

Transforms applied in order, code blocks are skipped throughout:

1. **Arrow expansion** — `X → Y` → `X, which leads to Y`
2. **Abbreviation expansion** — static dictionary (DB, auth, fn, cfg, env, etc.)
3. **Fragment sentence completion** — bare noun phrases get `is`/`are` injected
4. **Conjunction restoration** — sentence-initial nouns after periods get `Also,` / `Additionally,`
5. **Article heuristic** — insert `a`/`an` before known uncountable technical nouns
6. **Sentence capitalization** — ensure first word of each sentence is capitalized
7. **Period normalization** — ensure sentences end with `.`/`?`/`!`/`:`

### LLM Expansion

Triggered when:

- `--expand` flag is set, AND
- response length exceeds `--expand-threshold` (default: 300 words)

Prompt strategy: wrap caveman text in a system instruction asking the model to expand
to natural prose while preserving all technical content and code blocks exactly.

## CLI Interface

```
caveman2english [options]

Options:
  -b, --backend <name>          LLM backend: none | ollama | claude (default: none)
  -m, --model <name>            Model for LLM backend (default: llama3.2 / claude-haiku-4-5)
  -u, --url <url>               Ollama base URL (default: http://localhost:11434)
  -e, --expand                  Enable LLM expansion for long responses
  -t, --expand-threshold <n>    Word count threshold for LLM expansion (default: 300)
  -s, --stream                  Stream output token-by-token (default: true)
  -V, --version                 Print version
  -h, --help                    Show help

Environment variables:
  ANTHROPIC_API_KEY             Required when --backend claude
  OLLAMA_URL                    Override --url
  C2E_EXPAND_THRESHOLD          Override --expand-threshold
```

### Usage examples

```bash
# Pipe a single caveman response
echo "new obj ref each render. inline obj prop = new ref. wrap in useMemo." | caveman2english

# Real-time pipe with Claude Code (add to settings.json hooks or shell alias)
claude | caveman2english --stream

# LLM expansion for long responses, using local ollama
claude | caveman2english --expand --backend ollama --model llama3.2

# LLM expansion via Claude API (uses haiku for cost)
claude | caveman2english --expand --backend claude
```

### Claude Code integration

Add a shell alias or use Claude Code's `PostToolUse` hook to pipe all assistant output:

```jsonc
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [{ "type": "command", "command": "caveman2english" }],
      },
    ],
  },
}
```

## File Structure

```
caveman2english/
├── src/
│   ├── index.ts           entry point / CLI
│   ├── expand.ts          deterministic rule pipeline
│   ├── rules/
│   │   ├── arrows.ts      → notation expansion
│   │   ├── abbreviations.ts  abbreviation dictionary + expander
│   │   ├── fragments.ts   fragment sentence completion
│   │   ├── conjunctions.ts   conjunction restoration
│   │   └── punctuation.ts    capitalization + period normalization
│   ├── backends/
│   │   ├── base.ts        LlmBackend interface
│   │   ├── ollama.ts      ollama backend
│   │   └── claude.ts      Claude API backend
│   └── types.ts           shared types
├── test/
│   ├── expand.test.ts
│   ├── rules/
│   │   ├── arrows.test.ts
│   │   ├── abbreviations.test.ts
│   │   ├── fragments.test.ts
│   │   └── punctuation.test.ts
│   └── integration.test.ts
├── DESIGN.md
└── package.json
```

## MVP Scope

- [x] Deterministic rule pipeline (7 rules: arrows, abbreviations, fragments, conjunctions, articles, punctuation, ventilate)
- [x] CLI with `--backend none` (deterministic only)
- [x] Streaming stdin→stdout pipe
- [x] `--backend ollama` integration
- [x] `--backend claude` integration (haiku)
- [x] LLM auto-trigger by word count threshold
- [x] Tests for all rules + integration (89 passing)
- [x] `.claude/hooks` example config (`examples/claude-code-hook/`)

## Experiments

Three experiments were run on feature branches to evaluate alternative approaches.
Each used a 20-entry technical corpus and a synthetic encoder to avoid live API calls.
Full results and source code live on the respective branches.

### Fidelity Benchmark (`experiment/fidelity-benchmark`)

Baseline: how well does deterministic c2e recover original prose from synthetic caveman?

| Metric         | Level 1 | Level 2 | Level 3 |
| -------------- | ------- | ------- | ------- |
| ROUGE-1        | 82.3%   | 83.0%   | 83.0%   |
| Compression    | 14.2%   | 14.2%   | 14.2%   |
| Modal recovery | 92.5%   | 92.5%   | 92.5%   |

Modal recovery at 92.5% is inflated because the synthetic encoder retains `should`
(which caveman Full actually strips).
Fragment rules never fired because the synthetic encoder left verbs intact.

### UST Experiment (`experiment/ust-language`)

Hypothesis: replacing caveman with emoji role markers (🔴=problem, 🟢=fix, 💡=reason)
preserves semantic structure and enables better reconstruction.

| System      | ROUGE-1 | Compression | Modal recovery |
| ----------- | ------- | ----------- | -------------- |
| Caveman+c2e | 83.0%   | 14.2%       | 92.5%          |
| UST+decoder | 80.7%   | 4.7%        | 85.0%          |

**Result: UST underperforms on all three metrics.**
Emoji markers add character overhead without improving fidelity.
The decoder introduces artifacts (doubled conjunctions, redundant sentence prefixes).
The structural metadata is preserved but the reconstruction quality is worse.

### RFC Experiment (`experiment/rfc-dialect`)

Hypothesis: keeping modal verbs (`should`/`must`/`might`/`likely`) and causal
conjunctions (`because`/`but`/`however`) in the encoded form improves reconstruction
while compressing everything else identically to caveman Full.

| System      | ROUGE-1 | Compression | Modal recovery |
| ----------- | ------- | ----------- | -------------- |
| Caveman+c2e | 83.0%   | 14.2%       | 92.5%          |
| RFC+c2e     | 84.7%   | 3.5%        | **100.0%**     |

**Result: RFC hypothesis confirmed.**
RFC achieves perfect modal recovery and +1.7% ROUGE-1 at the cost of lower compression
(3.5% vs 14.2%).
Round-trips are clean, natural prose with no decoder artifacts.

The compression trade-off is real: RFC saves ~3–4% of characters vs the original,
compared to caveman's ~14%.
Whether that trade-off is worthwhile depends on context — for structured debugging
explanations where `should`/`must`/`might` carry critical nuance, RFC is the better
dialect.
For maximum token savings with acceptable fidelity, plain caveman+c2e remains the
right choice.

### Key Findings

1. **Deterministic c2e works well** — 83% ROUGE-1 on real-world technical corpus.
2. **Don't add a custom decoder** — the UST experiment shows that a novel encoded
   format with a custom decoder underperforms the simpler caveman+c2e pipeline.
3. **Preserve semantic load-bearing words** — RFC proves that keeping modals and
   conjunctions in the encoded form produces better mechanical reconstruction than
   stripping them and hoping the expander recovers them from context.
4. **Fragment rules are underutilised** — the synthetic encoder doesn't strip verbs,
   so fragment completion never fires. Real caveman output at Ultra mode would benefit
   more from levels 2 and 3.

## Future

- [x] Configurable rule toggling (`--no-arrows`, `--no-abbreviations`, `--no-fragments`, `--no-conjunctions`, `--no-articles`, `--no-ventilate`)
- [x] User-defined abbreviation overrides via `~/.c2e.json`
- [x] Watch mode (`--watch <file>`) for conversation logs or any appended file
- [x] Multiple fragment completion levels (`--fragment-level 0-3`)
- [ ] VS Code extension that translates inline
- [ ] Wenyan-mode support (the classical Chinese variant of caveman)
