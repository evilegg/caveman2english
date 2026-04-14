# caveman2english

Expands [caveman](https://github.com/JuliusBrussee/caveman) LLM output back into readable English prose.
Post-processes compressed output into natural sentences — deterministically, no API calls required.

## Before / After

Caveman compresses LLM output 65–75% by stripping articles, conjunctions, and hedging.
The savings are real; the output is hard to share or re-read:

**Caveman output (raw):**

```
DB connection pool exhausted. each req opens new connection w/o releasing.
missing err handling in query fn → conns not returning to pool.
should wrap every DB call in try-finally block. ensures conns always released even on err.
```

**After `c2e`:**

```
The database connection pool is exhausted.
Each request opens a new connection without releasing it.
Missing error handling in the query function causes connections not to return to the pool.
You should wrap every database call in a try-finally block.
This ensures connections are always released, even on an error.
```

Five translation patterns c2e handles automatically:

| Pattern                        | Caveman input                       | c2e output                                              |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------- |
| Noun-phrase fragment           | `missing auth token`                | `The authentication token is missing.`                  |
| Arrow notation                 | `cache miss → wrong render`         | `A cache miss causes wrong rendering.`                  |
| Abbreviation expansion         | `DB conn pool exhausted`            | `The database connection pool is exhausted.`            |
| Modal stripping recovery       | `should wrap in try-finally`        | `You should wrap in a try-finally block.`               |
| Conjunction stripping recovery | `each req opens conn w/o releasing` | `Each request opens a connection without releasing it.` |

---

## Claude Code hook — 2-minute setup

The primary use case: translate Claude's caveman responses to readable prose in your terminal, while the compressed version streams live.

**1. Install c2e globally:**

```bash
npm install -g caveman2english
```

**2. Copy the hook script:**

```bash
curl -o ~/.claude/hooks/c2e-stop-hook.mjs \
  https://raw.githubusercontent.com/evilegg/caveman2english/main/examples/claude-code-hook/c2e-stop-hook.mjs
chmod +x ~/.claude/hooks/c2e-stop-hook.mjs
```

Or copy `examples/claude-code-hook/c2e-stop-hook.mjs` from this repo manually.

**3. Register the hook in `~/.claude/settings.json`:**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/c2e-stop-hook.mjs"
          }
        ]
      }
    ]
  }
}
```

**That's it.** After Claude finishes each response, a `📖 Translation:` block appears in your terminal with the expanded prose.

The original caveman output still streams live — the translation is appended below it once the full response is done.

**Optional env vars:**

```bash
C2E_BIN=/path/to/c2e          # override binary location
C2E_FLAGS="--fragment-level 2" # pass extra flags to c2e
```

---

## Install

```bash
npm install -g caveman2english
```

## CLI usage

```bash
# Pipe any caveman output through c2e
echo "DB connection pool exhausted. each req opens new connection. wrap in try-finally." | c2e

# From a file
cat response.txt | c2e

# Control fragment completion aggressiveness
echo "missing auth token. check env vars." | c2e --fragment-level 2
```

## Options

```
--fragment-level 0-3    Fragment completion aggressiveness (default: 1)
--no-abbreviations      Skip abbreviation expansion
--no-fragments          Skip fragment completion
--no-ventilate          Skip one-sentence-per-line formatting
--no-tasklist           Skip GFM task list conversion for imperative sequences
--tasklist-min-run <n>  Min consecutive imperatives to trigger task list (default: 2)
--backend claude|ollama Enable LLM expansion for long responses
--expand-threshold <n>  Word count before LLM kicks in (default: 300)
```

## Config

User config lives in `~/.c2e.json`.
All CLI options are available as config keys:

```json
{
  "fragmentLevel": 2,
  "disableRules": ["ventilate"],
  "extraAbbreviations": {
    "svc": "service",
    "infra": "infrastructure"
  },
  "backend": "claude",
  "expandThreshold": 200
}
```

Priority: explicit CLI flag > `~/.c2e.json` > built-in default.

---

## Research

Five experiments tested whether alternative encoding schemes could outperform plain caveman on reconstruction fidelity.
The key finding: stripping semantic load-bearing words (modal verbs, causal conjunctions) produces genuinely unrecoverable information loss.

See [RESEARCH.md](RESEARCH.md) for the full methodology, results table, and open problems.
See [experiments/README.md](experiments/README.md) to run the benchmarks or add a new experiment.

### Results summary

| System        | ROUGE-1   | Compression | Modal recovery | Causal recovery |
| ------------- | --------- | ----------- | -------------- | --------------- |
| Caveman+c2e   | 83.0%     | **14.2%**   | 92.5%          | 100.0%          |
| UST+decoder   | 80.7%     | 4.7%        | 85.0%          | —               |
| RFC+c2e       | **84.7%** | 3.5%        | **100.0%**     | **100.0%**      |
| Esperanto+c2e | 84.4%     | 3.0%        | **100.0%**     | **100.0%**      |
| Gilfoyle v2   | 72.0%     | **14.1%**   | 77.5%†         | **100.0%**      |

† Gilfoyle v2 encodes `might`/`likely`/`probably` as `~outcome` (tilde prefix) and converts `should` to imperatives.
The Gilfoyle-aware metric counts `~` markers and imperative sentences as recovered signals — 77.5% reflects actual semantic preservation.
Raw prose-only modal recovery is ~15%.

### Which approach to use

**Caveman + c2e** — token volume is the constraint; content is factual/structural (API docs, code walkthroughs).

**RFC + c2e** — content carries epistemic weight: debugging explanations, security advisories, architectural trade-offs.
`should` vs `must` vs `might` changes what the reader does next.
RFC is the recommended default for most technical dialogue.

**Esperanto + c2e** — RFC compliance is unreliable from a live LLM.
Esperanto gives the model a real grammar to fall back on.

**Gilfoyle v2** — output will be read directly by a human with no decoder.
Produces imperative prose, `~`-hedged uncertainty, cause-first `→` arrows, and GFM task lists.
No c2e required.
Achieves caveman-level compression (14.1%) while preserving all semantic ligatures.

**Not UST** — definitively worse than plain caveman on every metric.
