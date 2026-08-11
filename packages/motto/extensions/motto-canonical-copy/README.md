# motto-canonical-copy

A presentation-independent Pi extension for exact clipboard copies from canonical session data.

It is the safe first slice of Motto's clipboard work:

- `/copy-answer` copies the latest assistant answer from the session model;
- `/copy-code` copies the last fenced code block from that answer;
- optional shortcuts can be enabled with environment variables;
- no Pi source files, renderers, themes, tool definitions, or model messages are modified.

The copied text comes from the assistant message, not terminal rows. A paragraph that visually wraps to five rows is therefore copied as its original logical paragraph rather than five newline-separated rows.

## Why this is not a mouse-selection replacement

Current Pi fullscreen mode owns mouse selection and copies automatically on mouse release. However, its clipboard reconstruction still selects rendered visual rows and joins them with `\n`. A pure extension cannot repair that accurately because Pi does not expose selection coordinates, logical line joiners, or a transcript-selection projection to extensions.

This package intentionally does **not**:

- monkey-patch `TuiAltScreen` private methods;
- intercept or rewrite `process.stdout.write` / OSC 52;
- infer soft wraps with punctuation or line-width heuristics;
- re-register built-in tools;
- replace themes or inject invisible terminal markers.

Those approaches are version-fragile or can silently corrupt copied code.

## Recommended operating mode

Use current Pi (`0.84.1` or newer) and enable fullscreen mode for application-owned selection and mouse-up auto-copy:

```json
{
  "tuiMode": "fullscreen"
}
```

This gives the mainstream interaction immediately. Use `/copy-answer` or `/copy-code` whenever exact source fidelity matters, until Pi gains semantic selection projection.

## Install

Copy this directory to:

```text
~/.pi/agent/extensions/motto-canonical-copy/
```

Then run:

```text
/reload
```

It can also be loaded directly:

```text
pi -e /path/to/motto-canonical-copy/index.ts
```

## Optional shortcuts

No shortcut is claimed by default, because terminal copy bindings differ across macOS, Linux, tmux, and remote sessions.

Set one or both before launching Pi:

```text
MOTTO_COPY_ANSWER_SHORTCUT=alt+c
MOTTO_COPY_CODE_SHORTCUT=alt+k
```

The extension registers only the configured shortcuts.

### Shortcut compatibility

Pi's legacy key parser maps `ESC + <single char>` to `alt+<char>` only for lowercase letters, digits, and symbols. So:

- `alt+<lowercase/digit/symbol>` (e.g. `alt+c`, `alt+k`) work in every terminal;
- combinations containing `shift` or `super` (e.g. `alt+shift+c`) need a terminal with **Kitty keyboard protocol** or **modifyOtherKeys** to be transmitted unambiguously; in a legacy terminal the bytes they send are not resolved to that key id, and the shortcut silently does nothing.

Ghostty, kitty, and recent WezTerm (with the protocol enabled) support this; plain xterm, tmux passthrough, and most SSH terminals generally do not. When a configured shortcut contains `shift` or `super`, the extension shows a one-time startup warning in the TUI (a hint, not an error).

## Compatibility boundary

The extension depends only on stable, public Pi APIs:

- `ctx.sessionManager.getBranch()`;
- `pi.registerCommand()`;
- optional `pi.registerShortcut()`;
- exported `copyToClipboard()`.

It uses no theme tokens at all, so `motto`, `motto-dark`, `motto-light`, and third-party themes remain unaffected.

The complete mouse-selection design is documented in `../../../docs/research/UPSTREAM-SELECTION-PROJECTION.md`; the transcript-disclosure projection proposal lives in `../../../docs/research/UPSTREAM-PROPOSAL.md`。

体例正典见仓内 [`docs/MOTTO.md`](../../../docs/MOTTO.md)「复制体例」节。部署位为 pi 扩展目录,由 `scripts/maint/deploy.sh` 统一拷贝。
