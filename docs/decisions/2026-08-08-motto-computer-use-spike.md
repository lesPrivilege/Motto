# motto-computer-use — spike

Evaluating desktop computer-use for Motto, with corrected conclusions.
Repo layout:

```
bin/                        Pinned Peekaboo v3.10.0 release (sha256-verified)
peekaboo/                   Peekaboo source checkout @ v3.10.0 (static audit)
extensions/motto-computer-use/
    index.ts                pi extension: 8-tool allowlist wrapper
    mcp-client.ts           zero-dependency MCP stdio client
    README.md               usage, security model, verification
test/
    smoke.mts               handshake / tools / fail-closed / lifecycle
    netcheck.mts            no network sockets during session
    proctree.mts            single child process, clean stop
    debug-server.mts        raw server inspection
```

## Corrected conclusions (supersedes the earlier draft)

### 1. Kimi Computer Use is not "un-decouplable" — it is "not acceptable as a long-term dependency"

The open-source `kimi-code` repo
(`packages/agent-core-v2/src/app/capability/entries/kimiCu.ts`) publishes the
runtime artifact URLs directly:

- `https://cdn.kimi.com/kimi-computer-use/latest/KimiCU.app.zip`
- `https://cdn.kimi.com/kimi-computer-use/latest/kimi-cu-plugin.zip`
- `.../kimi-computer-use-windows/latest/kimi-cu-win-plugin.zip` (Windows)

These are **anonymously downloadable** (verified: HTTP 200). `KimiCU.app` is a
standalone MCP server: its binary at
`/Applications/KimiCU.app/Contents/MacOS/kimi-cu` accepts `mcp` (and
`mcp -s user`) modes — the code recognizes this exact legacy `mcp.json`
registration and migrates it into plugin wiring, so the protocol layer does not
depend on the Kimi Code agent loop at all.

Therefore the earlier statement "the official MCP server cannot be obtained, it
can only be reverse-engineered from a logged-in install" was **wrong** and is
retracted. The accurate rejection reason is:

> The core `KimiCU.app` runtime is a closed-source binary whose license,
> distribution, and maintenance are not under Motto's control. Adopting it as a
> dependency would leave an unfixable, un-forkable core capability gap. That
> fails Motto's open-source / auditable / long-term-maintenance standard —
> independent of whether it can technically be connected.

### 2. Computer-use servers are NOT freely interchangeable

The host model does the observe–plan–verify loop, but the device server's UI
semantics layer differs materially:

- foreground coordinate clicking vs. process-targeted background input;
- screenshot-only vs. Accessibility tree (+ element IDs, `AXPress`/`AXSetValue`);
- Retina / multi-display / moved-window coordinate correction;
- permission isolation, confirmation, and lifecycle;
- whether it steals focus, the mouse, or the clipboard.

Replacing Kimi's server with an arbitrary one therefore requires a capability
benchmark, not an assumption of equivalence. (This spike chose Peekaboo
specifically because it covers the meaningful subset: background delivery,
Accessibility actions, snapshot-bound coordinates.)

### 3. Candidate triage (static audit results)

| Candidate | Verdict | Evidence |
|---|---|---|
| Kimi official Computer Use | **Rejected** (closed binary) | `kimiCu.ts` (above); CDN artifacts public but binary closed-source |
| `Zooeyii/macos-computer-use-mcp` | **Rejected** | `createExecutor()` always returns `MacOsFallbackExecutor` ("For now, use fallback"); needs cliclick; `request_access` auto-grants requested apps; drag coordinate bugs |
| `macuse-app/macuse-mcp` | **Rejected** | Repo is a wrapper/skills around the separately distributed commercial `Macuse.app` — same closed-runtime problem |
| `PowerBeef/kimi-mac-use-mcp` | **Not relied on** | No stable first-party source found (GitHub 404, not on npm) |
| **`openclaw/Peekaboo` v3.10.0** | **First candidate (accepted for spike)** | MIT; native Swift; Accessibility UI map + element IDs; background input via pid-routed keyboard + AX hit-test clicks; snapshot-bound coordinates with stale-reference rejection; `coordinate_context` in `_meta`; no telemetry; verified no network sockets at runtime |

## Peekaboo static audit highlights (v3.10.0)

- **Background input** (`BackgroundInputDriver.swift`): keyboard via pid-routed
  CGEvents; clicks via AX hit-test + accessibility action (documented reason:
  positioned synthetic clicks are broken on modern macOS — `windowID` routing
  discards location). Guards: process-alive check, exact-window pinning, stale /
  moved-window rejection, `AXIsProcessTrusted` fail-closed. Double/middle click
  unsupported on the background path.
- **MCP surface** (`MCPToolCatalog.swift`): ~27 tools by default, including
  high-permission ones (`agent`, `browser`, `clipboard`, `paste`, `analyze`).
  The wrapper's allowlist is therefore the real security boundary.
- **Images**: MCP `{type:"image", data, mimeType}` blocks map 1:1 to pi's
  `ImageContent`. Verified against the real server.
- **Permissions**: Screen Recording (required), Accessibility, Event
  Synthesizing (optional, for background input).
- **Dependencies**: AXorcist, Tachikoma, Commander, TauTUI, Swiftdansi — all MIT.
- **Network**: MCP child holds zero TCP/UDP sockets during a session (verified
  live). AI/analyze/agent tools are separate and are not exposed by the wrapper.

## Status

- [x] Static audit (source + dependencies) of Peekaboo v3.10.0
- [x] Zero-dep MCP client + 8-tool allowlist extension (type-checks clean)
- [x] Smoke / netcheck / proctree tests against the real pinned binary
  (no permissions granted) — all pass
- [ ] Controlled live test with Screen Recording + Accessibility granted
  (requires user sign-off; see `extensions/motto-computer-use/README.md`)
- [ ] Acceptance report per the criteria in the project notes
