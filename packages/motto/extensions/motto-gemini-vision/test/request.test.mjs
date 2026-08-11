/**
 * gemini.ts runVision — outgoing HTTP request shape (items 19–30 of the work order).
 * All network is mocked; no request ever leaves the process.
 */

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { GEMINI_ENDPOINT, runVision, SYSTEM_INSTRUCTION } from "../gemini.ts";
import { completedBody, installFetch, jsonResponse } from "./fixtures.mjs";

const OPTS = {
  apiKey: "test-key-123",
  model: "gemini-3.6-flash",
  question: "What color is the pixel?",
  mimeType: "image/png",
  base64: "QUJDRA==",
  timeoutMs: 5000,
};

let mock;
after(() => mock?.restore());

test("endpoint is exactly POST /v1/interactions", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, GEMINI_ENDPOINT);
  assert.equal(mock.calls[0].url, "https://generativelanguage.googleapis.com/v1/interactions");
});

test("key travels only in the x-goog-api-key header (never in URL)", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const { url, init } = mock.calls[0];
  assert.equal(init.headers["x-goog-api-key"], "test-key-123");
  assert.ok(!/key=/.test(url), "key must not appear in the URL");
});

test("Content-Type is application/json", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  assert.equal(mock.calls[0].init.headers["content-type"], "application/json");
});

test("input is one content message: text part before image part", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const body = JSON.parse(mock.calls[0].init.body);
  assert.equal(body.input.length, 1);
  assert.equal(body.input[0].type, "content");
  const parts = body.input[0].content;
  assert.equal(parts.length, 2);
  assert.deepEqual(parts[0], { type: "text", text: OPTS.question });
  assert.equal(parts[1].type, "image");
  assert.equal(parts[1].data, OPTS.base64);
  assert.equal(parts[1].mime_type, "image/png");
});

test("store is false", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const body = JSON.parse(mock.calls[0].init.body);
  assert.equal(body.store, false);
});

test("thinking level minimal / summaries none / max output tokens 4096", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const body = JSON.parse(mock.calls[0].init.body);
  assert.equal(body.generation_config.thinking_level, "minimal");
  assert.equal(body.generation_config.thinking_summaries, "none");
  assert.equal(body.generation_config.max_output_tokens, 4096);
});

test("no agent / tools / previous interaction / background / stream / sampling params", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const body = JSON.parse(mock.calls[0].init.body);
  for (const forbidden of [
    "agent",
    "tools",
    "previous_interaction_id",
    "background",
    "stream",
    "temperature",
    "top_p",
    "top_k",
  ]) {
    assert.ok(!(forbidden in body), `body must not contain ${forbidden}`);
  }
  for (const forbidden of ["temperature", "top_p", "top_k"]) {
    assert.ok(!(forbidden in body.generation_config), `generation_config must not contain ${forbidden}`);
  }
});

test("fixed system instruction is present verbatim", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const body = JSON.parse(mock.calls[0].init.body);
  assert.equal(body.system_instruction, SYSTEM_INSTRUCTION);
  assert.match(body.system_instruction, /visual evidence extractor/);
  assert.match(body.system_instruction, /not an autonomous/);
});

test("request body carries only the question + image (no transcript or repo content)", async () => {
  mock = installFetch(() => jsonResponse(200, completedBody()));
  await runVision(OPTS);
  const body = JSON.parse(mock.calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ["generation_config", "input", "model", "store", "system_instruction"]);
  // The input is exactly [text part, image part]; nothing else (no repo, transcript, or other tool output).
  assert.equal(body.input[0].content[0].text, OPTS.question);
  assert.equal(JSON.stringify(body).includes("transcript"), false);
});
