/**
 * Smoke test for motto-computer-use's MCP client against a real Peekaboo server.
 *
 * No system permissions are granted by this test. It verifies:
 *  1. MCP initialize handshake + server version
 *  2. tools/list exposes the allowlisted tools
 *  3. `permissions` tool returns a readable status
 *  4. `image` fails closed without Screen Recording (server-side error surfaced)
 *  5. clean stop leaves no orphan `peekaboo` process
 *
 * Usage:
 *   PEEKABOO_BIN=/abs/path/to/peekaboo node --experimental-strip-types smoke.mts
 */

import { McpStdioClient } from "../mcp-client.ts";
import { execFileSync } from "node:child_process";

const BIN = process.env.PEEKABOO_BIN ?? "peekaboo";
const EXPECTED = process.env.PEEKABOO_EXPECTED_VERSION ?? "3.10.0";
const ALLOWLIST = ["see", "image", "click", "type", "scroll", "hotkey", "set_value", "perform_action"];

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const logs: string[] = [];
const client = new McpStdioClient(BIN, 60_000, 15_000, (m) => logs.push(m));

try {
  // 1. Handshake + version
  const info = await client.start();
  check("initialize handshake", info.version !== undefined, `server version=${info.version}`);
  check(`server version matches ${EXPECTED}`, info.version === EXPECTED, `got ${info.version}`);

  // 2. tools/list
  const tools = await client.listTools();
  const missing = ALLOWLIST.filter((t) => !tools.includes(t));
  check("allowlisted tools present", missing.length === 0, missing.length ? `missing: ${missing.join(",")}` : `${tools.length} tools total`);
  check("permissions tool present", tools.includes("permissions"));

  // 3. permissions status. Peekaboo marks the response isError=true when Screen
  //    Recording is missing while still returning readable status text.
  const perms = await client.callTool("permissions", {});
  const permsText = perms.content.map((b) => (b.type === "text" ? String(b.text ?? "") : "")).join("\n");
  check("permissions returns status text", /Screen Recording:.*(Granted|Not Granted)/i.test(permsText), permsText.split("\n")[1]?.trim());
  const screenRecordingGranted = /Screen Recording:.*Granted/i.test(permsText);
  if (!screenRecordingGranted) {
    check("permissions marked isError when screen recording missing", perms.isError === true, `isError=${perms.isError}`);
  } else {
    console.log(`SKIP  permissions-isError check — Screen Recording is granted (isError=${perms.isError})`);
  }

  // 4. image: server-side fail-closed when Screen Recording is missing; real
  //    capture path when granted. Both are wrapper-relevant behavior.
  const img = await client.callTool("image", { format: "data", max_dimension: 400 });
  const imgText = img.content.map((b) => (b.type === "text" ? String(b.text ?? "") : "")).join("\n");
  if (!screenRecordingGranted) {
    check("image isError without screen recording", img.isError === true);
    check("image error mentions screen recording", /[Ss]creen [Rr]ecording/.test(imgText), imgText.slice(0, 120));
  } else {
    const imgBlock = img.content.find((b) => b.type === "image");
    const png = imgBlock && typeof imgBlock.data === "string" &&
      Buffer.from(imgBlock.data, "base64").subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    check("image succeeds and returns a real PNG when screen recording is granted", !!png, imgBlock ? `mime=${imgBlock.mimeType}` : "no image block");
    console.log(`      server image result (granted state): isError=${img.isError}, content types: ${img.content.map((b) => b.type).join(",")}`);
  }

  // 5. lifecycle: stop and confirm no orphan
  const before = processPids("peekaboo");
  await client.stop();
  await new Promise((r) => setTimeout(r, 500));
  const after = processPids("peekaboo");
  const orphans = after.filter((p) => !before.includes(p));
  check("clean stop, no new orphan peekaboo process", orphans.length === 0, orphans.length ? `left: ${orphans.join(",")}` : "none");
  check("client reports not running after stop", !client.running);
} catch (e) {
  console.error("SMOKE TEST CRASHED:", e);
  failures++;
  console.error("--- server stderr tail ---");
  console.error(client.recentStderr());
} finally {
  await client.stop();
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);

function processPids(name: string): number[] {
  try {
    const out = execFileSync("/usr/bin/pgrep", ["-f", name], { encoding: "utf8" });
    return out.split("\n").filter(Boolean).map(Number);
  } catch {
    return [];
  }
}
