/**
 * image.ts — path resolution, size limits, magic-byte MIME detection, base64.
 * Test matrix §5 (items 1–13 of the pack work order).
 */

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmod, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { detectMime, loadImage, MAX_IMAGE_BYTES } from "../image.ts";
import {
  cleanupTempDirs,
  makeJpeg,
  makePng,
  makeTempDir,
  makeUnknown,
  makeWebp,
  PNG_1x1_RED,
  trackTempDir,
  writeFixture,
} from "./fixtures.mjs";

after(async () => await cleanupTempDirs());

test("relative path resolves against cwd", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "img.png", PNG_1x1_RED);
  const img = await loadImage("img.png", dir);
  assert.equal(img.path, await realpath(resolve(dir, "img.png")));
  assert.equal(img.path, await realpath(p));
});

test("absolute path is used as-is", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "abs.png", PNG_1x1_RED);
  const img = await loadImage(p, "/somewhere/else");
  assert.equal(img.path, await realpath(p));
});

test("~/ path expands to the home directory", async () => {
  const dir = trackTempDir(await makeTempDir());
  const name = `motto-vision-home-${Date.now()}.png`;
  const p = await writeFixture(dir, name, PNG_1x1_RED);
  const home = homedir();
  // Move the fixture into the real home dir path (mirrors what a real ~/ file is).
  const homePath = join(home, name);
  await writeFile(homePath, PNG_1x1_RED);
  try {
    const img = await loadImage(`~/${name}`, "/somewhere/else");
    assert.equal(img.path, await realpath(homePath));
  } finally {
    await rm(homePath, { force: true });
  }
  assert.ok(p); // keep the temp fixture referenced
});

test("missing file fails with an actionable error", async () => {
  const dir = trackTempDir(await makeTempDir());
  await assert.rejects(() => loadImage("nope.png", dir), /image not found/);
});

test("directory is rejected (not a regular file)", async () => {
  const dir = trackTempDir(await makeTempDir());
  await assert.rejects(() => loadImage(dir, "/tmp"), /not a regular file/);
});

test("unreadable file fails with an actionable error", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "locked.png", PNG_1x1_RED);
  await chmod(p, 0o000);
  try {
    await assert.rejects(() => loadImage(p, dir), /cannot read image/);
  } finally {
    await chmod(p, 0o644);
  }
});

test("empty file is rejected", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "empty.png", Buffer.alloc(0));
  await assert.rejects(() => loadImage(p, dir), /image is empty/);
});

test("oversized file is rejected before any read of its content", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "big.png", Buffer.alloc(MAX_IMAGE_BYTES + 1));
  await assert.rejects(() => loadImage(p, dir), /image too large/);
});

test("PNG magic bytes are recognized", () => {
  assert.equal(detectMime(new Uint8Array(PNG_1x1_RED)), "image/png");
});

test("JPEG magic bytes are recognized", () => {
  assert.equal(detectMime(new Uint8Array(makeJpeg())), "image/jpeg");
});

test("WEBP magic bytes are recognized", () => {
  assert.equal(detectMime(new Uint8Array(makeWebp())), "image/webp");
});

test("content wins over extension: .png file holding JPEG bytes loads as JPEG", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "mismatched.png", makeJpeg());
  const img = await loadImage(p, dir);
  assert.equal(img.mimeType, "image/jpeg");
});

test("unknown magic bytes are rejected regardless of extension", async () => {
  const dir = trackTempDir(await makeTempDir());
  const p = await writeFixture(dir, "fake.png", makeUnknown());
  await assert.rejects(() => loadImage(p, dir), /unsupported image format/);
});

test("detectMime returns undefined for short or unknown buffers", () => {
  assert.equal(detectMime(new Uint8Array([0x89])), undefined);
  assert.equal(detectMime(new Uint8Array(makeUnknown())), undefined);
});

test("empty path is rejected", async () => {
  await assert.rejects(() => loadImage("   ", "/tmp"), /path is empty/);
});
