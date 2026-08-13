import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { resolveToolDefinitionForComponent } from "../src/modes/interactive/tool-definition.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

/**
 * TUI-1 S3 live wiring regression (tui-1-s3-live).
 *
 * The interactive mode resolves the definition handed to ToolExecutionComponent
 * through `resolveToolDefinitionForComponent(getAllTools(), name, getToolDefinition)`
 * — the same expression as `InteractiveMode.getToolDefinitionForComponent`. This
 * test drives that exact selection path against a real AgentSession registry, so a
 * regression back to the old direct `session.getToolDefinition(name)` wiring fails
 * (the old path returned the built-in definition for built-in tools).
 */
describe("tool definition wiring for ToolExecutionComponent (tui-1-s3-live)", () => {
	let tempDir: string;
	let agentDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-tool-definition-wiring-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
		initTheme("dark");
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

	// The exact selection expression InteractiveMode.getToolDefinitionForComponent uses.
	function resolveForComponent(session: Awaited<ReturnType<typeof createSession>>, name: string) {
		return resolveToolDefinitionForComponent(session.getAllTools(), name, (n) => session.getToolDefinition(n));
	}

	it("resolves builtin tools to undefined (no custom override)", async () => {
		const session = await createSession();
		expect(session.getAllTools().find((t) => t.name === "read")?.sourceInfo.source).toBe("builtin");
		expect(session.getToolDefinition("read")).toBeDefined(); // registry holds the builtin definition…
		expect(resolveForComponent(session, "read")).toBeUndefined(); // …but the component must not receive it

		expect(session.getAllTools().find((t) => t.name === "bash")?.sourceInfo.source).toBe("builtin");
		expect(resolveForComponent(session, "bash")).toBeUndefined();

		session.dispose();
	});

	it("returns the definition for SDK custom tools", async () => {
		const session = await createSession();
		expect(session.getAllTools().find((t) => t.name === "sdk_tool")?.sourceInfo.source).toBe("sdk");
		expect(resolveForComponent(session, "sdk_tool")).toBe(session.getToolDefinition("sdk_tool"));
		expect(resolveForComponent(session, "sdk_tool")).toBeDefined();

		session.dispose();
	});

	it("returns the definition for extension custom tools", async () => {
		const session = await createSession();
		expect(session.getAllTools().find((t) => t.name === "ext_tool")?.sourceInfo.source).not.toBe("builtin");
		expect(resolveForComponent(session, "ext_tool")).toBe(session.getToolDefinition("ext_tool"));
		expect(resolveForComponent(session, "ext_tool")).toBeDefined();

		session.dispose();
	});

	it("returns the override definition when an extension shadows a builtin name", async () => {
		const session = await createSession({ withReadOverride: true });
		const readInfo = session.getAllTools().find((t) => t.name === "read")!;
		expect(readInfo.sourceInfo.source).not.toBe("builtin"); // extension shadowed the builtin
		const resolved = resolveForComponent(session, "read");
		expect(resolved).toBeDefined();
		expect(resolved!.label).toBe("Extension Read"); // the override, not the builtin definition

		session.dispose();
	});

	it("resolves unknown tools to undefined (fail-open, generic fallback)", async () => {
		const session = await createSession();
		expect(resolveForComponent(session, "no_such_tool")).toBeUndefined();
		expect(session.getToolDefinition("no_such_tool")).toBeUndefined();

		session.dispose();
	});

	it("converges a real builtin read to a single index line when fed the wired resolution", async () => {
		const session = await createSession();
		const component = new ToolExecutionComponent(
			"read",
			"wired-read",
			{ path: "notes.txt" },
			{},
			resolveForComponent(session, "read"),
			{ requestRender: () => {} } as never,
			tempDir,
		);
		component.updateResult({ content: [{ type: "text", text: "hello" }], details: undefined, isError: false }, false);

		const lines = stripAnsi(component.render(80).join("\n"))
			.split("\n")
			.map((line) => line.trimEnd());
		expect(lines).toEqual(["  read notes.txt"]);
		expect(lines.join("\n")).not.toContain("hello"); // no output preview in the chat stream

		session.dispose();
	});

	it("keeps the extension override full card (custom renderer) on success", async () => {
		// Give the override a distinguishable custom renderer.
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
							name: "bash",
							label: "Override Bash",
							description: "Extension override of built-in bash",
							parameters: Type.Object({ command: Type.String() }),
							execute: async () => ({
								content: [{ type: "text", text: "override ok" }],
								details: {},
							}),
							renderCall: () => new Text("override bash call", 0, 0),
							renderResult: () => new Text("override bash result", 0, 0),
						});
					});
				},
			],
		});
		await resourceLoader.reload();
		const { session: overrideSession } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
		});
		await overrideSession.bindExtensions({});

		const component = new ToolExecutionComponent(
			"bash",
			"wired-bash-override",
			{ command: "ls" },
			{},
			resolveForComponent(overrideSession, "bash"),
			{ requestRender: () => {} } as never,
			tempDir,
		);
		component.updateResult({ content: [{ type: "text", text: "file1" }], details: {}, isError: false }, false);
		// Success + settled + collapsed still keeps the full card because the
		// definition is an extension override, not a plain builtin.
		const rendered = stripAnsi(component.render(80).join("\n"));
		expect(rendered).toContain("override bash call");
		expect(rendered).toContain("override bash result");
		expect(rendered).not.toContain("bash ls");

		overrideSession.dispose();
	});
});
