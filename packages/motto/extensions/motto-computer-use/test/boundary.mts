/**
 * Acceptance #6 (wrapper-level degradation) and #7 (tool boundary).
 * These need no system permissions: they validate the wrapper's fail-closed
 * logic and allowlist enforcement directly.
 */
import { ComputerUse } from "../core.ts";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const cu = new ComputerUse();

// --- #7 tool boundary -----------------------------------------------------
// Server advertises ~27 tools; the wrapper must refuse everything outside its
// 8-tool allowlist, even if asked directly (defense in depth).
const banned = ["agent", "browser", "clipboard", "paste", "analyze", "shell", "capture", "list", "sleep", "inspect_ui", "app", "window", "menu", "dock", "dialog", "space", "move", "swipe", "drag"];
for (const name of banned) {
  let threw = false;
  try {
    await cu.runTool(name as never, {});
  } catch (e) {
    threw = /not in the motto-computer-use allowlist/.test(e instanceof Error ? e.message : "");
  }
  check(`runTool refuses "${name}"`, threw);
}

// Allowlisted tool names are the only reachable surface.
import { TOOL_ALLOWLIST } from "../core.ts";
console.log(`allowlist reachable: ${TOOL_ALLOWLIST.join(", ")}`);

// --- #6 wrapper-level permission degradation ------------------------------
// Simulate revoking Screen Recording at the wrapper boundary: the preflight
// must fail closed BEFORE any server call (no silent fallback to another path).
// (Server-side enforcement was verified separately in test/smoke.mts.)
try {
  const c = new ComputerUse();
  await c.refreshPermissions(); // load the real snapshot
  // Override the snapshot to simulate "Screen Recording revoked".
  (c as unknown as { permissions: unknown }).permissions = { screenRecording: false, accessibility: true };
  let threw = false;
  let msg = "";
  try {
    await c.runTool("image", { format: "data", max_dimension: 200 });
  } catch (e) {
    threw = true;
    msg = e instanceof Error ? e.message : String(e);
  }
  check("image fails closed when Screen Recording revoked (preflight)", threw, msg.slice(0, 80));
  check("message explains grant path", /Screen Recording permission is missing/.test(msg));

  (c as unknown as { permissions: unknown }).permissions = { screenRecording: true, accessibility: false };
  threw = false;
  msg = "";
  try {
    await c.runTool("click", { query: "anything" });
  } catch (e) {
    threw = true;
    msg = e instanceof Error ? e.message : String(e);
  }
  check("click fails closed when Accessibility revoked (preflight)", threw, msg.slice(0, 80));
  check("message explains grant path", /Accessibility permission is missing/.test(msg));
  await c.stop();
} catch (e) {
  console.error("degradation test crashed:", e);
  failures++;
}

console.log(failures === 0 ? "\nBOUNDARY + DEGRADATION: ALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
