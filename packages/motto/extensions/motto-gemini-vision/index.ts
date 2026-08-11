/**
 * motto-gemini-vision — pi extension over the shared core (see gemini.ts).
 *
 * Deliberately thin: owns pi integration only (tool schema, registration).
 * The tool pipeline — config, image loading, Gemini request, response
 * parsing — lives in gemini.ts so tests exercise the exact boundary pi runs.
 *
 * motto_vision is a non-deterministic perception tool implemented by Gemini,
 * not a second agent: one local image, one stateless multimodal request,
 * text-only result.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runTool } from "./gemini.ts";

export default function mottoGeminiVision(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "motto_vision",
    label: "Vision",
    description:
      "Inspect one local PNG, JPEG, or WEBP with Gemini and answer one specific visual question. The image bytes are sent to Google. Use only when visual evidence is required; use text tools for text-readable files.",
    promptSnippet: "Inspect one local image with a lightweight Gemini vision model",
    promptGuidelines: [
      "Use motto_vision only when the task requires evidence visible in an image.",
      "Ask a narrow, task-specific question rather than requesting a generic full-image description.",
      "For image-heavy work, switch the main model instead of repeatedly calling motto_vision.",
    ],
    parameters: Type.Object(
      {
        path: Type.String({
          minLength: 1,
          description:
            "Local PNG, JPEG, or WEBP path. Relative paths resolve from the current working directory; absolute and ~/ paths are accepted.",
        }),
        question: Type.String({
          minLength: 1,
          description:
            "A specific visual question. State the evidence to inspect, relevant constraints, and the desired output format.",
        }),
      },
      { additionalProperties: false },
    ),
    // No executionMode override: motto_vision is a stateless one-shot call, so
    // it follows pi's default batch policy. Marking it "sequential" would also
    // serialize unrelated tools in the same batch while limiting only one
    // tool batch — not a quota limiter — so the default parallel strategy is
    // the least-disruptive choice.
    execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
      // Reuse pi's canonical local credential resolution. This reads the
      // provider "google" credential from auth.json/models.json (and pi's
      // normal environment fallback) without the pack owning a secret file.
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("google");
      return runTool({ path: params.path, question: params.question }, { cwd: ctx.cwd, apiKey }, {}, signal);
    },
  });
}
