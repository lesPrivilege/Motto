/**
 * Dogfood integration: the real tool code path (runTool → loadImage →
 * runVision → real `fetch` over real HTTP → parseResponse) is exercised
 * against a local HTTP server that mimics the Gemini Interactions API.
 *
 * This is the closest end-to-end run possible without a Google key: real
 * image bytes, real HTTP transport, real response parsing. The only mocked
 * piece is the model provider itself.
 */

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "node:http";
import { realpath } from "node:fs/promises";
import { GEMINI_ENDPOINT, runTool } from "../gemini.ts";
import {
  cleanupTempDirs,
  makePng,
  makeTempDir,
  trackTempDir,
  writeFixture,
} from "./fixtures.mjs";

const ENV = {
  GEMINI_API_KEY: "dogfood-key",
  MOTTO_VISION_MODEL: "gemini-3.6-flash",
  MOTTO_VISION_TIMEOUT_MS: "5000",
};

let server;
let received = [];
let serverPort;
const originalFetch = globalThis.fetch;

function respond(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function startServer() {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const reqBody = raw.length ? JSON.parse(raw) : {};
        received.push({ method: req.method, url: req.url, headers: req.headers, body: reqBody });
        if (reqBody.model === "gemini-3.6-flash" && req.url === "/v1/interactions") {
          respond(res, 200, {
            status: "completed",
            steps: [{ type: "model_output", content: [{ type: "text", text: "A red 8x8 image." }] }],
            usage: { total_input_tokens: 200, total_output_tokens: 8 },
          });
        } else {
          respond(res, 400, { error: { code: 400, message: "unexpected request", status: "INVALID_ARGUMENT" } });
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;
      resolve();
    });
  });
}

after(async () => {
  globalThis.fetch = originalFetch;
  if (server) await new Promise((r) => server.close(r));
  await cleanupTempDirs();
});

test("tool runs end-to-end against a real HTTP endpoint (dogfood)", async () => {
  await startServer();

  // Redirect the tool's (fixed) production endpoint to the local stand-in while
  // asserting the tool still targets the exact production URL.
  globalThis.fetch = (url, init) => {
    assert.equal(String(url), GEMINI_ENDPOINT);
    assert.equal(String(url), "https://generativelanguage.googleapis.com/v1/interactions");
    return originalFetch(`http://127.0.0.1:${serverPort}/v1/interactions`, init);
  };

  const dir = trackTempDir(await makeTempDir());
  const imgPath = await writeFixture(dir, "solid.png", makePng(8, 8, [255, 0, 0]));

  const res = await runTool({ path: "solid.png", question: "What color is the image?" }, { cwd: dir }, ENV);

  // Tool-side contract holds over a real transport.
  assert.deepEqual(res.content, [{ type: "text", text: "A red 8x8 image." }]);
  assert.equal(res.details.mimeType, "image/png");
  assert.equal(res.details.bytes, makePng(8, 8, [255, 0, 0]).length);
  assert.equal(res.details.status, "completed");
  assert.deepEqual(res.details.usage, { total_input_tokens: 200, total_output_tokens: 8 });
  assert.equal(res.details.imagePath, await realpath(imgPath));

  // The server received exactly one correct request.
  assert.equal(received.length, 1);
  const req = received[0];
  assert.equal(req.method, "POST");
  assert.equal(req.headers["x-goog-api-key"], "dogfood-key");
  assert.equal(req.headers["content-type"], "application/json");
  assert.equal(req.body.store, false);
  assert.deepEqual(Object.keys(req.body).sort(), ["generation_config", "input", "model", "store", "system_instruction"]);
  assert.equal(req.body.input[0].type, "content");
  assert.equal(req.body.input[0].content[0].type, "text");
  assert.equal(req.body.input[0].content[1].type, "image");
  assert.equal(req.body.input[0].content[1].mime_type, "image/png");
  // The base64 the tool sent decodes back to the exact fixture bytes.
  assert.deepEqual(Buffer.from(req.body.input[0].content[1].data, "base64"), makePng(8, 8, [255, 0, 0]));
});

test("dogfood: provider HTTP error surfaces over the real transport", async () => {
  received.length = 0;
  globalThis.fetch = (url, init) => originalFetch(`http://127.0.0.1:${serverPort}/quota`, init);

  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "solid.png", makePng(8, 8, [255, 0, 0]));

  const err = await runTool({ path: "solid.png", question: "q" }, { cwd: dir }, ENV).then(
    () => null,
    (e) => e,
  );
  assert.ok(err instanceof Error);
  assert.match(err.message, /HTTP 400.*INVALID_ARGUMENT.*unexpected request/);
});
