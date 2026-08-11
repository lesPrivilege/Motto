/**
 * Provider-neutral observation contract.
 *
 * The extension is text-native: a provider sees a normalized request and
 * returns a normalized observation.  Provider wire envelopes never cross this
 * boundary.  This module intentionally has no network, filesystem, or Pi
 * imports so it can be exercised with deterministic fake providers.
 */

export const OBSERVATION_VERSION = "motto.observation.v1" as const;

export type ObservationStatus = "complete" | "partial";

export type ObservationErrorKind =
  | "config"
  | "input"
  | "provider"
  | "quota"
  | "timeout"
  | "aborted"
  | "invalid_output";

/** Errors are typed so callers can distinguish retry/UX policy without parsing text. */
export class ObservationError extends Error {
  readonly kind: ObservationErrorKind;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(kind: ObservationErrorKind, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "ObservationError";
    this.kind = kind;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

/** A normalized source sent to a provider. `base64` is internal request data. */
export interface ObservationArtifactInput {
  id: string;
  kind: "image";
  path: string;
  mimeType: ImageMime;
  bytes: number;
  base64: string;
}

export interface ObservationRequest {
  version: typeof OBSERVATION_VERSION;
  question: string;
  artifacts: ObservationArtifactInput[];
}

export interface BBoxLocator {
  type: "bbox";
  /** Coordinates are either normalized [0, 1] or pixels within image bounds. */
  space: "normalized" | "pixel";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Required for pixel coordinates; ignored for normalized coordinates. */
  imageWidth?: number;
  imageHeight?: number;
}

export interface PageLocator {
  type: "page";
  page: number;
  pageCount?: number;
}

export interface TimestampLocator {
  type: "timestamp";
  seconds: number;
  durationSeconds?: number;
}

export interface PathLocator {
  type: "path";
  path: string;
}

export type ObservationLocator = BBoxLocator | PageLocator | TimestampLocator | PathLocator;

export interface ObservationEvidence {
  text: string;
  locator?: ObservationLocator;
  confidence?: number;
}

/** Public artifact metadata. It deliberately has no image bytes/base64. */
export interface ObservationArtifact {
  id: string;
  kind: "image";
  path: string;
  mimeType: ImageMime;
  bytes: number;
}

export interface ObservationProvenance {
  provider: string;
  model: string;
  adapter?: string;
  endpoint?: string;
  requestId?: string;
  /** The observed source kind; the path is explicit so disclosure is traceable. */
  source: "image";
  sourcePath: string;
  /** True when an external provider processed the local source. */
  remote: boolean;
}

export interface ObservationResult {
  version: typeof OBSERVATION_VERSION;
  answer: string;
  evidence: ObservationEvidence[];
  limitations: string[];
  artifacts: ObservationArtifact[];
  provenance: ObservationProvenance;
  status: ObservationStatus;
}

export interface ObservationProvider {
  readonly name: string;
  observe(request: ObservationRequest, signal?: AbortSignal): Promise<ObservationResult>;
}

export type UnknownFieldPolicy = "reject" | "strip";

export interface ValidationOptions {
  /** Strict by default. `strip` is for adapters that explicitly opt in. */
  unknownFields?: UnknownFieldPolicy;
}

const IMAGE_MIMES = new Set<ImageMime>(["image/png", "image/jpeg", "image/webp"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new ObservationError("invalid_output", `motto_vision invalid output at ${path}: ${message}`);
}

function inputFail(path: string, message: string): never {
  throw new ObservationError("input", `motto_vision invalid input at ${path}: ${message}`);
}

function ownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, policy: UnknownFieldPolicy): Record<string, unknown> {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0 && policy === "reject") {
    fail(path, `unknown field(s): ${unknown.join(", ")}`);
  }
  if (policy === "strip") {
    const copy: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in value) copy[key] = value[key];
    }
    return copy;
  }
  return value;
}

function nonEmptyString(value: unknown, path: string, kind: "output" | "input" = "output"): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    if (kind === "input") inputFail(path, "expected a non-empty string");
    fail(path, "expected a non-empty string");
  }
  return value.trim();
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a finite number");
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  const n = finiteNumber(value, path);
  if (!Number.isInteger(n) || n <= 0) fail(path, "expected a positive integer");
  return n;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const n = finiteNumber(value, path);
  if (!Number.isInteger(n) || n < 0) fail(path, "expected a non-negative integer");
  return n;
}

function validateLocator(value: unknown, path: string, policy: UnknownFieldPolicy): ObservationLocator {
  if (!isRecord(value)) fail(path, "expected an object");
  const type = value.type;
  if (type === "bbox") {
    const b = ownKeys(value, ["type", "space", "x", "y", "width", "height", "imageWidth", "imageHeight"], path, policy);
    if (b.space !== "normalized" && b.space !== "pixel") fail(`${path}.space`, "must be normalized or pixel");
    const x = finiteNumber(b.x, `${path}.x`);
    const y = finiteNumber(b.y, `${path}.y`);
    const width = finiteNumber(b.width, `${path}.width`);
    const height = finiteNumber(b.height, `${path}.height`);
    if (width <= 0 || height <= 0) fail(path, "bbox width and height must be greater than zero");
    if (b.space === "normalized") {
      if (b.imageWidth !== undefined || b.imageHeight !== undefined) fail(path, "normalized bbox must not include image dimensions");
      if (x < 0 || y < 0 || x > 1 || y > 1 || x + width > 1 || y + height > 1) {
        fail(path, "normalized bbox must stay within [0, 1]");
      }
    } else {
      const imageWidth = positiveInteger(b.imageWidth, `${path}.imageWidth`);
      const imageHeight = positiveInteger(b.imageHeight, `${path}.imageHeight`);
      if (x < 0 || y < 0 || x + width > imageWidth || y + height > imageHeight) {
        fail(path, "pixel bbox must stay within image dimensions");
      }
      return { type, space: b.space, x, y, width, height, imageWidth, imageHeight };
    }
    return { type, space: b.space, x, y, width, height };
  }
  if (type === "page") {
    const p = ownKeys(value, ["type", "page", "pageCount"], path, policy);
    const page = positiveInteger(p.page, `${path}.page`);
    let pageCount: number | undefined;
    if (p.pageCount !== undefined) pageCount = positiveInteger(p.pageCount, `${path}.pageCount`);
    if (pageCount !== undefined && page > pageCount) fail(path, "page must not exceed pageCount");
    return pageCount === undefined ? { type, page } : { type, page, pageCount };
  }
  if (type === "timestamp") {
    const t = ownKeys(value, ["type", "seconds", "durationSeconds"], path, policy);
    const seconds = finiteNumber(t.seconds, `${path}.seconds`);
    if (seconds < 0) fail(`${path}.seconds`, "must be non-negative");
    let durationSeconds: number | undefined;
    if (t.durationSeconds !== undefined) {
      durationSeconds = finiteNumber(t.durationSeconds, `${path}.durationSeconds`);
      if (durationSeconds <= 0 || seconds > durationSeconds) fail(path, "timestamp must stay within durationSeconds");
    }
    return durationSeconds === undefined ? { type, seconds } : { type, seconds, durationSeconds };
  }
  if (type === "path") {
    const p = ownKeys(value, ["type", "path"], path, policy);
    return { type, path: nonEmptyString(p.path, `${path}.path`) };
  }
  fail(`${path}.type`, "must be bbox, page, timestamp, or path");
}

function validateEvidence(value: unknown, path: string, policy: UnknownFieldPolicy): ObservationEvidence {
  if (!isRecord(value)) fail(path, "expected an object");
  const e = ownKeys(value, ["text", "locator", "confidence"], path, policy);
  const text = nonEmptyString(e.text, `${path}.text`);
  const locator = e.locator === undefined ? undefined : validateLocator(e.locator, `${path}.locator`, policy);
  let confidence: number | undefined;
  if (e.confidence !== undefined) {
    confidence = finiteNumber(e.confidence, `${path}.confidence`);
    if (confidence < 0 || confidence > 1) fail(`${path}.confidence`, "must be in [0, 1]");
  }
  return confidence === undefined ? (locator === undefined ? { text } : { text, locator }) : locator === undefined ? { text, confidence } : { text, locator, confidence };
}

function validateArtifact(value: unknown, path: string, policy: UnknownFieldPolicy): ObservationArtifact {
  if (!isRecord(value)) fail(path, "expected an object");
  const a = ownKeys(value, ["id", "kind", "path", "mimeType", "bytes"], path, policy);
  const id = nonEmptyString(a.id, `${path}.id`);
  if (a.kind !== "image") fail(`${path}.kind`, "must be image");
  const artifactPath = nonEmptyString(a.path, `${path}.path`);
  if (typeof a.mimeType !== "string" || !IMAGE_MIMES.has(a.mimeType as ImageMime)) fail(`${path}.mimeType`, "unsupported image MIME");
  const bytes = positiveInteger(a.bytes, `${path}.bytes`);
  return { id, kind: "image", path: artifactPath, mimeType: a.mimeType as ImageMime, bytes };
}

function validateProvenance(value: unknown, path: string, policy: UnknownFieldPolicy): ObservationProvenance {
  if (!isRecord(value)) fail(path, "expected an object");
  const p = ownKeys(value, ["provider", "model", "adapter", "endpoint", "requestId", "source", "sourcePath", "remote"], path, policy);
  const provider = nonEmptyString(p.provider, `${path}.provider`);
  const model = nonEmptyString(p.model, `${path}.model`);
  if (p.source !== "image") fail(`${path}.source`, "must be image");
  const sourcePath = nonEmptyString(p.sourcePath, `${path}.sourcePath`);
  if (typeof p.remote !== "boolean") fail(`${path}.remote`, "must be boolean");
  if (p.remote === true && p.endpoint === undefined) fail(`${path}.endpoint`, "required when remote is true");
  const result: ObservationProvenance = { provider, model, source: "image", sourcePath, remote: p.remote };
  if (p.adapter !== undefined) result.adapter = nonEmptyString(p.adapter, `${path}.adapter`);
  if (p.endpoint !== undefined) result.endpoint = nonEmptyString(p.endpoint, `${path}.endpoint`);
  if (p.requestId !== undefined) result.requestId = nonEmptyString(p.requestId, `${path}.requestId`);
  return result;
}

/** Validate and return a canonical result with unknown fields rejected by default. */
export function validateObservationResult(value: unknown, options: ValidationOptions = {}): ObservationResult {
  const policy = options.unknownFields ?? "reject";
  if (!isRecord(value)) fail("result", "expected an object");
  const r = ownKeys(value, ["version", "answer", "evidence", "limitations", "artifacts", "provenance", "status"], "result", policy);
  if (r.version !== OBSERVATION_VERSION) fail("result.version", `must be ${OBSERVATION_VERSION}`);
  const answer = nonEmptyString(r.answer, "result.answer");
  if (r.status !== "complete" && r.status !== "partial") fail("result.status", "must be complete or partial");
  if (!Array.isArray(r.evidence)) fail("result.evidence", "expected an array");
  if (!Array.isArray(r.limitations)) fail("result.limitations", "expected an array");
  if (!Array.isArray(r.artifacts)) fail("result.artifacts", "expected an array");
  const evidence = r.evidence.map((entry, i) => validateEvidence(entry, `result.evidence[${i}]`, policy));
  const limitations = r.limitations.map((entry, i) => nonEmptyString(entry, `result.limitations[${i}]`));
  const artifacts = r.artifacts.map((entry, i) => validateArtifact(entry, `result.artifacts[${i}]`, policy));
  const provenance = validateProvenance(r.provenance, "result.provenance", policy);
  if (r.status === "partial" && limitations.length === 0) fail("result.limitations", "partial results must state at least one limitation");
  return { version: OBSERVATION_VERSION, answer, evidence, limitations, artifacts, provenance, status: r.status };
}

/** Internal parser; the public wrapper below reclassifies all shape failures as input errors. */
function parseObservationRequest(value: unknown, options: ValidationOptions = {}): ObservationRequest {
  const policy = options.unknownFields ?? "reject";
  if (!isRecord(value)) inputFail("request", "expected an object");
  const r = ownKeys(value, ["version", "question", "artifacts"], "request", policy);
  if (r.version !== OBSERVATION_VERSION) inputFail("request.version", `must be ${OBSERVATION_VERSION}`);
  const question = nonEmptyString(r.question, "request.question", "input");
  if (!Array.isArray(r.artifacts) || r.artifacts.length === 0) inputFail("request.artifacts", "expected at least one artifact");
  const artifacts = r.artifacts.map((entry, i) => {
    if (!isRecord(entry)) inputFail(`request.artifacts[${i}]`, "expected an object");
    const a = ownKeys(entry, ["id", "kind", "path", "mimeType", "bytes", "base64"], `request.artifacts[${i}]`, policy);
    const id = nonEmptyString(a.id, `request.artifacts[${i}].id`, "input");
    if (a.kind !== "image") inputFail(`request.artifacts[${i}].kind`, "must be image");
    const path = nonEmptyString(a.path, `request.artifacts[${i}].path`, "input");
    if (typeof a.mimeType !== "string" || !IMAGE_MIMES.has(a.mimeType as ImageMime)) inputFail(`request.artifacts[${i}].mimeType`, "unsupported image MIME");
    const bytes = positiveInteger(a.bytes, `request.artifacts[${i}].bytes`);
    const base64 = nonEmptyString(a.base64, `request.artifacts[${i}].base64`, "input");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) inputFail(`request.artifacts[${i}].base64`, "invalid base64");
    return { id, kind: "image" as const, path, mimeType: a.mimeType as ImageMime, bytes, base64 };
  });
  return { version: OBSERVATION_VERSION, question, artifacts };
}

/** Validate the normalized request before handing it to an adapter. */
export function validateObservationRequest(value: unknown, options: ValidationOptions = {}): ObservationRequest {
  try {
    return parseObservationRequest(value, options);
  } catch (error) {
    if (error instanceof ObservationError && error.kind === "invalid_output") {
      throw new ObservationError(
        "input",
        error.message.replace(/^motto_vision invalid output at /, "motto_vision invalid input at "),
      );
    }
    throw error;
  }
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
}

function formatLocator(locator: ObservationLocator): string {
  switch (locator.type) {
    case "bbox":
      return locator.space === "normalized"
        ? `bbox normalized (${formatNumber(locator.x)},${formatNumber(locator.y)},${formatNumber(locator.width)},${formatNumber(locator.height)})`
        : `bbox pixel (${formatNumber(locator.x)},${formatNumber(locator.y)},${formatNumber(locator.width)},${formatNumber(locator.height)}) of ${locator.imageWidth}x${locator.imageHeight}`;
    case "page":
      return locator.pageCount === undefined ? `page ${locator.page}` : `page ${locator.page}/${locator.pageCount}`;
    case "timestamp":
      return locator.durationSeconds === undefined ? `timestamp ${formatNumber(locator.seconds)}s` : `timestamp ${formatNumber(locator.seconds)}s/${formatNumber(locator.durationSeconds)}s`;
    case "path":
      return `path ${JSON.stringify(locator.path)}`;
  }
}

/**
 * Deterministic, compact text projection for the text-only main model.
 * Provider envelopes, base64, and API credentials are never projected.
 */
export function projectObservationResult(value: ObservationResult): string {
  const result = validateObservationResult(value);
  const answer = result.answer.trim();
  // Preserve the historical one-line result when there are no additional
  // sections. Canonical metadata still lives in details.
  if (result.evidence.length === 0 && result.limitations.length === 0) return answer;

  const lines = [`Conclusion: ${answer}`];
  if (result.evidence.length > 0) {
    lines.push("Evidence:");
    for (const evidence of result.evidence) {
      lines.push(`- ${evidence.text.trim()}${evidence.locator ? ` (locator: ${formatLocator(evidence.locator)})` : ""}`);
    }
  }
  if (result.limitations.length > 0) {
    lines.push("Limitations:");
    for (const limitation of result.limitations) lines.push(`- ${limitation.trim()}`);
  }
  return lines.join("\n");
}

/** Throw if a canonical result accidentally carries request secrets. */
export function assertObservationSafe(value: ObservationResult, secrets: readonly string[]): void {
  const serialized = JSON.stringify(value);
  for (const secret of secrets) {
    if (secret && serialized.includes(secret)) {
      throw new ObservationError("invalid_output", "motto_vision invalid output: sensitive request data was returned");
    }
  }
}
