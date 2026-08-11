/**
 * motto-computer-use core: the tool-call contract that the pi extension and
 * the live tests share. This is the security/behavior boundary — the allowlist,
 * permission preflight, version check, fail-closed error mapping, and content
 * conversion all live here so the tests exercise exactly what pi runs.
 */

import { McpStdioClient, type McpCallToolResult } from "./mcp-client.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const TOOL_ALLOWLIST = [
  "see",
  "image",
  "click",
  "type",
  "scroll",
  "hotkey",
  "set_value",
  "perform_action",
] as const;

export type AllowedTool = (typeof TOOL_ALLOWLIST)[number];

export interface ToolConfig {
  binary: string;
  expectedVersion: string;
  toolTimeoutMs: number;
  startupTimeoutMs: number;
  logLevel: string;
}

function envStr(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
}

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function loadConfig(): ToolConfig {
  return {
    binary: envStr("PEEKABOO_BIN", "peekaboo"),
    expectedVersion: envStr("PEEKABOO_EXPECTED_VERSION", "3.10.0"),
    toolTimeoutMs: envInt("PEEKABOO_TOOL_TIMEOUT_MS", 60_000),
    startupTimeoutMs: envInt("PEEKABOO_STARTUP_TIMEOUT_MS", 15_000),
    logLevel: envStr("PEEKABOO_LOG_LEVEL", "warn"),
  };
}

// ---------------------------------------------------------------------------
// Content mapping (MCP -> pi)
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "text"; text: string; textSignature?: string }
  | { type: "image"; data: string; mimeType: string };

export interface ToolCallDetails {
  tool: AllowedTool;
  coordinate_context: unknown;
}

export interface ToolCallOutput {
  content: ContentBlock[];
  details: ToolCallDetails;
}

export interface PermissionsSnapshot {
  screenRecording: boolean;
  accessibility: boolean;
}

/**
 * Result of arming the session-level gate. Approval is user-intent only;
 * missing permissions are still enforced fail-closed per tool call by
 * requirePermission(). `preflightError` is set when the server could not be
 * reached to refresh the permission snapshot (approval still stands).
 */
export interface ApproveResult {
  permissions: PermissionsSnapshot;
  preflightError?: string;
}

// ---------------------------------------------------------------------------
// Tool runner (shared by the pi extension and the live tests)
// ---------------------------------------------------------------------------

export class ComputerUse {
  private client: McpStdioClient | null = null;
  private starting: Promise<void> | null = null;
  private permissions: PermissionsSnapshot | null = null;
  private lastError: string | undefined;
  /**
   * Session-level gate. Defaults to false; per-session, in-memory, never
   * persisted — a fresh pi process always starts unarmed. Checked at the top
   * of runTool() (the extension execute path) so no harness-side mechanism
   * can open it: only the /computer-use approve user command can.
   */
  private armed = false;
  private readonly config: ToolConfig;
  private readonly log: (msg: string) => void;

  constructor(
    config: ToolConfig = loadConfig(),
    log: (msg: string) => void = (m) => console.error(`[motto-computer-use] ${m}`),
  ) {
    this.config = config;
    this.log = log;
  }

  get isConnected(): boolean {
    return this.client !== null && this.client.running;
  }

  get serverPid(): number | undefined {
    return this.client?.pid;
  }

  get lastErrorDetail(): string | undefined {
    return this.lastError;
  }

  get permissionsSnapshot(): PermissionsSnapshot | null {
    return this.permissions;
  }

  get isArmed(): boolean {
    return this.armed;
  }

  private makeClient(): McpStdioClient {
    return new McpStdioClient(
      this.config.binary,
      this.config.toolTimeoutMs,
      this.config.startupTimeoutMs,
      this.log,
      { PEEKABOO_LOG_LEVEL: this.config.logLevel },
    );
  }

  /** Lazy, single-flight server startup + handshake + preflight checks. */
  async ensureServer(): Promise<McpStdioClient> {
    if (this.client) return this.client;
    if (!this.starting) {
      this.starting = (async () => {
        const c = this.makeClient();
        const { version } = await c.start();
        if (this.config.expectedVersion && version !== this.config.expectedVersion) {
          await c.stop();
          throw new Error(
            `Peekaboo version mismatch: expected ${this.config.expectedVersion}, got ${version}. ` +
              `Update PEEKABOO_EXPECTED_VERSION (or set it to "" to skip).`,
          );
        }
        const tools = await c.listTools();
        const missing = TOOL_ALLOWLIST.filter((t) => !tools.includes(t));
        if (missing.length > 0) {
          await c.stop();
          throw new Error(
            `Peekaboo server is missing allowlisted tools: ${missing.join(", ")}. ` +
              `This build may not match the expected surface; pin a compatible version.`,
          );
        }
        this.permissions = await this.readPermissions(c);
        this.client = c;
        this.lastError = undefined;
        this.log(
          `connected: version=${version}, tools=${tools.length}, ` +
            `screenRecording=${this.permissions?.screenRecording}, accessibility=${this.permissions?.accessibility}`,
        );
      })().catch((err) => {
        this.lastError = err instanceof Error ? err.message : String(err);
        this.starting = null;
        throw err;
      });
    }
    return this.starting.then(() => {
      if (!this.client) throw new Error("Peekaboo server failed to start");
      return this.client;
    });
  }

  private async readPermissions(c: McpStdioClient): Promise<PermissionsSnapshot> {
    try {
      const result = await c.callTool("permissions", {});
      const text = result.content
        .map((b) => (b.type === "text" ? String(b.text ?? "") : ""))
        .join("\n");
      return {
        screenRecording: /Screen Recording:.*Granted/i.test(text),
        accessibility: /Accessibility:.*Granted/i.test(text),
      };
    } catch (err) {
      this.log(`permissions preflight failed: ${err instanceof Error ? err.message : String(err)}`);
      return { screenRecording: false, accessibility: false };
    }
  }

  /** Refresh the cached permission snapshot from the server. */
  async refreshPermissions(): Promise<PermissionsSnapshot> {
    const c = await this.ensureServer();
    this.permissions = await this.readPermissions(c);
    return this.permissions;
  }

  /**
   * Arm the session-level gate and run a best-effort permission preflight.
   * Arming happens first, so approval stands even when the server cannot be
   * reached; the preflight result (or its error) is returned for the command
   * to report. Missing permissions remain fail-closed per tool call.
   */
  async approve(): Promise<ApproveResult> {
    this.armed = true;
    try {
      const c = await this.ensureServer();
      this.permissions = await this.readPermissions(c);
      return { permissions: this.permissions };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      return {
        permissions: { screenRecording: false, accessibility: false },
        preflightError: msg,
      };
    }
  }

  /** Disarm the session-level gate. Idempotent. */
  revoke(): void {
    this.armed = false;
  }

  /** Throws when a required permission is missing so the tool fails closed. */
  requirePermission(kind: "screenRecording" | "accessibility"): void {
    if (this.permissions === null) return; // preflight didn't run; server errors will surface
    if (kind === "screenRecording" && !this.permissions.screenRecording) {
      throw new Error(
        "Screen Recording permission is missing. Grant it to the host running `peekaboo` " +
          "in System Settings > Privacy & Security > Screen & System Audio Recording, " +
          "then retry. (motto-computer-use fails closed and does not auto-grant.)",
      );
    }
    if (kind === "accessibility" && !this.permissions.accessibility) {
      throw new Error(
        "Accessibility permission is missing, so UI automation (click/type/scroll/…) is unavailable. " +
          "Grant it to the host running `peekaboo` in System Settings > Privacy & Security > Accessibility. " +
          "Screen capture (see/image) still works. (motto-computer-use fails closed.)",
      );
    }
  }

  /**
   * Execute an allowlisted tool with the exact wrapper semantics:
   * allowlist guard, permission preflight, isError -> thrown Error, and
   * MCP content -> pi content conversion. This is what the pi extension calls.
   */
  async runTool(
    name: AllowedTool,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolCallOutput> {
    // Defense in depth: even though only allowlisted tools are registered,
    // refuse anything outside the allowlist here too.
    if (!(TOOL_ALLOWLIST as readonly string[]).includes(name)) {
      throw new Error(`Refusing tool "${name}": not in the motto-computer-use allowlist.`);
    }

    // Session gate: fail closed before any server interaction when the user
    // has not approved computer use in this session.
    if (!this.armed) {
      throw new Error(
        `Computer use is not approved in this session. Run the "/computer-use approve" command ` +
          `to arm the ${TOOL_ALLOWLIST.length}-tool allowlist (session-scoped; resets on restart). ` +
          `The gate lives in the extension's execute path and opens only via a user command.`,
      );
    }

    const c = await this.ensureServer();
    if (signal?.aborted) throw new Error("Operation aborted");

    // Fail closed on missing permissions.
    if (name === "see" || name === "image") this.requirePermission("screenRecording");
    if (["click", "type", "scroll", "hotkey", "set_value", "perform_action"].includes(name)) {
      this.requirePermission("accessibility");
    }

    let result: McpCallToolResult;
    try {
      result = await c.callTool(name, params);
    } catch (err) {
      if (signal?.aborted) throw new Error("Operation aborted");
      throw err;
    }

    if (result.isError) {
      const text = result.content
        .map((b) => (b.type === "text" ? String(b.text ?? "") : "[image]"))
        .join("\n")
        .trim();
      throw new Error(`Peekaboo "${name}" failed: ${text || "unknown server error"}`);
    }

    const content: { type: "text"; text: string }[] = [];
    const images: { type: "image"; data: string; mimeType: string }[] = [];
    for (const block of result.content) {
      if (block.type === "text") {
        content.push({ type: "text", text: String(block.text ?? "") });
      } else if (block.type === "image" && typeof block.data === "string") {
        images.push({
          type: "image",
          data: block.data,
          mimeType: typeof block.mimeType === "string" ? block.mimeType : "image/png",
        });
      } else {
        content.push({
          type: "text",
          text: `[${block.type ?? "unknown"} content omitted]`,
        });
      }
    }

    return {
      content: [...content, ...images],
      details: {
        tool: name,
        coordinate_context: result.meta?.coordinate_context ?? null,
      },
    };
  }

  /** Stop the server (idempotent). */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
      this.starting = null;
    }
  }
}
