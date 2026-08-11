/**
 * Gate unit test for motto-computer-use (session-level armed gate).
 *
 * Hermetic: no system permissions and no real server needed. Uses a bogus
 * binary so any server interaction fails fast with ENOENT; the gate itself
 * must fire BEFORE any server spawn, which is exactly what this test proves.
 *
 * Covers (PACK-COMPUTER-USE-2):
 *  1. unarmed -> all 8 allowlisted tools fail closed with /computer-use
 *     approve guidance in the error text;
 *  2. approve() arms even when the permission preflight cannot reach the
 *     server (approval is user intent; permissions stay fail-closed per call);
 *  3. after approve, the gate no longer blocks (the error, if any, is a
 *     server/spawn error, not the gate error);
 *  4. revoke() re-arms the gate;
 *  5. a fresh instance starts unarmed (per-session, not persisted).
 */

import { ComputerUse, TOOL_ALLOWLIST } from "../core.ts";

const BOGUS_BIN = "/nonexistent/motto-cu-peekaboo";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function makeCu(): ComputerUse {
  return new ComputerUse(
    {
      binary: BOGUS_BIN,
      expectedVersion: "", // version check needs a server; bogus binary never gets there
      toolTimeoutMs: 2_000,
      startupTimeoutMs: 2_000,
      logLevel: "warn",
    },
    () => {},
  );
}

async function gateErrorOf(tool: string): Promise<Error | null> {
  const cu = makeCu();
  try {
    await cu.runTool(tool, {});
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
  return null;
}

function isGateError(err: Error | null): boolean {
  return (
    err !== null &&
    /not approved/.test(err.message) &&
    /computer-use approve/.test(err.message) &&
    !/ENOENT|spawn/.test(err.message)
  );
}

// --- 1. unarmed -> all 8 tools fail closed with guidance ------------------
for (const tool of TOOL_ALLOWLIST) {
  const err = await gateErrorOf(tool);
  check(`unarmed: ${tool} fails closed with approve guidance`, isGateError(err), err?.message ?? "no error");
}

// --- 2. approve arms even when preflight cannot reach the server ----------
{
  const cu = makeCu();
  const before = cu.isArmed;
  const result = await cu.approve();
  check("approve arms the session gate", !before && cu.isArmed);
  check("approve returns a preflight result object", result !== undefined && typeof result.permissions === "object");
  check(
    "approve reports preflight failure for bogus binary (does not block approval)",
    typeof result.preflightError === "string" && result.preflightError.length > 0,
    result.preflightError ?? "no preflightError",
  );

  // --- 3. after approve, the gate no longer blocks --------------------------
  let err: Error | null = null;
  try {
    await cu.runTool("see", {});
  } catch (e) {
    err = e instanceof Error ? e : new Error(String(e));
  }
  check("after approve: gate open (error is server/spawn, not the gate)", err !== null && !isGateError(err), err?.message ?? "no error");

  // --- 4. revoke re-arms the gate -------------------------------------------
  cu.revoke();
  check("revoke clears armed", !cu.isArmed);
  err = null;
  try {
    await cu.runTool("see", {});
  } catch (e) {
    err = e instanceof Error ? e : new Error(String(e));
  }
  check("after revoke: gate closed again with guidance", isGateError(err), err?.message ?? "no error");
}

// --- 5. fresh instance starts unarmed (per-session, not persisted) --------
{
  const cu = makeCu();
  check("fresh instance starts unarmed", !cu.isArmed);
}

console.log(failures === 0 ? "\ngate: ALL PASS" : `\ngate: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
