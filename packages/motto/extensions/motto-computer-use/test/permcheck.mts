import { ComputerUse } from "../core.ts";
const cu = new ComputerUse();
const p = await cu.refreshPermissions();
console.log("MCP-process permissions:", JSON.stringify(p));
await cu.stop();
