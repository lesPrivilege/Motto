/**
 * Shared test fixtures + helpers for motto-gemini-vision.
 * Runtime-independent (plain JS), so every test file can import it.
 */

import { deflateSync } from "node:zlib";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A valid 1x1 red PNG, generated programmatically (no base64 literal in the repo).
export const PNG_1x1_RED = makePng(1, 1, [255, 0, 0]);

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Generate a valid, decodable solid-color RGB PNG. */
export function makePng(w = 8, h = 8, rgb = [255, 0, 0]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = rgb[0];
      raw[o + 1] = rgb[1];
      raw[o + 2] = rgb[2];
    }
  }
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

/** Fake JPEG: real magic bytes + junk payload (magic detection only). */
export function makeJpeg() {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("fake jpeg payload for magic detection")]);
}

/** Fake WEBP: real RIFF/WEBP magic + junk payload (magic detection only). */
export function makeWebp() {
  return Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBP"),
    Buffer.from("fake webp payload for magic detection"),
  ]);
}

/** Non-image bytes for the unknown-magic rejection path. */
export function makeUnknown() {
  return Buffer.from("this is definitely not an image file");
}

export async function makeTempDir(prefix = "motto-vision-") {
  return await mkdtemp(join(tmpdir(), prefix));
}

export async function writeFixture(dir, name, data) {
  const p = join(dir, name);
  await writeFile(p, data);
  return p;
}

/** Track a temp dir for cleanup in a node:test after() hook. */
const tracked = [];
export function trackTempDir(dir) {
  tracked.push(dir);
  return dir;
}
export async function cleanupTempDirs() {
  for (const d of tracked.splice(0)) await rm(d, { recursive: true, force: true });
}

/** Replace globalThis.fetch with a recording mock. Returns handle + calls. */
export function installFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(url, init, calls.length - 1);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function textResponse(status, text) {
  return new Response(text, { status });
}

/** A canonical "completed" Interactions response (with a thought step). */
export function completedBody(text = "The image is a solid red square.") {
  return {
    status: "completed",
    steps: [
      { type: "thought", content: [{ type: "text", text: "private reasoning, must be ignored" }] },
      { type: "model_output", content: [{ type: "text", text }] },
    ],
    usage: { total_input_tokens: 130, total_output_tokens: 12, total_tokens: 142 },
  };
}
