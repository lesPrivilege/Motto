/**
 * gemini.ts loadConfig — env config (items 14–18 of the pack work order).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  loadConfig,
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
} from "../gemini.ts";

test("missing Google credential fails immediately", () => {
  assert.throws(() => loadConfig({}), /Google Gemini API key is not configured/);
});

test("pi-resolved local credential works without an environment key", () => {
  const cfg = loadConfig({}, { apiKey: "local-auth-key" });
  assert.equal(cfg.apiKey, "local-auth-key");
});

test("pi-resolved credential takes precedence over standalone environment fallback", () => {
  const cfg = loadConfig({ GEMINI_API_KEY: "shell-key" }, { apiKey: "local-auth-key" });
  assert.equal(cfg.apiKey, "local-auth-key");
});

test("default model is gemini-3.6-flash", () => {
  const cfg = loadConfig({ GEMINI_API_KEY: "k" });
  assert.equal(cfg.model, "gemini-3.6-flash");
  assert.equal(cfg.model, DEFAULT_MODEL);
});

test("MOTTO_VISION_MODEL overrides the default", () => {
  const cfg = loadConfig({ GEMINI_API_KEY: "k", MOTTO_VISION_MODEL: "gemini-3.6-pro" });
  assert.equal(cfg.model, "gemini-3.6-pro");
});

test("default timeout is 30000 ms", () => {
  const cfg = loadConfig({ GEMINI_API_KEY: "k" });
  assert.equal(cfg.timeoutMs, 30_000);
  assert.equal(cfg.timeoutMs, DEFAULT_TIMEOUT_MS);
});

test("MOTTO_VISION_TIMEOUT_MS is honored when valid", () => {
  const cfg = loadConfig({ GEMINI_API_KEY: "k", MOTTO_VISION_TIMEOUT_MS: "5000" });
  assert.equal(cfg.timeoutMs, 5000);
});

test("empty or whitespace timeout falls back to the default", () => {
  assert.equal(loadConfig({ GEMINI_API_KEY: "k", MOTTO_VISION_TIMEOUT_MS: "" }).timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(loadConfig({ GEMINI_API_KEY: "k", MOTTO_VISION_TIMEOUT_MS: "  " }).timeoutMs, DEFAULT_TIMEOUT_MS);
});

test("malformed timeout fails with a clear config error", () => {
  for (const bad of ["abc", "12.5", "-1", "1e3", "0x10"]) {
    assert.throws(
      () => loadConfig({ GEMINI_API_KEY: "k", MOTTO_VISION_TIMEOUT_MS: bad }),
      /invalid MOTTO_VISION_TIMEOUT_MS/,
      `expected ${JSON.stringify(bad)} to be rejected`,
    );
  }
});

test("out-of-range timeout fails with a clear config error", () => {
  for (const bad of ["0", String(MIN_TIMEOUT_MS - 1), String(MAX_TIMEOUT_MS + 1)]) {
    assert.throws(
      () => loadConfig({ GEMINI_API_KEY: "k", MOTTO_VISION_TIMEOUT_MS: bad }),
      /out of range/,
      `expected ${JSON.stringify(bad)} to be rejected`,
    );
  }
});
