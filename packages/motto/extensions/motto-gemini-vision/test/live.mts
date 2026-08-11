/**
 * Live smoke test for motto-gemini-vision.
 *
 * Runs ONLY when a Google credential is available locally: it reads the
 * "google" api-key from pi's credential store (~/.pi/agent/auth.json, or
 * PI_CODING_AGENT_DIR/auth.json), with a GEMINI_API_KEY env fallback for
 * portable/CI setups. The key is never printed. Without any credential it
 * prints a SKIP and exits 0, so default regression never fails on it.
 *
 * Flow: generate a small, valid 8x8 solid-red PNG with a verifiable visual
 * element → call the real tool pipeline (runTool) against the real Gemini
 * Interactions API → verify non-empty text identifying the color → record
 * model, status, duration and token usage (never base64 or the key) → clean up.
 *
 * Live failures are reported as failures; a mocked test can never stand in for
 * a live pass.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { runTool } from "../gemini.ts";
import { makePng } from "./fixtures.mjs";

async function resolveApiKey() {
  // 1. Unified single source (the canonical store now):
  //    ~/.config/motto/credentials/google (MOTTO_CREDENTIALS_DIR override).
  const credDir = process.env.MOTTO_CREDENTIALS_DIR || join(homedir(), ".config", "motto", "credentials");
  try {
    const key = (await readFile(join(credDir, "google"), "utf8")).split("\n")[0].trim();
    if (key) return key;
  } catch {
    // fall through
  }
  // 2. Legacy pi auth.json (rollback / pre-unification setups).
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  try {
    const auth = JSON.parse(await readFile(join(agentDir, "auth.json"), "utf8"));
    const cred = auth?.google;
    if (cred && cred.type === "api_key" && typeof cred.key === "string" && cred.key.length > 0) {
      return cred.key;
    }
  } catch {
    // fall through
  }
  // 3. Env fallback for portable/CI setups.
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

const apiKey = await resolveApiKey();
if (!apiKey) {
  console.log(
    "SKIP  live smoke — no Google credential in ~/.config/motto/credentials/google (or legacy auth.json / GEMINI_API_KEY)",
  );
  process.exit(0);
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const dir = await mkdtemp(join(tmpdir(), "motto-vision-live-"));
const png = makePng(8, 8, [255, 0, 0]);
const imagePath = join(dir, "live-red.png");
await writeFile(imagePath, png);

let result;
try {
  const started = Date.now();
  result = await runTool(
    { path: imagePath, question: "What is the solid color of this image? Reply with the color name only." },
    { cwd: dir, apiKey },
    process.env,
  );
  const elapsed = Date.now() - started;
  console.log(`live: model=${result.details.model} status=${result.details.status} durationMs=${result.details.durationMs} (wall ${elapsed}ms) usage=${JSON.stringify(result.details.usage)}`);

  check("live returns text-only content", Array.isArray(result.content) && result.content.length === 1 && result.content[0].type === "text");
  const text = result.content[0].text;
  check("live returns non-empty text", typeof text === "string" && text.trim().length > 0);
  check("live identifies the placed visual element (solid red)", /\b(red|crimson|scarlet|maroon|vermilion)\b/i.test(text), `model said: ${text.slice(0, 80)}`);
} catch (err) {
  check("live call succeeded", false, err instanceof Error ? err.message : String(err));
}

await rm(dir, { recursive: true, force: true });
console.log(failures === 0 ? "LIVE SMOKE: PASS" : "LIVE SMOKE: FAIL");
process.exit(failures === 0 ? 0 : 1);
