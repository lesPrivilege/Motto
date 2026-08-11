# Upstream proposal: transcript disclosure as a projection

## Problem

Pi can globally expand/collapse tool output and extensions can render custom messages or custom entries. It does not expose a clean extension API for:

- per-entry fold state on built-in assistant/tool transcript entries;
- a three-level `collapsed → preview → full` policy;
- turn-level grouping that can hide the underlying rows without replacing model/session data;
- presentation-only replacement of ordinary assistant message rendering.

Trying to emulate this by re-registering tools couples presentation to execution. Trying to emulate it with `sendMessage()` changes model context.

## Minimal API

```ts
interface TranscriptProjectionContext {
  entryId: string;
  kind: "user" | "assistant" | "thinking" | "tool" | "custom";
  displayMode: "collapsed" | "preview" | "full";
  isStreaming: boolean;
  isError: boolean;
  theme: Theme;
  invalidate(): void;
}

interface TranscriptProjection {
  summary?: Component;
  preview?: Component;
  full?: Component;
  defaultMode?: "collapsed" | "preview" | "full";
}

pi.registerTranscriptProjector(
  (entry, context): TranscriptProjection | undefined => { ... }
);
```

## Required invariants

1. Session entries and model-facing messages remain byte-for-byte unchanged.
2. Fold state is UI state keyed by stable entry ID; it is not inserted into LLM context.
3. Unknown entry kinds fail open to the stock renderer.
4. Errors and permission prompts may not default to fully hidden.
5. Export/transcript mode always has a path to canonical full content.
6. Theme access is semantic-token-only.
7. A projector can decorate or replace rendering, but cannot alter execution, schemas, tool results, or dispatch.
8. The UI owns keyboard/mouse navigation and exposes:
   - fold selected entry;
   - expand selected entry;
   - smart expand/collapse all;
   - separate thinking toggle.

## Recommended default policy

| Entry | Collapsed | Preview | Full |
|---|---|---|---|
| Assistant final answer | full | full | full |
| Thinking | label | bounded head/tail | full |
| Read/search/list success | verb + target + count | head 5 + tail 3 | full |
| Shell success | command + exit + count | tail 5 | full |
| Shell failure | command + failure line | head/tail error | full |
| Edit/write | path + diff stats | first hunk | full diff |
| Permission/error | explicit state + next action | diagnostic | full |
| Subagent | role + status + duration | milestones | transcript |

This follows the same architectural boundary as the extension in this package: canonical data below, review projection above.
