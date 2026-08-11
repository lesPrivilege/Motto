/**
 * Minimal MCP stdio client (newline-delimited JSON-RPC 2.0), zero dependencies.
 *
 * Only what a fixed, known computer-use server (Peekaboo) needs:
 *  - initialize handshake (protocol 2024-11-05)
 *  - notifications/initialized
 *  - tools/list
 *  - tools/call
 *
 * Framing is one JSON-RPC message per line over stdio, per the MCP spec.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

export const MCP_PROTOCOL_VERSION = "2024-11-05";

export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

export interface McpContentBlock {
  type: string;
  text?: unknown;
  data?: unknown;
  mimeType?: unknown;
  [k: string]: unknown;
}

export interface McpCallToolResult {
  content: McpContentBlock[];
  isError: boolean;
  meta?: Record<string, unknown>;
}

export interface McpServerInfo {
  version: string;
  tools: string[];
}

export class McpStdioClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly serverStderr: string[] = [];
  private stopping = false;
  private serverVersion: string | undefined;
  private readonly binary: string;
  private readonly toolTimeoutMs: number;
  private readonly startupTimeoutMs: number;
  private readonly log: (msg: string) => void;
  private readonly childEnv: Record<string, string | undefined>;

  constructor(
    binary: string,
    toolTimeoutMs: number,
    startupTimeoutMs: number,
    log: (msg: string) => void,
    childEnv: Record<string, string | undefined> = {},
  ) {
    this.binary = binary;
    this.toolTimeoutMs = toolTimeoutMs;
    this.startupTimeoutMs = startupTimeoutMs;
    this.log = log;
    this.childEnv = childEnv;
  }

  /** Starts the child and performs the MCP initialize handshake. */
  async start(): Promise<McpServerInfo> {
    if (this.child) return { version: this.serverVersion ?? "unknown", tools: [] };
    this.stopping = false;

    this.log(`spawning ${this.binary} mcp`);
    const child = spawn(this.binary, ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.childEnv },
    });
    this.child = child;

    child.on("error", (err) => {
      this.log(`server process error: ${err.message}`);
      this.failAllPending(new Error(`Peekaboo process error: ${err.message}`));
    });
    child.on("exit", (code, signal) => {
      this.log(`server exited (code=${code}, signal=${signal})`);
      this.failAllPending(
        new Error(`Peekaboo server exited unexpectedly (code=${code}, signal=${signal})`),
      );
      if (this.child === child) this.child = null;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (!text) return;
      this.serverStderr.push(text);
      if (this.serverStderr.length > 50) this.serverStderr.shift();
      this.log(`[peekaboo] ${text}`);
    });

    this.lines = createInterface({ input: child.stdout });
    this.lines.on("line", (line) => this.handleLine(line));
    child.stdout.on("error", (err) => this.log(`server stdout error: ${err.message}`));

    const info = await this.request(
      "initialize",
      {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "motto-computer-use", version: "0.1.0" },
      },
      this.startupTimeoutMs,
    );
    const serverInfo = (info as { serverInfo?: { name?: string; version?: string } })?.serverInfo;
    this.serverVersion = serverInfo?.version ?? "unknown";

    // Fire-and-forget initialized notification.
    this.sendNotification("notifications/initialized", {});

    return { version: this.serverVersion, tools: [] };
  }

  async listTools(): Promise<string[]> {
    const result = (await this.request("tools/list", {}, this.startupTimeoutMs)) as {
      tools?: { name: string }[];
    };
    return (result?.tools ?? []).map((t) => t.name);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallToolResult> {
    const result = (await this.request("tools/call", { name, arguments: args }, this.toolTimeoutMs)) as
      | (McpCallToolResult & { _meta?: Record<string, unknown> })
      | undefined;
    if (result === null || typeof result !== "object") {
      throw new Error(`Peekaboo returned an invalid tools/call response for "${name}"`);
    }
    // JSON-RPC reserves the underscore-prefixed `_meta` member for result
    // metadata; Peekaboo puts its coordinate_context there. Expose it as
    // `meta` so consumers read one field.
    return {
      content: Array.isArray(result.content) ? result.content : [],
      isError: result.isError === true,
      meta: result._meta ?? result.meta,
    };
  }

  /** Stops the child. Idempotent; safe to call repeatedly. */
  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    const child = this.child;
    this.child = null;
    this.lines?.close();
    this.lines = null;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    const exited = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.once("error", () => resolve());
    });
    child.kill("SIGTERM");
    const done = await Promise.race([
      exited,
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), 3_000);
      }),
    ]);
    if (done === "timeout") {
      child.kill("SIGKILL");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1_000))]);
    }
  }

  get running(): boolean {
    return this.child !== null && this.child.exitCode === null;
  }

  /** PID of the spawned server process, or undefined if not running. */
  get pid(): number | undefined {
    return this.child?.pid;
  }

  recentStderr(): string {
    return this.serverStderr.slice(-10).join("\n");
  }

  private request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    const child = this.child;
    if (!child || child.exitCode !== null) {
      return Promise.reject(new Error("Peekaboo server is not running"));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Peekaboo MCP request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const child = this.child;
    if (!child || child.exitCode !== null) return;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let msg: { id?: number; method?: string; error?: unknown; result?: unknown };
    try {
      msg = JSON.parse(line);
    } catch {
      this.log(`ignoring non-JSON server line: ${line.slice(0, 200)}`);
      return;
    }
    if (msg.method !== undefined) {
      // Server->client notification (e.g. tool list changed). Ignored.
      return;
    }
    if (msg.id === undefined) return;
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error !== undefined) {
      const err = msg.error as { message?: string };
      pending.reject(new Error(`Peekaboo MCP error: ${err?.message ?? JSON.stringify(msg.error)}`));
    } else {
      pending.resolve(msg.result);
    }
  }

  private failAllPending(err: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }
}
