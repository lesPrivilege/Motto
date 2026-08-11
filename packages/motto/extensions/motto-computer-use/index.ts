/**
 * motto-computer-use — pi extension over the shared core (see core.ts).
 *
 * This file is deliberately thin: it owns pi integration only (tool schemas,
 * registration, lifecycle, status command). The tool-call contract, allowlist,
 * permission preflight, fail-closed mapping, and content conversion live in
 * core.ts so the live tests exercise the exact same boundary pi runs.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import { ComputerUse, TOOL_ALLOWLIST, type AllowedTool } from "./core.ts";

export default function mottoComputerUseExtension(pi: ExtensionAPI): void {
  const log = (msg: string): void => {
    console.error(`[motto-computer-use] ${msg}`);
  };
  const cu = new ComputerUse(undefined, log);

  // -------------------------------------------------------------------------
  // Tool registration (allowlist only)
  // -------------------------------------------------------------------------

  function register<T extends TSchema>(
    name: AllowedTool,
    label: string,
    description: string,
    parameters: T,
    promptGuidelines?: string[],
  ): void {
    pi.registerTool({
      name: `cu_${name}`,
      label,
      description,
      promptSnippet: description.split("\n")[0],
      promptGuidelines,
      parameters,
      executionMode: "sequential",
      execute: async (toolCallId, params, signal) =>
        await cu.runTool(name, params as Record<string, unknown>, signal),
    });
  }

  const SEE_PARAMS = Type.Object({
    app_target: Type.Optional(
      Type.String({
        description:
          "Capture target: omit/'' for all screens; 'screen:INDEX'; 'frontmost'; 'AppName' (e.g. 'Safari'); 'PID:1234'; 'AppName:Window Title'.",
      }),
    ),
    path: Type.Optional(Type.String({ description: "Optional. Path to save the screenshot." })),
    snapshot: Type.Optional(
      Type.String({ description: "Optional. Existing snapshot ID to use instead of creating one." }),
    ),
    annotate: Type.Optional(
      Type.Boolean({ description: "Generate an annotated screenshot with interaction markers and IDs.", default: false }),
    ),
    max_depth: Type.Optional(Type.Number({ description: "Maximum AX traversal depth." })),
    max_elements: Type.Optional(Type.Number({ description: "Maximum AX elements to collect." })),
    max_children: Type.Optional(Type.Number({ description: "Maximum AX children per node." })),
  });

  const IMAGE_PARAMS = Type.Object({
    path: Type.Optional(Type.String({ description: "Optional. Base absolute path for saving the image." })),
    format: Type.Optional(Type.String({ description: "Output format.", enum: ["png", "jpg", "data"] })),
    app_target: Type.Optional(Type.String({ description: "Optional. Capture target (see cu_see)." })),
    capture_focus: Type.Optional(
      Type.String({ description: "Focus behavior.", enum: ["background", "auto", "foreground"], default: "auto" }),
    ),
    scale: Type.Optional(
      Type.String({ description: "Capture scale.", enum: ["logical", "1x", "native", "retina", "2x"], default: "logical" }),
    ),
    retina: Type.Optional(Type.Boolean({ description: "Shorthand for scale=native.", default: false })),
    max_dimension: Type.Optional(
      Type.Integer({ description: "Cap longest edge. Defaults to 1500 when format is 'data'." }),
    ),
  });

  const CLICK_PARAMS = Type.Object({
    query: Type.Optional(Type.String({ description: "Element text or query to click." })),
    on: Type.Optional(
      Type.String({ description: "Opaque element ID copied exactly from current cu_see output." }),
    ),
    coords: Type.Optional(Type.String({ description: "Click at coordinates 'x,y' (global logical points)." })),
    coordinate_space: Type.Optional(
      Type.String({
        description: "Coordinate basis for coords: image_pixels/normalized require coordinate_reference.",
        enum: ["image_pixels", "normalized"],
      }),
    ),
    coordinate_reference: Type.Optional(
      Type.String({ description: "Snapshot reference_id from cu_see. Required for image_pixels/normalized." }),
    ),
    snapshot: Type.Optional(Type.String({ description: "Snapshot ID from cu_see." })),
    wait_for: Type.Optional(Type.Number({ description: "Max ms to wait for element. Default: 5000." })),
    double: Type.Optional(Type.Boolean({ description: "Double-click.", default: false })),
    right: Type.Optional(Type.Boolean({ description: "Right-click.", default: false })),
    foreground: Type.Optional(
      Type.Boolean({ description: "Foreground/global delivery. Background is the default.", default: false }),
    ),
    pid: Type.Optional(Type.Number({ description: "Target process ID for background coordinate clicks." })),
  });

  const TYPE_PARAMS = Type.Object({
    text: Type.Optional(Type.String({ description: "The text to type." })),
    on: Type.Optional(Type.String({ description: "Element ID to type into (from cu_see)." })),
    snapshot: Type.Optional(Type.String({ description: "Snapshot ID from cu_see." })),
    delay: Type.Optional(Type.Number({ description: "Delay between keystrokes in ms. Default: 0." })),
    profile: Type.Optional(Type.String({ description: "Typing profile: linear (default) or human." })),
    wpm: Type.Optional(Type.Number({ description: "Human typing speed (80-220 WPM)." })),
    clear: Type.Optional(Type.Boolean({ description: "Clear the field first (Cmd+A, Delete).", default: false })),
    press_return: Type.Optional(Type.Boolean({ description: "Press return after typing.", default: false })),
    tab: Type.Optional(Type.Number({ description: "Press tab N times." })),
    escape: Type.Optional(Type.Boolean({ description: "Press escape.", default: false })),
    delete: Type.Optional(Type.Boolean({ description: "Press delete/backspace.", default: false })),
  });

  const SCROLL_PARAMS = Type.Object(
    {
      direction: Type.String({ description: "Scroll direction.", enum: ["up", "down", "left", "right"] }),
      on: Type.Optional(Type.String({ description: "Element ID to scroll on (from cu_see)." })),
      snapshot: Type.Optional(Type.String({ description: "Snapshot ID from cu_see." })),
      amount: Type.Optional(Type.Number({ description: "Scroll ticks/lines. Default: 3." })),
      delay: Type.Optional(Type.Number({ description: "Delay between ticks in ms. Default: 2." })),
      smooth: Type.Optional(Type.Boolean({ description: "Smooth scrolling. Default: false." })),
    },
    { additionalProperties: false },
  );

  const HOTKEY_PARAMS = Type.Object(
    {
      keys: Type.String({
        description:
          "Comma-separated chord, e.g. 'cmd,c'. Supported: cmd, shift, alt/option, ctrl, fn, a-z, 0-9, space, return, tab, escape, delete, arrow_*, f1-f12.",
      }),
      hold_duration: Type.Optional(Type.Number({ description: "Press-to-release delay in ms. Default: 50." })),
      app: Type.Optional(Type.String({ description: "Target app name/bundle ID, or 'PID:<n>'." })),
      pid: Type.Optional(Type.Number({ description: "Target process ID for background hotkeys." })),
      window_id: Type.Optional(Type.Number({ description: "Window ID for background hotkeys." })),
      window_title: Type.Optional(Type.String({ description: "Window title (substring match)." })),
      foreground: Type.Optional(Type.Boolean({ description: "Force foreground/global delivery.", default: false })),
    },
    { additionalProperties: false },
  );

  const SET_VALUE_PARAMS = Type.Object(
    {
      on: Type.String({ description: "Opaque element ID from cu_see, or a query string." }),
      value: Type.Union([Type.String(), Type.Boolean(), Type.Integer(), Type.Number()], {
        description: "Value to set on the control.",
      }),
      snapshot: Type.Optional(Type.String({ description: "Snapshot ID from cu_see." })),
    },
    { additionalProperties: false },
  );

  const PERFORM_ACTION_PARAMS = Type.Object(
    {
      on: Type.String({ description: "Opaque element ID from cu_see, or a query string." }),
      action: Type.String({ description: "AX action name, e.g. AXPress, AXShowMenu, AXIncrement." }),
      snapshot: Type.Optional(Type.String({ description: "Snapshot ID from cu_see." })),
    },
    { additionalProperties: false },
  );

  const structuredFirst: string[] = [
    "Start with cu_see to obtain the accessibility tree with opaque element IDs; prefer element IDs (the `on` parameter) over pixel coordinates.",
    "Only use cu_image (or an annotated cu_see) when the accessibility tree is missing or ambiguous — avoid spending vision tokens on every step.",
    "cu_click/cu_type/cu_scroll/cu_hotkey deliver to the target process in the background by default; apps that require a focused key window need foreground:true.",
    "Coordinate clicks are global logical points unless you bind coordinate_space + coordinate_reference to a cu_see snapshot; stale or moved snapshots are rejected by the server.",
  ];

  register(
    "see",
    "Computer Use: see",
    "Observe a macOS app/screen and return a structured accessibility tree with opaque element IDs (plus an optional annotated screenshot). Use this FIRST for any desktop automation task.",
    SEE_PARAMS,
    structuredFirst,
  );
  register(
    "image",
    "Computer Use: image",
    "Capture a screenshot of the screen, app, or window. Returns the image to the model (format 'data') or writes to a path.",
    IMAGE_PARAMS,
    structuredFirst,
  );
  register(
    "click",
    "Computer Use: click",
    "Click an element (by element ID or query) or at coordinates, in the background without taking over the mouse when possible.",
    CLICK_PARAMS,
    structuredFirst,
  );
  register(
    "type",
    "Computer Use: type",
    "Type text (optionally into a specific element), in the background when possible. Supports key flags (tab, escape, delete, press_return, clear).",
    TYPE_PARAMS,
    structuredFirst,
  );
  register(
    "scroll",
    "Computer Use: scroll",
    "Scroll up/down/left/right, optionally within a specific element.",
    SCROLL_PARAMS,
    structuredFirst,
  );
  register(
    "hotkey",
    "Computer Use: hotkey",
    "Press a keyboard chord (e.g. 'cmd,c'), optionally targeted at an app/process/window in the background.",
    HOTKEY_PARAMS,
    structuredFirst,
  );
  register(
    "set_value",
    "Computer Use: set_value",
    "Directly set a value (string/boolean/number) on a settable control via accessibility.",
    SET_VALUE_PARAMS,
    structuredFirst,
  );
  register(
    "perform_action",
    "Computer Use: perform_action",
    "Invoke a named accessibility action (AXPress, AXShowMenu, AXIncrement, …) on an element.",
    PERFORM_ACTION_PARAMS,
    structuredFirst,
  );

  // -------------------------------------------------------------------------
  // Lifecycle + status command
  // -------------------------------------------------------------------------

  pi.on("session_shutdown", async () => {
    await cu.stop();
    log("server stopped");
  });

  pi.registerCommand("computer-use", {
    description:
      "Session gate for motto-computer-use. Subcommands: approve (arm + preflight), revoke (disarm), status (default).",
    handler: async (args: string, ctx: ExtensionContext) => {
      // Report to both the TUI (notify) and stderr (so headless/print-mode
      // invocations of the command stay observable).
      const report = (lines: string[]): void => {
        for (const line of lines) console.error(`[motto-computer-use] ${line}`);
        ctx.ui.notify(lines.join("\n"), "info");
      };
      const sub = args.trim().split(/\s+/)[0] ?? "";

      if (sub === "approve") {
        const result = await cu.approve();
        const perms = result.permissions;
        const lines = [
          "computer-use APPROVED (session-scoped; resets on restart)",
          `  armed:       true`,
          `  permissions: screenRecording=${perms.screenRecording}, accessibility=${perms.accessibility}`,
        ];
        if (result.preflightError) {
          lines.push(`  preflight:   failed (${result.preflightError}) — permissions still fail-closed per call`);
        }
        lines.push(
          "  next:        cu_* tools are now executable; missing permissions still fail closed per call",
        );
        report(lines);
        return;
      }

      if (sub === "revoke") {
        cu.revoke();
        report([
          "computer-use REVOKED",
          "  armed: false — cu_* tools fail closed until '/computer-use approve'",
        ]);
        return;
      }

      // status (default)
      const lines = [
        "motto-computer-use status",
        `  armed:         ${cu.isArmed ? "true (session-scoped; resets on restart)" : "false (fail-closed until /computer-use approve)"}`,
        `  binary:        ${process.env.PEEKABOO_BIN ?? "peekaboo"}`,
        `  expected ver:  ${process.env.PEEKABOO_EXPECTED_VERSION ?? "3.10.0"}`,
        `  server:        ${cu.isConnected ? `running (pid ${cu.serverPid})` : "not started (lazy)"}`,
      ];
      const perms = cu.permissionsSnapshot;
      if (perms) {
        lines.push(
          `  permissions:   screenRecording=${perms.screenRecording}, accessibility=${perms.accessibility}`,
        );
      }
      lines.push(`  allowlist:     ${TOOL_ALLOWLIST.join(", ")}`);
      if (cu.lastErrorDetail) lines.push(`  last error:    ${cu.lastErrorDetail}`);
      lines.push(`  usage:         /computer-use approve | revoke | status`);
      report(lines);
    },
  });
}
