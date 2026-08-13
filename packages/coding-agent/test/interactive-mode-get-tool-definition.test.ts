import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolDefinition, ToolInfo } from "../src/core/extensions/types.ts";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

/**
 * TUI-1 S3 live wiring regression (tui-1-s3-live) — production method under test.
 *
 * These tests invoke the real `InteractiveMode.getToolDefinitionForComponent`
 * through the class prototype with a narrowly-typed fake `this` whose only
 * dependency is a real AgentSession (same pattern as
 * interactive-mode-anthropic-warning.test.ts). A regression back to the old
 * direct `session.getToolDefinition(name)` wiring fails here: built-in tools
 * would resolve to their built-in definition instead of `undefined`.
 */

// Narrow `this` for the production method: it only touches
// `session.getAllTools()` and `session.getToolDefinition(name)`.
type ToolDefinitionResolverThis = {
	session: {
		getAllTools(): ToolInfo[];
		getToolDefinition(name: string): ToolDefinition | undefined;
	};
};

const productionGetToolDefinitionForComponent = (
	InteractiveMode.prototype as unknown as {
		getToolDefinitionForComponent(this: ToolDefinitionResolverThis, toolName: string): ToolDefinition | undefined;
	}
).getToolDefinitionForComponent;

function resolveViaProduction(session: ToolDefinitionResolverThis["session"], toolName: string) {
	return productionGetToolDefinitionForComponent.call({ session }, toolName);
}

describe("InteractiveMode.getToolDefinitionForComponent (production method, tui-1-s3-live)", () => {
	let tempDir: string;
	let agentDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-interactive-get-tool-def-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	async function createSession(options: { withReadOverride?: boolean } = {}) {
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		const sessionManager = SessionManager.inMemory();
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories: [
				(pi) => {
					pi.on("session_start", () => {
						pi.registerTool({
							name: "ext_tool",
							label: "Extension Tool",
							description: "Tool registered by an extension",
							parameters: Type.Object({}),
							execute: async () => ({
								content: [{ type: "text", text: "ok" }],
								details: {},
							}),
						});
						if (options.withReadOverride) {
							pi.registerTool({
								name: "read",
								label: "Extension Read",
								description: "Extension override of the built-in read tool",
								parameters: Type.Object({ path: Type.String() }),
								execute: async () => ({
									content: [{ type: "text", text: "override ok" }],
									details: {},
								}),
							});
						}
					});
				},
			],
		});
		await resourceLoader.reload();

		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
			customTools: [
				{
					name: "sdk_tool",
					label: "SDK Tool",
					description: "Tool registered through createAgentSession",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "ok" }],
						details: {},
					}),
				},
			],
		});
		await session.bindExtensions({});
		return session;
	}

	it("resolves builtin read/bash to undefined via the production method", async () => {
		const session = await createSession();
		// The registry genuinely holds the builtin definitions…
		expect(session.getToolDefinition("read")).toBeDefined();
		expect(session.getToolDefinition("bash")).toBeDefined();
		// …but the production method must not hand them to the component.
		expect(resolveViaProduction(session, "read")).toBeUndefined();
		expect(resolveViaProduction(session, "bash")).toBeUndefined();

		session.dispose();
	});

	it("returns the original definition for SDK custom tools", async () => {
		const session = await createSession();
		const def = session.getToolDefinition("sdk_tool");
		expect(def).toBeDefined();
		expect(resolveViaProduction(session, "sdk_tool")).toBe(def);

		session.dispose();
	});

	it("returns the original definition for extension custom tools", async () => {
		const session = await createSession();
		const def = session.getToolDefinition("ext_tool");
		expect(def).toBeDefined();
		expect(resolveViaProduction(session, "ext_tool")).toBe(def);

		session.dispose();
	});

	it("returns the override definition when an extension shadows a builtin name", async () => {
		const session = await createSession({ withReadOverride: true });
		const resolved = resolveViaProduction(session, "read");
		expect(resolved).toBeDefined();
		expect(resolved!.label).toBe("Extension Read"); // the override, not the builtin definition

		session.dispose();
	});

	it("resolves unknown tools to undefined (fail-open, generic fallback)", async () => {
		const session = await createSession();
		expect(resolveViaProduction(session, "no_such_tool")).toBeUndefined();

		session.dispose();
	});
});
