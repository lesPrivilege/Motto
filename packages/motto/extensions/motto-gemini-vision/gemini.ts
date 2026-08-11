/**
 * motto-gemini-vision — Gemini Interactions API adapter + tool pipeline.
 *
 * Single file owning: config resolution, request building, abort/timeout merging,
 * HTTP error mapping, response parsing, and `runTool` (the pipeline index.ts
 * wires into pi). One synchronous, stateless, non-streaming multimodal request
 * per call; no retries, no conversation state, no agent loop. The Gemini API
 * surface is contained here so the rest of the pack never touches it.
 */

import { loadImage } from "./image.ts";
import {
  assertObservationSafe,
  OBSERVATION_VERSION,
  ObservationError,
  projectObservationResult,
  type ObservationArtifactInput,
  type ObservationProvider,
  type ObservationRequest,
  type ObservationResult,
  validateObservationRequest,
  validateObservationResult,
} from "./contract.ts";

/** Gemini Developer API — Interactions API v1 (fixed, single endpoint). */
export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1/interactions";

export const DEFAULT_MODEL = "gemini-3.6-flash";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 120_000;

export const SYSTEM_INSTRUCTION = `You are a visual evidence extractor for a coding agent, not an autonomous
agent. Answer only the supplied visual question.

Be evidence-first:
- Separate direct observations from inference.
- Say when a detail is uncertain instead of guessing.
- Never fabricate unreadable, occluded, or absent details.
- Keep the answer compact but sufficient for the current task.

For OCR requests, preserve visible text exactly, including casing and
punctuation, and explicitly mark unreadable segments.

For UI and screenshot debugging, focus on visible state, labels, messages,
controls, layout, spacing, alignment, and spatial relationships. Separate
observed UI state from a probable cause.`;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface VisionConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface VisionConfigContext {
  /** Key resolved by pi's local ModelRegistry (auth.json/models.json). */
  apiKey?: string;
}

/**
 * Resolve config from pi's already-resolved local credential when supplied.
 * The environment remains a standalone/live-smoke fallback. A missing key
 * fails immediately (no network request is ever made without it). The timeout
 * must be a finite positive integer within MIN..MAX ms.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, context: VisionConfigContext = {}): VisionConfig {
  const apiKey = context.apiKey?.trim() || env.GEMINI_API_KEY?.trim() || "";
  if (apiKey.length === 0) {
    throw new ObservationError(
      "config",
      "motto_vision: Google Gemini API key is not configured. In pi it resolves from ~/.config/motto/credentials/google via models.json (apiKey '!motto-google-key'); for standalone smoke set GEMINI_API_KEY.",
    );
  }

  const model = env.MOTTO_VISION_MODEL?.trim() || DEFAULT_MODEL;

  const rawTimeout = env.MOTTO_VISION_TIMEOUT_MS?.trim();
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (rawTimeout !== undefined && rawTimeout !== "") {
    if (!/^\d+$/.test(rawTimeout)) {
      throw new ObservationError(
        "config",
        `motto_vision: invalid MOTTO_VISION_TIMEOUT_MS "${rawTimeout}" — expected a positive integer (ms) in ${MIN_TIMEOUT_MS}..${MAX_TIMEOUT_MS}.`,
      );
    }
    const n = Number(rawTimeout);
    if (n < MIN_TIMEOUT_MS || n > MAX_TIMEOUT_MS) {
      throw new ObservationError(
        "config",
        `motto_vision: MOTTO_VISION_TIMEOUT_MS ${n} is out of range — allowed ${MIN_TIMEOUT_MS}..${MAX_TIMEOUT_MS} ms.`,
      );
    }
    timeoutMs = n;
  }

  return { apiKey, model, timeoutMs };
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface BuildRequestOptions {
  model: string;
  question: string;
  mimeType: string;
  base64: string;
}

/**
 * Build the Interactions API body. One content message: text question part
 * precedes the image part (verified against the live v1 API).
 */
export function buildRequest(opts: BuildRequestOptions): Record<string, unknown> {
  return {
    model: opts.model,
    input: [
      {
        type: "content",
        content: [
          { type: "text", text: opts.question },
          { type: "image", data: opts.base64, mime_type: opts.mimeType },
        ],
      },
    ],
    system_instruction: SYSTEM_INSTRUCTION,
    store: false,
    generation_config: {
      thinking_level: "minimal",
      thinking_summaries: "none",
      max_output_tokens: 4096,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP error mapping
// ---------------------------------------------------------------------------

interface ProviderError {
  code?: number;
  message?: string;
  status?: string;
}

/** Extract Google's JSON error envelope, if present. */
export function extractProviderError(body: unknown): ProviderError | undefined {
  const b = body as { error?: Record<string, unknown> } | null | undefined;
  const e = b?.error;
  if (!e || typeof e !== "object") return undefined;
  return {
    code: typeof e.code === "number" ? e.code : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
    status: typeof e.status === "string" ? e.status : undefined,
  };
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function httpError(status: number, body: unknown): ObservationError {
  const pe = extractProviderError(body);
  const parts = [`motto_vision request failed: HTTP ${status}`];
  if (pe?.status) parts.push(`provider status ${pe.status}`);
  if (pe?.message) parts.push(truncate(pe.message, 500));
  const kind = status === 429 ? "quota" : status === 408 || status === 504 ? "timeout" : "provider";
  return new ObservationError(kind, `${parts.join(" — ")}.`, { status });
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const USAGE_KEYS = [
  "total_input_tokens",
  "total_output_tokens",
  "total_thought_tokens",
  "total_tokens",
  "total_cached_tokens",
] as const;

export interface ParsedResponse {
  text: string;
  status: string;
  /** Only the usage fields that are actually present. */
  usage: Record<string, number>;
  incomplete: boolean;
}

/**
 * Parse a raw REST response: concatenate non-empty `model_output` text blocks
 * in order, ignore thought steps and non-text content, and map statuses.
 * Error statuses and empty output throw.
 */
export function parseResponse(body: unknown): ParsedResponse {
  const b = (body ?? {}) as Record<string, unknown>;
  const status = typeof b.status === "string" ? b.status : "unknown";

  const providerError = extractProviderError(b);
  if (providerError) {
    const msg = providerError.message ? truncate(providerError.message, 500) : "";
    throw new ObservationError(
      providerError.code === 429 ? "quota" : "provider",
      `motto_vision provider error${providerError.status ? ` (${providerError.status})` : ""}${msg ? `: ${msg}` : ""}.`,
    );
  }

  let text = "";
  const steps = Array.isArray(b.steps) ? b.steps : [];
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const s = step as Record<string, unknown>;
    if (s.type !== "model_output") continue; // ignore thought steps and others
    const content = Array.isArray(s.content) ? s.content : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const c = block as Record<string, unknown>;
      if (c.type === "text" && typeof c.text === "string" && c.text.length > 0) {
        text += c.text;
      }
    }
  }

  const usage: Record<string, number> = {};
  if (b.usage && typeof b.usage === "object") {
    const u = b.usage as Record<string, unknown>;
    for (const key of USAGE_KEYS) {
      const v = u[key];
      if (typeof v === "number" && Number.isFinite(v)) usage[key] = v;
    }
  }

  if (status === "failed" || status === "cancelled" || status === "requires_action" || status === "in_progress") {
    throw new ObservationError("provider", `motto_vision request not completed (status: ${status}).`);
  }
  if (text.length === 0) {
    throw new ObservationError("invalid_output", `motto_vision returned no text (status: ${status}).`);
  }

  const incomplete = status === "incomplete";
  return {
    text: incomplete ? `${text}\n[Vision response incomplete.]` : text,
    status,
    usage,
    incomplete,
  };
}

// ---------------------------------------------------------------------------
// Request execution
// ---------------------------------------------------------------------------

export interface RunVisionOptions {
  apiKey: string;
  model: string;
  question: string;
  mimeType: string;
  base64: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface VisionResult {
  text: string;
  status: string;
  usage: Record<string, number>;
  durationMs: number;
  incomplete: boolean;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function abortOrNetworkError(
  signal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
  timeoutMs: number,
  cause: unknown,
): ObservationError {
  if (signal?.aborted) return new ObservationError("aborted", "motto_vision request aborted.", { cause });
  if (timeoutSignal.aborted) {
    return new ObservationError("timeout", `motto_vision request timed out after ${Math.round(timeoutMs / 1000)}s.`, { cause });
  }
  return new ObservationError("provider", `motto_vision network error: ${messageOf(cause)}`, { cause });
}

/**
 * One synchronous, stateless, non-streaming request to the Interactions API.
 * The pi signal and the tool timeout are merged; user cancellation and timeout
 * stay distinguishable, and neither is swallowed.
 */
export async function runVision(opts: RunVisionOptions): Promise<VisionResult> {
  const started = Date.now();
  if (opts.signal?.aborted) throw new ObservationError("aborted", "motto_vision request aborted.");
  // Manual timeout instead of AbortSignal.timeout() so the timer is cleared in
  // `finally` (a dangling AbortSignal.timeout timer keeps the event loop busy
  // and breaks test runners that detect an empty loop, e.g. node --test on
  // Node 22). The pi signal and the tool timeout are merged; user cancellation
  // and timeout stay distinguishable, and neither is swallowed.
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    controller.abort(
      new DOMException(`motto_vision timed out after ${Math.round(opts.timeoutMs / 1000)}s`, "TimeoutError"),
    );
  }, opts.timeoutMs);
  const effectiveSignal = opts.signal ? AbortSignal.any([opts.signal, controller.signal]) : controller.signal;

  try {
    const body = buildRequest({
      model: opts.model,
      question: opts.question,
      mimeType: opts.mimeType,
      base64: opts.base64,
    });

    let response: Response;
    try {
      response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": opts.apiKey,
        },
        body: JSON.stringify(body),
        signal: effectiveSignal,
      });
    } catch (err) {
      throw abortOrNetworkError(opts.signal, controller.signal, opts.timeoutMs, err);
    }
    const durationMs = Date.now() - started;

    if (!response.ok) {
      let providerBody: unknown = undefined;
      try {
        const raw = await response.text();
        try {
          providerBody = JSON.parse(raw);
        } catch {
          // non-JSON error body: still report the HTTP status below
        }
      } catch (err) {
        throw abortOrNetworkError(opts.signal, controller.signal, opts.timeoutMs, err);
      }
      throw httpError(response.status, providerBody);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      if (opts.signal?.aborted || controller.signal.aborted) {
        throw abortOrNetworkError(opts.signal, controller.signal, opts.timeoutMs, err);
      }
      throw new ObservationError("invalid_output", "motto_vision provider returned invalid JSON.", { cause: err });
    }

    const parsed = parseResponse(json);
    return {
      text: parsed.text,
      status: parsed.status,
      usage: parsed.usage,
      durationMs,
      incomplete: parsed.incomplete,
    };
  } finally {
    clearTimeout(timeoutTimer);
  }
}

// ---------------------------------------------------------------------------
// Tool pipeline (what index.ts wires into pi)
// ---------------------------------------------------------------------------

export interface RunToolParams {
  path: string;
  question: string;
}

export interface RunToolContext {
  cwd: string;
  /** Resolved by pi's ModelRegistry in the extension path; optional for standalone tests. */
  apiKey?: string;
  /** Provider injection seam for offline tests and future adapters. */
  provider?: ObservationProvider;
}

export interface RunToolResult {
  content: { type: "text"; text: string }[];
  details: {
    model: string;
    imagePath: string;
    mimeType: string;
    bytes: number;
    durationMs: number;
    status: string;
    usage: Record<string, number>;
    /** Canonical provider-neutral result; never the provider's raw JSON. */
    observation: ObservationResult;
    provenance: ObservationResult["provenance"];
    artifacts: ObservationResult["artifacts"];
  };
}

/** Narrow Gemini adapter: only this class knows the provider wire protocol. */
export class GeminiAdapter implements ObservationProvider {
  readonly name = "gemini";
  readonly config: VisionConfig;
  lastUsage: Record<string, number> = {};
  lastDurationMs = 0;
  lastProviderStatus = "unknown";

  constructor(config: VisionConfig) {
    this.config = config;
  }

  async observe(request: ObservationRequest, signal?: AbortSignal): Promise<ObservationResult> {
    const normalized = validateObservationRequest(request);
    if (normalized.artifacts.length !== 1) {
      throw new ObservationError("input", "motto_vision: Gemini adapter accepts exactly one image artifact.");
    }
    const artifact = normalized.artifacts[0];
    const response = await runVision({
      apiKey: this.config.apiKey,
      model: this.config.model,
      question: normalized.question,
      mimeType: artifact.mimeType,
      base64: artifact.base64,
      timeoutMs: this.config.timeoutMs,
      signal,
    });
    this.lastUsage = response.usage;
    this.lastDurationMs = response.durationMs;
    this.lastProviderStatus = response.status;
    const partial = response.incomplete;
    // parseResponse appends a provider-status marker for the legacy direct
    // API. Keep that marker out of the canonical answer; the partial status is
    // represented once, in the structured limitations field and projection.
    const answer = response.text.replace(/\n\[Vision response incomplete\.\]\s*$/, "").trim();
    return validateObservationResult({
      version: OBSERVATION_VERSION,
      answer,
      evidence: [],
      limitations: partial ? ["The provider marked this observation incomplete."] : [],
      artifacts: [
        {
          id: artifact.id,
          kind: "image",
          path: artifact.path,
          mimeType: artifact.mimeType,
          bytes: artifact.bytes,
        },
      ],
      provenance: {
        provider: "google",
        model: this.config.model,
        adapter: "gemini-interactions-v1",
        endpoint: GEMINI_ENDPOINT,
        source: "image",
        sourcePath: artifact.path,
        remote: true,
      },
      status: partial ? "partial" : "complete",
    });
  }
}

export function createGeminiAdapter(config: VisionConfig): ObservationProvider {
  return new GeminiAdapter(config);
}

/** Run an already-normalized request through an injected provider. */
export async function runObservation(
  request: ObservationRequest,
  provider: ObservationProvider,
  signal?: AbortSignal,
  secrets: readonly string[] = [],
): Promise<ObservationResult> {
  const normalized = validateObservationRequest(request);
  const protectedValues = [...normalized.artifacts.map((artifact) => artifact.base64), ...secrets].filter(Boolean);
  if (signal?.aborted) throw new ObservationError("aborted", "motto_vision request aborted.");
  let candidate: ObservationResult;
  try {
    candidate = await provider.observe(normalized, signal);
  } catch (error) {
    if (signal?.aborted) throw new ObservationError("aborted", "motto_vision request aborted.");
    if (error instanceof ObservationError) {
      const leaksSensitiveValue = protectedValues.some((value) => error.message.includes(value));
      throw new ObservationError(
        error.kind,
        leaksSensitiveValue ? "motto_vision provider error: sensitive details redacted." : error.message,
        { status: error.status },
      );
    }
    // An arbitrary adapter's exception text/cause is not part of the contract:
    // it may contain its request envelope, credentials, or image bytes.
    throw new ObservationError("provider", "motto_vision provider error.");
  }
  const result = validateObservationResult(candidate);
  if (!normalized.artifacts.some((artifact) => artifact.path === result.provenance.sourcePath)) {
    throw new ObservationError("invalid_output", "motto_vision invalid output: provenance sourcePath is not a requested artifact");
  }
  assertObservationSafe(result, protectedValues);
  return result;
}

/**
 * Full tool pipeline: config → image load → one Gemini request → text result.
 * The same entry point the extension's execute() calls, so tests exercise the
 * exact boundary pi runs. Failures always throw.
 */
export async function runTool(
  params: RunToolParams,
  ctx: RunToolContext,
  env: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
): Promise<RunToolResult> {
  // A fake/injected provider is allowed to run without Gemini configuration;
  // the production path still resolves config before any network request.
  const config = ctx.provider ? undefined : loadConfig(env, { apiKey: ctx.apiKey });
  const image = await loadImage(params.path, ctx.cwd);
  if (params.question.trim().length === 0) {
    throw new ObservationError("input", "motto_vision: visual question is empty.");
  }
  const request: ObservationRequest = validateObservationRequest({
    version: OBSERVATION_VERSION,
    question: params.question,
    artifacts: [
      {
        id: "image-1",
        kind: "image",
        path: image.path,
        mimeType: image.mimeType,
        bytes: image.bytes,
        base64: image.base64,
      } satisfies ObservationArtifactInput,
    ],
  });
  const provider = ctx.provider ?? createGeminiAdapter(config!);
  const started = Date.now();
  const observation = await runObservation(request, provider, signal, config ? [config.apiKey] : []);
  const durationMs = provider instanceof GeminiAdapter ? provider.lastDurationMs : Date.now() - started;
  const usage = provider instanceof GeminiAdapter ? provider.lastUsage : {};
  const model = provider instanceof GeminiAdapter ? provider.config.model : observation.provenance.model;
  const providerStatus = provider instanceof GeminiAdapter
    ? provider.lastProviderStatus
    : observation.status === "complete" ? "completed" : "incomplete";

  return {
    content: [{ type: "text", text: projectObservationResult(observation) }],
    details: {
      model,
      imagePath: image.path,
      mimeType: image.mimeType,
      bytes: image.bytes,
      durationMs,
      status: providerStatus,
      usage,
      observation,
      provenance: observation.provenance,
      artifacts: observation.artifacts,
    },
  };
}
