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

- [ ] Deterministic rule pipeline (all 7 rules)
- [ ] CLI with `--backend none` (deterministic only)
- [ ] Streaming stdin→stdout pipe
- [ ] `--backend ollama` integration
- [ ] `--backend claude` integration (haiku)
- [ ] LLM auto-trigger by word count threshold
- [ ] Tests for all rules + integration
- [ ] `.claude/hooks` example config

## Future

- Watch mode for Claude Code conversation logs
- VS Code extension that translates inline
- Configurable rule toggling (e.g. `--no-abbreviations`)
- User-defined abbreviation overrides via `~/.c2e.json`
- Wenyan-mode support (the classical Chinese variant of caveman)
