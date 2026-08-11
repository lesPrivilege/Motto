import { McpStdioClient } from "../mcp-client.ts";
import { execFileSync } from "node:child_process";

const BIN = process.env.PEEKABOO_BIN ?? "peekaboo";
const client = new McpStdioClient(BIN, 60_000, 15_000, (m) => console.error("LOG:", m));

const snapshot = () => {
  try {
    return execFileSync("/bin/ps", ["-axo", "pid,ppid,comm,args"], { encoding: "utf8" })
      .split("\n").filter((l) => /peekaboo/.test(l)).join("\n") || "(none)";
  } catch { return "(none)"; }
};

console.log("=== peekaboo processes BEFORE ===");
console.log(snapshot());

await client.start();
await client.listTools();
console.log("\n=== peekaboo processes DURING session (child pid " + client.pid + ") ===");
console.log(snapshot());

// Sockets of the exact child pid, using lsof WITHOUT -i (macOS ignores -p with -i).
const childPid = client.pid!;
try {
  const lsof = execFileSync("/usr/sbin/lsof", ["-nP", "-p", String(childPid)], { encoding: "utf8" });
  const sockLines = lsof.split("\n").filter((l) => /(TCP|UDP|unix|IPv)/.test(l));
  console.log("\n=== child pid " + childPid + " sockets/network ===");
  console.log(sockLines.length ? sockLines.join("\n") : "(none)");
} catch (e) {
  console.log("lsof child: " + (e as Error).message);
}

await client.stop();
await new Promise((r) => setTimeout(r, 800));
console.log("\n=== peekaboo processes AFTER stop ===");
console.log(snapshot());
console.log("\n=== child still alive? ===");
try {
  const ps = execFileSync("/bin/ps", ["-p", String(childPid)], { encoding: "utf8" });
  console.log("YES:\n" + ps);
} catch {
  console.log("no (clean)");
}
