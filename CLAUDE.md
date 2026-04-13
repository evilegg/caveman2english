# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # tsc — compile src/ → dist/
npm test               # vitest run — full suite
npm run test:watch     # vitest — interactive watch
npm run lint           # tsc --noEmit — type-check only

# Run a single test file
npx vitest run test/rules/arrows.test.ts

# Smoke-test the CLI after building
echo "fix auth flow. cache miss → wrong render." | node dist/index.js
echo "fix auth flow." | node dist/index.js --no-abbreviations --no-ventilate
```

## Architecture

The core transform is `expandDeterministic(text, opts?)` in `src/expand.ts`.
It splits input into alternating **text** and **code** segments (fenced blocks + inline spans are never touched), applies an ordered pipeline of `Rule` objects to every text segment, then rejoins.

### Rule pipeline (applied in order)

| Step | File                     | What it does                                                                          |
| ---- | ------------------------ | ------------------------------------------------------------------------------------- |
| 1    | `rules/arrows.ts`        | `→` / `->` / `=>` → prose phrase                                                      |
| 2    | `rules/abbreviations.ts` | static dict expansion; factory `createAbbreviationsRule(extra)` merges user overrides |
| 3    | `rules/fragments.ts`     | fragment completion; factory `createFragmentsRule(level)` selects 0–3                 |
| 4    | `rules/conjunctions.ts`  | injects "Also," before continuation sentences                                         |
| 5    | `rules/articles.ts`      | inserts `a`/`an` after prepositions before bare tech nouns                            |
| 6    | `rules/punctuation.ts`   | capitalisation + terminal period normalisation                                        |
| 7    | `rules/ventilate.ts`     | one sentence per line; blank lines between paragraphs                                 |

**All rules receive plain text only** — `expand.ts` handles code-fence segmentation before rules run.
Rules must be written as if code blocks don't exist.

Rule names must match exactly for `--no-<name>` / `disableRules` to work.
Fragment rule names include the level: `fragments(off)`, `fragments(conservative)`, `fragments(moderate)`, `fragments(aggressive)`.

### Adding a new rule

1. Create `src/rules/myrule.ts` exporting a `Rule` object (or factory function).
2. Import it in `src/expand.ts` and add it to the `all` array in `buildRules()`.
3. Add tests in `test/rules/myrule.test.ts`.

### Config & CLI

- `src/config.ts` loads `~/.c2e.json` and `mergeConfig(cliOpts, userConfig)` resolves priority:
  explicit CLI flag > `~/.c2e.json` > built-in default.
- Pass `Partial<ExpandOptions>` (not full `ExpandOptions`) from the CLI so unset flags don't shadow config-file values.
- `ExpandOptions` is the fully-resolved type; `UserConfig` is the `~/.c2e.json` schema.

### LLM backends

Implement `LlmBackend` from `src/backends/base.ts`.
The backend's `expand(text)` receives already-deterministically-expanded text.
Triggered only when `--expand` is set AND input word count ≥ `expandThreshold`.

### Claude Code hook

See `examples/claude-code-hook/` — a `Stop` hook that extracts the last assistant
message from the conversation JSON, pipes it through `c2e`, and writes a
`📖 Translation:` block to stderr.
