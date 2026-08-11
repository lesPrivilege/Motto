/** Provider-neutral observation contract and adapter seam. */

import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  OBSERVATION_VERSION,
  ObservationError,
  projectObservationResult,
  validateObservationRequest,
  validateObservationResult,
} from "../contract.ts";
import { runObservation, runTool } from "../gemini.ts";
import {
  cleanupTempDirs,
  makeTempDir,
  PNG_1x1_RED,
  trackTempDir,
  writeFixture,
} from "./fixtures.mjs";

after(async () => await cleanupTempDirs());

const artifact = {
  id: "image-1",
  kind: "image",
  path: "/tmp/fixture.png",
  mimeType: "image/png",
  bytes: PNG_1x1_RED.length,
};

function result(overrides = {}) {
  return {
    version: OBSERVATION_VERSION,
    answer: "The Save control is visible.",
    evidence: [],
    limitations: [],
    artifacts: [artifact],
    provenance: {
      provider: "fake-a",
      model: "fixture-1",
      source: "image",
      sourcePath: artifact.path,
      remote: false,
    },
    status: "complete",
    ...overrides,
  };
}

test("qualified result validates with explicit provenance and artifact metadata", () => {
  const r = validateObservationResult(result());
  assert.equal(r.status, "complete");
  assert.equal(r.provenance.sourcePath, "/tmp/fixture.png");
  assert.equal(r.provenance.remote, false);
  assert.equal("base64" in r.artifacts[0], false);
});

test("partial result requires a visible limitation", () => {
  const r = validateObservationResult(result({
    status: "partial",
    limitations: ["The lower toolbar is occluded."],
  }));
  assert.equal(r.status, "partial");
  assert.throws(() => validateObservationResult(result({ status: "partial" })), (error) => {
    assert.equal(error.kind, "invalid_output");
    return true;
  });
});

test("missing answer is fail-closed as invalid_output", () => {
  assert.throws(() => validateObservationResult(result({ answer: "" })), (error) => {
    assert.ok(error instanceof ObservationError);
    assert.equal(error.kind, "invalid_output");
    return true;
  });
});

test("bad evidence and all locator ranges are rejected", () => {
  assert.throws(() => validateObservationResult(result({ evidence: [{ text: "Save", nope: true }] })), /unknown field/);
  for (const locator of [
    { type: "bbox", space: "normalized", x: 0.9, y: 0, width: 0.2, height: 0.1 },
    { type: "bbox", space: "pixel", x: 10, y: 0, width: 2, height: 2, imageWidth: 10, imageHeight: 10 },
    { type: "page", page: 0, pageCount: 2 },
    { type: "page", page: 3, pageCount: 2 },
    { type: "timestamp", seconds: -1 },
    { type: "timestamp", seconds: 12, durationSeconds: 10 },
  ]) {
    assert.throws(() => validateObservationResult(result({ evidence: [{ text: "x", locator }] })), /invalid output/);
  }
});

test("unknown-field policy is explicit", () => {
  assert.throws(() => validateObservationResult(result({ extra: "must reject" })), /unknown field/);
  const stripped = validateObservationResult(result({ extra: "removed" }), { unknownFields: "strip" });
  assert.equal("extra" in stripped, false);
});

test("projection is deterministic and carries evidence locators and limitations", () => {
  const projected = projectObservationResult(result({
    evidence: [
      {
        text: "Save is disabled",
        locator: { type: "bbox", space: "normalized", x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      },
    ],
    limitations: ["The screenshot does not expose application state."],
    status: "partial",
  }));
  assert.equal(
    projected,
    "Conclusion: The Save control is visible.\nEvidence:\n- Save is disabled (locator: bbox normalized (0.1,0.2,0.3,0.1))\nLimitations:\n- The screenshot does not expose application state.",
  );
});

test("request validation rejects unknown fields as input, before an adapter sees them", () => {
  assert.throws(() => validateObservationRequest({
    version: OBSERVATION_VERSION,
    question: "What is visible?",
    artifacts: [],
    endpoint: "https://attacker.invalid",
  }), (error) => {
    assert.equal(error.kind, "input");
    assert.match(error.message, /invalid input/);
    assert.doesNotMatch(error.message, /invalid output/);
    return true;
  });
});

test("provider exceptions cannot return request base64, credentials, or an untrusted cause", async () => {
  const secret = "provider-secret-value";
  const request = {
    version: OBSERVATION_VERSION,
    question: "What is visible?",
    artifacts: [{ ...artifact, base64: PNG_1x1_RED.toString("base64") }],
  };
  for (const thrown of [
    new Error(`wire=${request.artifacts[0].base64}`),
    new ObservationError("quota", `quota rejected ${secret}`, { cause: new Error(secret) }),
  ]) {
    await assert.rejects(
      runObservation(request, { name: "unsafe", async observe() { throw thrown; } }, undefined, [secret]),
      (error) => {
        assert.ok(error instanceof ObservationError);
        assert.equal(error.cause, undefined);
        assert.doesNotMatch(error.message, new RegExp(secret));
        assert.doesNotMatch(error.message, new RegExp(request.artifacts[0].base64));
        return true;
      },
    );
  }
});

test("provider results containing request base64 or credentials fail closed", async () => {
  const secret = "provider-secret-value";
  const request = {
    version: OBSERVATION_VERSION,
    question: "What is visible?",
    artifacts: [{ ...artifact, base64: PNG_1x1_RED.toString("base64") }],
  };
  for (const answer of [request.artifacts[0].base64, secret]) {
    await assert.rejects(
      runObservation(
        request,
        { name: "unsafe", async observe() { return result({ answer }); } },
        undefined,
        [secret],
      ),
      (error) => {
        assert.ok(error instanceof ObservationError);
        assert.equal(error.kind, "invalid_output");
        assert.doesNotMatch(error.message, new RegExp(secret));
        assert.doesNotMatch(error.message, new RegExp(request.artifacts[0].base64));
        return true;
      },
    );
  }
});

test("fake provider A/B can be injected without changing motto_vision schema", async () => {
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const calls = [];
  const makeProvider = (name, answer) => ({
    name,
    async observe(request) {
      calls.push({ name, request });
      return result({
        answer,
        artifacts: [{ ...artifact, path: request.artifacts[0].path }],
        provenance: { provider: name, model: `${name}-model`, source: "image", sourcePath: request.artifacts[0].path, remote: false },
      });
    },
  });
  const a = await runTool({ path: "shot.png", question: "What is visible?" }, { cwd: dir, provider: makeProvider("fake-a", "A sees a red pixel.") });
  const b = await runTool({ path: "shot.png", question: "What is visible?" }, { cwd: dir, provider: makeProvider("fake-b", "B sees a red pixel.") });
  assert.equal(a.content[0].text, "A sees a red pixel.");
  assert.equal(b.content[0].text, "B sees a red pixel.");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].request.version, OBSERVATION_VERSION);
  assert.equal(calls[0].request.artifacts[0].base64, PNG_1x1_RED.toString("base64"));
  const serialized = JSON.stringify({ a, b });
  assert.equal(serialized.includes(PNG_1x1_RED.toString("base64")), false);
  assert.equal(serialized.includes("api-key"), false);
});
