# Upstream proposal: semantic selection projection for Pi TUI

## Problem statement

Pi fullscreen now provides application-owned drag selection, double-click word selection, triple-click line selection, auto-scroll, and automatic clipboard copy on mouse release.

The remaining fidelity problem is structural: clipboard text is reconstructed from rendered visual rows. Every selected row is currently joined with `\n`, even when a row boundary was introduced only by TUI word wrapping. This can corrupt prose, shell commands, URLs, and code when pasted elsewhere.

A terminal or post-processing extension cannot reliably distinguish:

- a hard source newline;
- a wrap at discarded whitespace;
- a wrap inside a token or CJK run;
- a decorative UI row;
- a Markdown prefix that is visual but not source text.

## Design principle

The renderer that creates a visual line must also provide the source-selection projection for that line.

This is the same separation used by mature review-first TUIs:

```text
visual cells                 semantic clipboard projection
────────────                 ─────────────────────────────
colors, padding, borders  →  exact source text
soft-wrapped rows          →  exact joiner between source slices
UI-only labels            →  non-selectable
```

## Backwards-compatible API shape

Add an optional selection sidecar to rendered/layout lines rather than changing session messages or tool results.

```ts
export interface SelectionLineProjection {
  /** Text copied for the selectable content of this visual row. */
  text: string;

  /** Exact source text between this row and the previous projected row. */
  joinerToPrevious?: string;

  /** Visible-column range that maps to `text`; absent means non-selectable. */
  selectableColumns?: { start: number; end: number };
}

export interface RenderedLine {
  display: string;
  selection?: SelectionLineProjection;
}
```

The existing `Component.render(width): string[]` remains supported. Components without a projection use the current visual-row fallback. New or upgraded components can provide a parallel projection through an optional method or an additive layout API.

```ts
interface Component {
  render(width: number): string[];
  renderSelection?(width: number): Array<SelectionLineProjection | undefined>;
}
```

`Box`, `VStack`, `ScrollView`, overlays, and clipping propagate the sidecar while adjusting row and column coordinates. They do not reinterpret source text.

## Joiner semantics

`joinerToPrevious` contains the exact omitted source characters, not a guessed enum:

- hard source line break: `"\n"`;
- ordinary word wrap where one source space was consumed: `" "`;
- mid-token, URL, or CJK wrap: `""`;
- multiple original spaces: the exact spaces;
- component boundary: renderer-defined source separator;
- decorative line: no selection projection.

This preserves partial selections across wraps as well as whole-block copies.

## Clipboard transport

Once semantic text is reconstructed, the interactive layer should call Pi's exported `copyToClipboard(text)` rather than emitting OSC 52 directly. That retains Pi's native macOS/Windows path, Wayland/X11 tools, Termux handling, remote detection, payload limit, and OSC 52 fallback in one implementation.

## Extension boundary

Expose capability, not private renderer state:

```ts
interface ExtensionUIContext {
  readonly selectionCapabilities?: {
    applicationOwned: boolean;
    semanticProjection: boolean;
    copyOnRelease: boolean;
  };
}
```

An optional presentation-only callback may be useful for policy, but it must receive already reconstructed semantic text:

```ts
registerSelectionCopyHandler?(
  handler: (event: { text: string; source: "drag" | "word" | "line" | "block" }) =>
    string | Promise<string>,
): () => void;
```

Motto would use only the public capability/policy layer. It would not own Pi's mouse protocol, screen buffer, wrapping engine, clipboard transport, or theme rendering.

## Required regression cases

1. Prose visually wrapped over several rows copies with source spaces, not row newlines.
2. A hard Markdown paragraph/newline remains a newline.
3. A long shell command or URL split mid-token is rejoined with an empty string.
4. CJK text wrapped without spaces is rejoined without introducing spaces or newlines.
5. Code soft wraps preserve the exact original line.
6. Partial drag across a soft wrap produces the exact source substring.
7. ANSI styles, OSC 8 links, padding, borders, timestamps, and status labels are not copied unless semantically declared.
8. Tool output hard line boundaries remain hard boundaries.
9. tmux, SSH, local macOS, Windows, Wayland, and X11 use the common clipboard backend.
10. Theme switching changes only paint; copied bytes remain identical.

## Rejected implementation strategies

- regex or punctuation-based newline cleanup;
- joining rows merely because they reached terminal width;
- global `stdout.write` interception;
- decoding and rewriting arbitrary OSC 52 payloads;
- prototype patching TypeScript-private `TuiAltScreen` methods;
- terminal-specific copy configuration as the product contract;
- re-rendering canonical content in an extension-only shadow transcript.

All can either corrupt code or create a permanent drift surface against Pi upstream.
