# Claude Code hook integration

Two integration approaches are available.

## Option A — shell pipe (real-time replacement)

Wrap the `claude` command in a shell alias so all output is translated before
you see it:

```bash
# ~/.zshrc or ~/.bashrc
alias claude='claude | c2e'

# With a specific fragment level:
alias claude='claude | c2e --fragment-level 2'
```

This is the highest-fidelity approach — output is translated as it streams.
The trade-off is that you see translated output only, never the original.

## Option B — Stop hook (appended translation block)

This uses Claude Code's `Stop` hook to append a translated block after
the original caveman output.
You see both versions: the live caveman stream as Claude generates it,
then a `📖 Translation:` block once it finishes.

### Setup

1. Install `caveman2english` globally:

```bash
npm install -g caveman2english
# or from the repo: npm link
```

2. Copy or symlink this `settings.json` content into your
   `~/.claude/settings.json` (or project-level `.claude/settings.json`),
   replacing the path with the actual location of `c2e-stop-hook.mjs`:

```jsonc
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/c2e-stop-hook.mjs",
          },
        ],
      },
    ],
  },
}
```

3. Set optional environment variables in your shell profile:

```bash
# Override which c2e binary to use (default: "c2e")
export C2E_BIN="/usr/local/bin/c2e"

# Pass extra flags to c2e, e.g. moderate fragment completion
export C2E_FLAGS="--fragment-level 2"
```

### How the hook works

Claude Code calls the hook script with the conversation transcript as JSON
on stdin when Claude finishes a response.
The script extracts the last assistant message, pipes it through `c2e`, and
writes the translation to stderr, which Claude Code surfaces in the terminal.

The hook's stdout is sent to Claude as additional context; we intentionally
write nothing to stdout so Claude sees no extra input.
