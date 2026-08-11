/**
 * motto-gemini-vision — local image loading (loader).
 *
 * Pure file pipeline: path resolution (relative to cwd, absolute, `~`
 * expansion), regular-file + size checks (before and after the read, so a
 * TOCTOU size change cannot sneak a giant file past the cap), magic-byte MIME
 * detection (PNG / JPEG / WEBP — content wins over extension), and base64
 * encoding. No network, no shell, no external binaries.
 */

import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { ObservationError } from "./contract.ts";

/**
 * Conservative cap for inline (base64-in-JSON) requests: the base64 payload
 * inflates by ~4/3, so 10 MiB of raw image leaves headroom for the JSON body.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

export interface LoadedImage {
  /** Real path after symlink resolution. */
  path: string;
  mimeType: ImageMime;
  /** Byte length of the raw file (post-read). */
  bytes: number;
  /** Base64 of the raw file bytes. */
  base64: string;
}

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

/** Detect image MIME from leading magic bytes; content wins over extension. */
export function detectMime(bytes: Uint8Array): ImageMime | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

export async function loadImage(rawPath: string, cwd: string): Promise<LoadedImage> {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) throw new ObservationError("input", "motto_vision: image path is empty.");

  const expanded = expandHome(trimmed);
  const abs = isAbsolute(expanded) ? expanded : resolve(cwd, expanded);

  let real: string;
  try {
    real = await realpath(abs);
  } catch {
    throw new ObservationError("input", `motto_vision: image not found: ${abs}`);
  }

  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(real);
  } catch {
    throw new ObservationError("input", `motto_vision: cannot stat image: ${real}`);
  }
  if (!st.isFile()) throw new ObservationError("input", `motto_vision: not a regular file: ${real}`);
  if (st.size === 0) throw new ObservationError("input", `motto_vision: image is empty: ${real}`);
  if (st.size > MAX_IMAGE_BYTES) {
    throw new ObservationError(
      "input",
      `motto_vision: image too large: ${st.size} bytes (limit ${MAX_IMAGE_BYTES}). Compress or downscale the image first.`,
    );
  }

  let buf: Buffer;
  try {
    buf = await readFile(real);
  } catch {
    throw new ObservationError("input", `motto_vision: cannot read image: ${real}`);
  }
  // Re-check after the read to catch size drift (TOCTOU).
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new ObservationError(
      "input",
      `motto_vision: image too large: ${buf.length} bytes (limit ${MAX_IMAGE_BYTES}). Compress or downscale the image first.`,
    );
  }
  if (buf.length === 0) throw new ObservationError("input", `motto_vision: image is empty: ${real}`);

  const mime = detectMime(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  if (!mime) {
    throw new ObservationError(
      "input",
      `motto_vision: unsupported image format: ${real} (only PNG, JPEG, and WEBP are supported; detected by content, not extension).`,
    );
  }

  return { path: real, mimeType: mime, bytes: buf.length, base64: buf.toString("base64") };
}
