## Consolidated follow-up: EOL-aware copy, a semantic selection sidecar, and a review-first transcript projector

This thread closed with "any custom component would also have to be aware of this and it's too risky of a change for the moment." This comment consolidates three materials from our local dogfooding that sit exactly on that boundary — how to give components an explicit, opt-in awareness of row boundaries and disclosure, without touching session data or model context. The first item is the real-usage case that motivated the middle one.

---

### 1. Usage case: review needs thinking default-collapsed (real-usage evidence)

- In pi 0.84.1, assistant `thinking` blocks render **in full by default**. The only native control is `hideThinkingBlock` (settings / `Ctrl+T`), which is an **all-or-nothing hide** — when hidden, the transcript shows a single `Thinking...` label with no expand affordance; there is no per-entry fold, no preview, and it is not tied to the global `Ctrl+O` tool-expand state.
- During end-of-work review of a real session, large thinking monologues remained in the transcript and drowned the compact per-turn review outline. What review needs is "thinking **default collapsed** — one label, expandable on demand," which the current binary switch cannot express.
- This is exactly a per-entry disclosure concern, i.e. the third material below.

### 2. Material A — EOL-aware rendering (extends this PR directly)

Root cause from our renderer audit of 0.84.1 (`pi-tui` regular + fullscreen):

- pi hard-wraps every logical line and writes an **explicit newline per visual row** (regular mode: `\r\n` per row; fullscreen: autowrap disabled + explicit truncation). Terminal selection therefore copies one newline per visual row — precisely what this PR tried to fix.
- The durable fix is **EOL-aware rendering**: write wrap boundaries as soft EOL (let terminal autowrap continue the row) and write `CRLF` only at real paragraph ends — the Claude-Code-classic / OpenTUI split-scrollback model. This PR's row-tracking is the local approximation of that model.
- Caveats we measured: only exactly-full-width rows can rely on autowrap; hanging-indent rows (used by our review projection) must still `CRLF` → hard. Terminal EOL semantics also differ (iTerm2 vs xterm.js disagree on whether "full-width row + CRLF" is soft or hard), so this needs per-terminal verification.

### 3. Material B — semantic selection sidecar (direct answer to "custom components would also have to be aware")

Rather than forcing every renderer to become byte-level EOL-aware, add an **optional per-visual-row selection projection**. The component that creates the visual line also declares the exact source text and the exact omitted characters between rows:

```ts
export interface SelectionLineProjection {
  text: string;                         // selectable content of this visual row
  joinerToPrevious?: string;            // exact omitted source: "\n" | " " | "" | exact spaces
  selectableColumns?: { start: number; end: number }; // absent => non-selectable
}
export interface RenderedLine {
  display: string;
  selection?: SelectionLineProjection;
}
```

- Components **without** a projection keep the current visual-row fallback; `Box`/`VStack`/`ScrollView`/overlays/clips propagate the sidecar while adjusting coordinates, without reinterpreting source text.
- Once semantic text is reconstructed, the interactive layer should use pi's exported `copyToClipboard(text)` (keeps the existing native/Wayland/X11/OSC52/remote path in one implementation).
- This makes the custom-component awareness that closed this PR **explicit, opt-in, and low-risk**, while canonical content stays byte-identical. Rejected approaches (regex cleanup, width-based joining, `stdout.write` interception, OSC52 rewriting, patching `TuiAltScreen`) all create drift surfaces against upstream.

### 4. Material C — review-first transcript projector (the disclosure layer)

The usage case in §1 generalizes to a presentation-only projector over the whole transcript:

- **Per-entry fold state** keyed by stable entry ID, with a three-level `collapsed → preview → full` policy and **turn-level grouping** that hides underlying rows without replacing model/session data.
- **Separate thinking toggle** in the UI keyboard layer (fold/expand selected entry, smart expand/collapse all).
- Minimal API sketch:

```ts
interface TranscriptProjectionContext {
  entryId: string;
  kind: "user" | "assistant" | "thinking" | "tool" | "custom";
  displayMode: "collapsed" | "preview" | "full";
  isStreaming: boolean; isError: boolean;
  theme: Theme; invalidate(): void;
}
interface TranscriptProjection {
  summary?: Component; preview?: Component; full?: Component;
  defaultMode?: "collapsed" | "preview" | "full";
}
pi.registerTranscriptProjector((entry, context) => TranscriptProjection | undefined);
```

- Recommended default policy: assistant final answer → always `full`; thinking → `label`, bounded head/tail preview, `full` on demand; read/search success → verb+target+count; shell success → command+exit+count; shell failure → command+failure line (never default-hidden); edit/write → path+diff stats; subagent → role+status+duration; permission/error → explicit state (never default-hidden).
- Invariants: session entries and model-facing messages remain byte-for-byte unchanged; fold state is UI state, never inserted into LLM context; unknown entry kinds fail open to the stock renderer; export/transcript mode always has a path to canonical full content.

### 5. The boundaries we hold ourselves to (so the merge stays safe)

- No re-registering of built-in tools; no patching private TUI methods; no interception of `stdout`/OSC 52; no shadow transcript; theme access is semantic-token-only.

---

Happy to split this into separate issues or a design doc if that's preferred; this is a consolidation of materials we were about to file separately, and this PR is the natural thread, so we intentionally did not open a new issue.
