# motto-computer-use

Thin, dedicated MCP wrapper that exposes a **fixed allowlist** of Peekaboo
computer-use tools to Motto (pi), behind a **session-level explicit gate**.
Not a generic MCP host — one server, eight tools, zero runtime dependencies,
fail closed. Default-loaded, but **unarmed until the user approves**.

## Scope

| | |
|---|---|
| Server | [openclaw/Peekaboo](https://github.com/openclaw/Peekaboo) v3.10.0 (MIT) |
| Transport | stdio MCP (protocol `2024-11-05`) |
| Exposed tools | `cu_see`, `cu_image`, `cu_click`, `cu_type`, `cu_scroll`, `cu_hotkey`, `cu_set_value`, `cu_perform_action` |
| Never exposed | shell, browser, clipboard, paste, agent, analyze, capture, list, sleep, inspect_ui, app/window/menu/dock/dialog/space, … (all filtered out by this wrapper) |
| Gate | session-scoped `armed` flag; default **false**; `/computer-use approve` opens it, `/computer-use revoke` closes it, restart resets it |
| Runtime deps | none (hand-rolled newline-delimited JSON-RPC MCP client) |

## Install / use

```bash
# 1. Make the Peekaboo binary available (pinned release, checksum-verified):
scripts/fetch-binaries.sh extensions/motto-computer-use
#    (downloads from the official v3.10.0 release and verifies tar.gz + binary SHA-256)

# 2. Deploy to the pi extension dir (default loading — no -e needed):
./scripts/deploy.sh motto-computer-use
#    Subdirectory index.ts auto-discovery picks it up on next pi start (or /reload).

# 3. Approve per session (the only way to open the gate):
/computer-use approve        # arms + runs a permission preflight and reports status
/computer-use revoke         # disarms; cu_* tools fail closed again
/computer-use status         # gate state, permissions, allowlist, server
```

The pack's `package.json` intentionally has **no `"pi"` manifest field**: the
subdirectory `index.ts` discovery rule is sufficient, and a manifest would add
an unnecessary indirection for a single-entry pack.

Configuration (environment variables):

| Var | Default | Meaning |
|---|---|---|
| `PEEKABOO_BIN` | `peekaboo` | Path to the Peekaboo binary |
| `PEEKABOO_EXPECTED_VERSION` | `3.10.0` | Pinned server version; mismatch fails closed (empty string disables) |
| `PEEKABOO_TOOL_TIMEOUT_MS` | `60000` | Per tool-call timeout |
| `PEEKABOO_STARTUP_TIMEOUT_MS` | `15000` | MCP initialize timeout |
| `PEEKABOO_LOG_LEVEL` | `warn` | Forwarded to the server |

## Security model

- **Session gate is the entry boundary.** `armed` defaults to `false`, is
  per-session and in-memory (never persisted — restarting pi returns to the
  unapproved state). Every `cu_*` tool checks `armed` at the top of its execute
  path and fails closed with guidance to run `/computer-use approve`. The gate
  lives **inside the extension's execute path** (core.ts `runTool`), so no
  harness-side auto-approval mechanism can open it by definition — only the
  `/computer-use approve` user command can. Approval is reachable **only from
  the user command input path**: model output and extension-injected messages
  (`sendUserMessage` / `sendMessage`) cannot dispatch extension commands in the
  pi harness (verified against `@earendil-works/pi-coding-agent` 0.84.1; see
  `reports/PACK-COMPUTER-USE-2-acceptance.md` §3).
- **Allowlist is the tool boundary.** The server advertises ~27 tools by
  default (including `agent`, `browser`, `clipboard`, `paste`, `analyze`). Only
  the 8 above are ever registered with pi; the client additionally refuses to
  call any tool outside the allowlist.
- **Fail closed.** Missing binary, version mismatch, missing Screen Recording /
  Accessibility permission, unexpected server exit, or an allowlisted tool the
  server cannot provide all surface as tool errors (thrown from `execute`, so
  pi marks the result as an error). Nothing is auto-granted or auto-widened.
  Approval opens the gate but does **not** waive per-call permission checks.
- **Structured observation first.** Tool descriptions and `promptGuidelines`
  push the model to `cu_see` (accessibility tree + element IDs) before
  coordinates, and to send full screenshots only when the tree is ambiguous.
- **No network.** Verified live: the child process holds zero TCP/UDP sockets
  during a session. No telemetry, no uploads. (The `peekaboo daemon run`
  Bridge process is only spawned by the **CLI** `peekaboo image` command — not
  by the MCP path — is localhost-only with a unix socket, and did not
  self-idle-exit within the observed window; keep the CLI path out of
  production and use the MCP path.)
- **Clean lifecycle.** The server is spawned lazily on first use and stopped on
  `session_shutdown` / exit. Verified: after stop, no orphan process remains;
  the MCP path does not spawn the Bridge daemon.

## Boundaries (accepted, see reports/)

- **No per-call approval (by design).** The gate is a session-level single
  switch. If real use shows "approved then mis-touch" friction, escalate to
  tiered per-action approval per the ROADMAP usage-trigger clause — not before.
- **Status: ACCEPTED WITH LIMITATIONS** (PACK-COMPUTER-USE-1, 2026-08-08;
  gate change PACK-COMPUTER-USE-2, 2026-08-08).
- `cu_see` observation **activates the target app** (Peekaboo v3.10.0 behavior):
  actions can run in the background, but the observation step is not silent.
- Multi-display coordinate mapping: **NOT TESTED** (single-display env).
- PID-routed background `type`/`hotkey` input: not part of the accepted contract.
- Bare global coordinates do not get reference-bound stale protection.
- Peekaboo's background click path is accessibility-action based (hit-test →
  AXPress). Double-click and middle-click are unsupported on that path
  (server returns an error).
- `set_value` / `perform_action` only appear when Peekaboo's input strategy
  enables action invocation (`actionFirst`/`actionOnly`).

## Coordinate handling

`cu_click` accepts bare `coords` as global logical points, or screenshot-relative
coordinates bound to a `cu_see` snapshot via `coordinate_space` +
`coordinate_reference`. Peekaboo rejects missing, stale, out-of-bounds, or
moved-window references **without dispatching a click** (server-enforced). The
snapshot's `coordinate_context` is surfaced in tool `details`.

## Verification

```bash
# From the repo root — full regression (no permissions needed):
./scripts/regression.sh
# Add --live for the dynamic acceptance (requires granted Screen Recording +
# Accessibility, low-risk apps only):
./scripts/regression.sh --live
```

The non-live suite (gate / smoke / boundary / netcheck / proctree / permcheck)
verifies the gate semantics, the handshake, the allowlist, fail-closed behavior
on missing permissions, and process/network hygiene. The live suite
(`live.mts`, `pi-drive.sh`) runs real capture, background AX actions,
coordinate contracts, and a model-driven see→set_value→see→image loop on a
scratch TextEdit doc. `gate-live.sh` verifies default loading in a real pi
session: unarmed rejection → `/computer-use approve` → success → revoke →
restart returns to unarmed.
