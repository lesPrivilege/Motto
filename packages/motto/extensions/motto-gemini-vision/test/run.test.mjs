/**
 * runTool end-to-end — tool result contract, error mapping, abort/timeout,
 * no-retry, no-leak guarantees (items 4, 5, 14, 38–47 of the work order).
 * Network is mocked; the image pipeline runs against real temp files.
 */

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { realpath } from "node:fs/promises";
import { GEMINI_ENDPOINT, runTool } from "../gemini.ts";
import {
  cleanupTempDirs,
  completedBody,
  installFetch,
  jsonResponse,
  makeJpeg,
  makeTempDir,
  PNG_1x1_RED,
  textResponse,
  trackTempDir,
  writeFixture,
} from "./fixtures.mjs";

const ENV = {
  GEMINI_API_KEY: "secret-key-xyz",
  MOTTO_VISION_MODEL: "gemini-3.6-flash",
  MOTTO_VISION_TIMEOUT_MS: "5000",
};

const QUESTION = "Describe the visible state of this screenshot.";

after(async () => await cleanupTempDirs());

test("success: text-only content + correct details, fetch called once", async () => {
  const dir = trackTempDir(await makeTempDir());
  const imgPath = await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(200, completedBody("A red pixel.")));
  try {
    const res = await runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV);
    assert.deepEqual(res.content, [{ type: "text", text: "A red pixel." }]);
    assert.equal(res.details.model, "gemini-3.6-flash");
    assert.equal(res.details.imagePath, await realpath(imgPath));
    assert.equal(res.details.mimeType, "image/png");
    assert.equal(res.details.bytes, PNG_1x1_RED.length);
    assert.equal(res.details.status, "completed");
    assert.deepEqual(res.details.usage, { total_input_tokens: 130, total_output_tokens: 12, total_tokens: 142 });
    assert.equal(typeof res.details.durationMs, "number");
    assert.ok(res.details.durationMs >= 0);
    assert.equal(mock.calls.length, 1); // fetch called exactly once
  } finally {
    mock.restore();
  }
});

test("details never contain the API key or base64", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(200, completedBody("ok")));
  try {
    const res = await runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV);
    const serialized = JSON.stringify(res);
    assert.ok(!serialized.includes("secret-key-xyz"), "API key leaked into the tool result");
    assert.ok(!serialized.includes(PNG_1x1_RED.toString("base64")), "base64 leaked into the tool result");
  } finally {
    mock.restore();
  }
});

test("missing GEMINI_API_KEY fails before any network request", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(200, completedBody()));
  try {
    await assert.rejects(
      () => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, {}),
      /Google Gemini API key is not configured/,
    );
    assert.equal(mock.calls.length, 0, "fetch must not be called without a key");
  } finally {
    mock.restore();
  }
});

test("pi-resolved local credential is used without an environment key", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(200, completedBody("A red pixel.")));
  try {
    const res = await runTool(
      { path: "shot.png", question: QUESTION },
      { cwd: dir, apiKey: "local-auth-key" },
      {},
    );
    assert.deepEqual(res.content, [{ type: "text", text: "A red pixel." }]);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].init.headers["x-goog-api-key"], "local-auth-key");
  } finally {
    mock.restore();
  }
});

test("missing file fails before any network request", async () => {
  const dir = trackTempDir(await makeTempDir());
  const mock = installFetch(() => jsonResponse(200, completedBody()));
  try {
    await assert.rejects(() => runTool({ path: "nope.png", question: QUESTION }, { cwd: dir }, ENV), /image not found/);
    assert.equal(mock.calls.length, 0, "fetch must not be called for a missing file");
  } finally {
    mock.restore();
  }
});

test("directory path fails before any network request", async () => {
  const dir = trackTempDir(await makeTempDir());
  const mock = installFetch(() => jsonResponse(200, completedBody()));
  try {
    await assert.rejects(() => runTool({ path: ".", question: QUESTION }, { cwd: dir }, ENV), /not a regular file/);
    assert.equal(mock.calls.length, 0, "fetch must not be called for a directory");
  } finally {
    mock.restore();
  }
});

test("Google JSON error is surfaced safely (HTTP status + provider status + message)", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() =>
    jsonResponse(400, { error: { code: 400, message: "model not available for image input", status: "INVALID_ARGUMENT" } }),
  );
  try {
    await assert.rejects(
      () => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV),
      /HTTP 400.*provider status INVALID_ARGUMENT.*model not available for image input/,
    );
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("non-JSON error body still reports the HTTP status", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => textResponse(502, "<html>bad gateway</html>"));
  try {
    await assert.rejects(() => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV), /HTTP 502/);
  } finally {
    mock.restore();
  }
});

test("provider message is truncated to ~500 chars", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const long = "x".repeat(2000);
  const mock = installFetch(() => jsonResponse(429, { error: { code: 429, message: long, status: "RESOURCE_EXHAUSTED" } }));
  try {
    await assert.rejects(
      () => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV),
      (err) => {
        assert.match(err.message, /HTTP 429/);
        assert.ok(err.message.includes("x".repeat(500)), "must include the first 500 chars");
        assert.ok(err.message.includes("…"), "truncation ellipsis present");
        assert.ok(err.message.length < 650, `error message stays bounded (got ${err.message.length})`);
        return true;
      },
    );
  } finally {
    mock.restore();
  }
});

test("API key, base64, and request body never leak into error messages", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() =>
    jsonResponse(500, { error: { code: 500, message: "internal error", status: "INTERNAL" } }),
  );
  try {
    await assert.rejects(
      () => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV),
      (err) => {
        const s = String(err.message);
        assert.ok(!s.includes("secret-key-xyz"), "key leaked into error");
        assert.ok(!s.includes(PNG_1x1_RED.toString("base64")), "base64 leaked into error");
        assert.ok(!s.includes(QUESTION), "request body text leaked into error");
        return true;
      },
    );
  } finally {
    mock.restore();
  }
});

test("user abort and tool timeout are distinguishable", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);

  // --- abort path: the external pi signal fires first ---
  const controller = new AbortController();
  const abortMock = installFetch(
    (url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  try {
    const pending = runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV, controller.signal);
    await new Promise((r) => setTimeout(r, 20)); // let the fetch call start
    controller.abort();
    await assert.rejects(pending, /request aborted/);
  } finally {
    abortMock.restore();
  }

  // --- timeout path: no external signal, the tool timeout fires ---
  const timeoutEnv = { ...ENV, MOTTO_VISION_TIMEOUT_MS: "1100" };
  const timeoutMock = installFetch(
    (url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
      }),
  );
  try {
    await assert.rejects(
      () => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, timeoutEnv),
      /timed out after 1s/,
    );
  } finally {
    timeoutMock.restore();
  }
});

test("429 is not retried", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(429, { error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } }));
  try {
    await assert.rejects(() => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV), /HTTP 429/);
    assert.equal(mock.calls.length, 1, "429 must not trigger a retry");
  } finally {
    mock.restore();
  }
});

test("5xx is not retried", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(503, { error: { code: 503, message: "unavailable", status: "UNAVAILABLE" } }));
  try {
    await assert.rejects(() => runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, ENV), /HTTP 503/);
    assert.equal(mock.calls.length, 1, "5xx must not trigger a retry");
  } finally {
    mock.restore();
  }
});

test("mime detected by content flows into the request", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "mismatched.png", makeJpeg()); // .png file, JPEG content
  const mock = installFetch(() => jsonResponse(200, completedBody("ok")));
  try {
    const res = await runTool({ path: "mismatched.png", question: QUESTION }, { cwd: dir }, ENV);
    assert.equal(res.details.mimeType, "image/jpeg");
    const body = JSON.parse(mock.calls[0].init.body);
    assert.equal(body.input[0].content[1].mime_type, "image/jpeg");
  } finally {
    mock.restore();
  }
});

test("hostile endpoint env vars are ignored — no redirect surface for the API key", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(200, completedBody("ok")));
  try {
    // Any endpoint-like env var must be inert: the key can only ever travel
    // to the fixed production endpoint (the provider stub redirect lives
    // solely in the test's fetch wrapper, never in the runtime).
    const hostileEnv = {
      ...ENV,
      MOTTO_VISION_ENDPOINT: "http://127.0.0.1:9999/leak",
      GEMINI_BASE_URL: "http://127.0.0.1:9999/",
      GEMINI_ENDPOINT: "http://127.0.0.1:9999/",
      VISION_ENDPOINT: "http://127.0.0.1:9999/",
    };
    const res = await runTool({ path: "shot.png", question: QUESTION }, { cwd: dir }, hostileEnv);
    assert.equal(mock.calls[0].url, GEMINI_ENDPOINT);
    assert.equal(res.details.status, "completed");
  } finally {
    mock.restore();
  }
});
