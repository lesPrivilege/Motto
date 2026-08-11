/**
 * gemini.ts parseResponse — response parsing (items 31–37 of the work order).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseResponse } from "../gemini.ts";

function body(overrides = {}) {
  return {
    status: "completed",
    steps: [
      { type: "model_output", content: [{ type: "text", text: "first" }] },
      { type: "model_output", content: [{ type: "text", text: "second" }] },
    ],
    usage: { total_input_tokens: 10, total_output_tokens: 5, total_tokens: 15 },
    ...overrides,
  };
}

test("concatenates all model_output text blocks in order", () => {
  const r = parseResponse(body());
  assert.equal(r.text, "firstsecond");
  assert.equal(r.status, "completed");
  assert.equal(r.incomplete, false);
});

test("ignores thought steps and non-text content", () => {
  const r = parseResponse(
    body({
      steps: [
        { type: "thought", content: [{ type: "text", text: "private" }] },
        { type: "model_output", content: [{ type: "text", text: "A" }, { type: "image", data: "x" }, { type: "text", text: "B" }] },
        { type: "custom", content: [{ type: "text", text: "ignored" }] },
      ],
    }),
  );
  assert.equal(r.text, "AB");
});

test("completed with text returns normally", () => {
  const r = parseResponse(body());
  assert.equal(r.text, "firstsecond");
});

test("incomplete appends the warning line", () => {
  const r = parseResponse(body({ status: "incomplete" }));
  assert.equal(r.text, "firstsecond\n[Vision response incomplete.]");
  assert.equal(r.incomplete, true);
  assert.equal(r.status, "incomplete");
});

test("failed / cancelled / requires_action / in_progress throw", () => {
  for (const status of ["failed", "cancelled", "requires_action", "in_progress"]) {
    assert.throws(() => parseResponse(body({ status })), /not completed/, `status ${status} must throw`);
  }
});

test("empty output throws with the status", () => {
  assert.throws(
    () => parseResponse(body({ steps: [{ type: "model_output", content: [] }] })),
    /returned no text \(status: completed\)/,
  );
});

test("usage is mapped only from present numeric fields", () => {
  const r = parseResponse(
    body({
      usage: {
        total_input_tokens: 10,
        total_output_tokens: 5,
        total_cached_tokens: 2,
        total_tokens: "not-a-number",
      },
    }),
  );
  assert.deepEqual(r.usage, { total_input_tokens: 10, total_output_tokens: 5, total_cached_tokens: 2 });
});

test("missing usage does not fail and yields an empty object", () => {
  const r = parseResponse(body({ usage: undefined }));
  assert.deepEqual(r.usage, {});
});

test("provider error embedded in a 2xx body is extracted as a short message", () => {
  assert.throws(
    () =>
      parseResponse(
        body({
          error: { code: 400, message: "this image contains something disallowed by policy", status: "INVALID_ARGUMENT" },
        }),
      ),
    /provider error \(INVALID_ARGUMENT\): this image contains something disallowed by policy/,
  );
});
