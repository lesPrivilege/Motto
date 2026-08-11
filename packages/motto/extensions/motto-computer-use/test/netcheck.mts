import { McpStdioClient } from "../mcp-client.ts";
import { execFileSync } from "node:child_process";

/**
 * Network check: while an MCP session is live, confirm the child process has
 * no TCP/UDP sockets at all (no telemetry, no uploads). Only stdio pipes.
 *
 * Note: lsof on macOS ignores `-p` when combined with `-i`; use `-p` alone and
 * filter the output.
 */
const BIN = process.env.PEEKABOO_BIN ?? "peekaboo";
const client = new McpStdioClient(BIN, 60_000, 15_000, (m) => console.error("LOG:", m));

await client.start();
await client.listTools();
const pid = client.pid!;

const lsof = execFileSync("/usr/sbin/lsof", ["-nP", "-p", String(pid)], { encoding: "utf8" });
const network = lsof.split("\n").filter((l) => /IPv[46]|TCP|UDP/.test(l) && !/^COMMAND/.test(l));
console.log(`child ${pid} network entries: ${network.length === 0 ? "NONE (clean)" : "\n" + network.join("\n")}`);

await client.callTool("image", { format: "data", max_dimension: 300 }).catch(() => {});
await new Promise((r) => setTimeout(r, 400));
const lsof2 = execFileSync("/usr/sbin/lsof", ["-nP", "-p", String(pid)], { encoding: "utf8" });
const network2 = lsof2.split("\n").filter((l) => /IPv[46]|TCP|UDP/.test(l) && !/^COMMAND/.test(l));
console.log(`child ${pid} network entries after image call: ${network2.length === 0 ? "NONE (clean)" : "\n" + network2.join("\n")}`);

await client.stop();
console.log(network.length === 0 && network2.length === 0 ? "NETCHECK: PASS (no network sockets)" : "NETCHECK: FAIL");
