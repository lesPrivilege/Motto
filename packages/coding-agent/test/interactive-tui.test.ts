import type { Component, Terminal, TUI } from "@earendil-works/pi-tui";
import { Container, isViewportTUI, ScrollView, Text, VStack } from "@earendil-works/pi-tui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getLayoutNode,
	type LayoutNode,
	type ScrollLayoutNode,
	type StackLayoutNode,
} from "../../tui/src/layout-node.ts";
import { VirtualTerminal } from "../../tui/test/virtual-terminal.ts";
import type { FullscreenExitOutput, TuiMode } from "../src/core/settings-manager.ts";
import type { ThinkingFoldState } from "../src/modes/interactive/components/thinking-fold.ts";
import {
	createInteractiveTui,
	createInteractiveTuiReference,
	InteractiveMode,
} from "../src/modes/interactive/interactive-mode.ts";

const clipboardMocks = vi.hoisted(() => ({
	copyToClipboard: vi.fn<(text: string) => Promise<void>>(),
	readClipboardText: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("../src/utils/clipboard.ts", () => clipboardMocks);

class RecordingTerminal extends VirtualTerminal implements Terminal {
	readonly writes: string[] = [];
	startCount = 0;
	stopCount = 0;

	override start(onInput: (data: string) => void, onResize: () => void): void {
		this.startCount += 1;
		super.start(onInput, onResize);
	}

	override write(data: string): void {
		this.writes.push(data);
		super.write(data);
	}

	override stop(): void {
		this.stopCount += 1;
		super.stop();
	}
}

describe("createInteractiveTui", () => {
	it("selects the alternate-screen renderer only when requested", async () => {
		const mainTerminal = new RecordingTerminal();
		const mainTui = createInteractiveTui({
			tuiMode: "regular",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal: mainTerminal,
		});
		expect(mainTui.mode).toBe("regular");
		expect(isViewportTUI(mainTui)).toBe(false);
		mainTui.start();
		await mainTerminal.waitForRender();
		expect(mainTerminal.writes.some((write) => write.includes("\x1b[?1049h"))).toBe(false);
		mainTui.stop();

		const altTerminal = new RecordingTerminal();
		const altTui = createInteractiveTui({
			tuiMode: "fullscreen",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal: altTerminal,
		});
		expect(altTui.mode).toBe("fullscreen");
		expect(isViewportTUI(altTui)).toBe(true);
		altTui.start();
		await altTerminal.waitForRender();
		expect(altTerminal.writes.some((write) => write.includes("\x1b[?1049h"))).toBe(true);
		altTui.stop();
	});

	it("replaces the renderer and restores the previous screen for resume-hint exits", async () => {
		const terminal = new RecordingTerminal(40, 8);
		const renderer = createInteractiveTui({
			tuiMode: "regular",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal,
		});
		let stableUi: TUI;
		const invalidatedModes: TuiMode[] = [];
		const component: Component & { focused: boolean } = {
			focused: false,
			render: () => ["content"],
			invalidate: () => invalidatedModes.push(stableUi.mode),
		};
		renderer.addChild(component);
		renderer.setFocus(component);

		type SwitchContext = {
			renderer: ReturnType<typeof createInteractiveTui>;
			ui: TUI;
			fullscreenLayoutRoot: Component;
			options: { tuiMode?: TuiMode };
			themeController: { rebindTui: () => void };
			extensionTerminalInputSubscriptions: Set<never>;
		};
		const context = Object.assign(Object.create(InteractiveMode.prototype), {
			renderer,
			ui: undefined as unknown as TUI,
			fullscreenLayoutRoot: component,
			options: { tuiMode: "regular" as TuiMode },
			themeController: { rebindTui: () => {} },
			extensionTerminalInputSubscriptions: new Set<never>(),
		}) as SwitchContext;
		stableUi = createInteractiveTuiReference(() => context.renderer);
		context.ui = stableUi;
		const { stopInteractiveTui, switchTuiMode } = InteractiveMode.prototype as unknown as {
			stopInteractiveTui(this: SwitchContext, fullscreenExitOutput: FullscreenExitOutput): void;
			switchTuiMode(this: SwitchContext, mode: TuiMode, restoreProgress?: boolean): boolean;
		};

		renderer.start();
		await terminal.waitForRender();
		expect(switchTuiMode.call(context, "fullscreen", false)).toBe(true);
		await terminal.waitForRender();

		expect(stableUi.mode).toBe("fullscreen");
		expect(context.renderer.children).toEqual([component]);
		expect(context.renderer.getFocusedComponent()).toBe(component);
		expect(component.focused).toBe(true);
		expect(invalidatedModes).toEqual(["fullscreen"]);
		expect([terminal.startCount, terminal.stopCount]).toEqual([2, 1]);

		stopInteractiveTui.call(context, "resume-hint");

		expect(stableUi.mode).toBe("fullscreen");
		expect([terminal.startCount, terminal.stopCount]).toEqual([2, 2]);
	});
});

describe("InteractiveMode right-click paste", () => {
	it("feeds clipboard text to the focused component as a bracketed paste", async () => {
		clipboardMocks.readClipboardText.mockResolvedValue("clipboard text");
		const handleInput = vi.fn<(data: string) => void>();
		const target = { render: () => [], invalidate: () => {}, handleInput } satisfies Component;
		const requestRender = vi.fn();
		const context = {
			renderer: { getFocusedComponent: () => target },
			ui: { requestRender },
		};
		const prototype = InteractiveMode.prototype as unknown as {
			handleRightClickPaste(this: typeof context): Promise<void>;
		};

		await prototype.handleRightClickPaste.call(context);

		expect(handleInput).toHaveBeenCalledWith("\x1b[200~clipboard text\x1b[201~");
		expect(requestRender).toHaveBeenCalledOnce();
	});
});

type CopyCommandContext = {
	session: { getLastAssistantText: () => string | undefined };
	ui: ReturnType<typeof createInteractiveTui>;
	showStatus: (message: string) => void;
	showError: (message: string) => void;
};

type CopyCommandOptions = { flashConfirmation?: boolean };

type CopyCommandPrototype = {
	handleCopyCommand(this: CopyCommandContext, options?: CopyCommandOptions): Promise<void>;
};

const copyCommandPrototype = InteractiveMode.prototype as unknown as CopyCommandPrototype;

describe("InteractiveMode copy confirmation", () => {
	beforeEach(() => {
		clipboardMocks.copyToClipboard.mockReset();
		clipboardMocks.copyToClipboard.mockResolvedValue(undefined);
	});

	it("flashes Copied! for the copy shortcut in fullscreen mode", async () => {
		const terminal = new RecordingTerminal(40, 4);
		const ui = createInteractiveTui({
			tuiMode: "fullscreen",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal,
		});
		const showStatus = vi.fn();
		const showError = vi.fn();
		const context: CopyCommandContext = {
			session: { getLastAssistantText: () => "assistant response" },
			ui,
			showStatus,
			showError,
		};

		ui.start();
		try {
			await terminal.waitForRender();
			await copyCommandPrototype.handleCopyCommand.call(context, { flashConfirmation: true });
			await terminal.waitForRender();

			expect(clipboardMocks.copyToClipboard).toHaveBeenCalledWith("assistant response");
			expect(showStatus).not.toHaveBeenCalled();
			expect(showError).not.toHaveBeenCalled();
			expect(terminal.getViewport().some((line) => line.includes("Copied!"))).toBe(true);
		} finally {
			ui.stop();
		}
	});

	it("keeps the status-line confirmation for the copy shortcut in regular mode", async () => {
		const ui = createInteractiveTui({
			tuiMode: "regular",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal: new RecordingTerminal(),
		});
		const showStatus = vi.fn();
		const showError = vi.fn();
		const context: CopyCommandContext = {
			session: { getLastAssistantText: () => "assistant response" },
			ui,
			showStatus,
			showError,
		};

		await copyCommandPrototype.handleCopyCommand.call(context, { flashConfirmation: true });

		expect(showStatus).toHaveBeenCalledWith("Copied last agent message to clipboard");
		expect(showError).not.toHaveBeenCalled();
	});
});

type ClearStatusContext = {
	activeStatusIndicator: { kind: "working"; dispose: () => void } | undefined;
	statusContainer: Container;
	options: { tuiMode?: TuiMode };
	ui: { getClearOnShrink: () => boolean };
	idleStatus: Component;
};

type InteractiveModePrototype = {
	clearStatusIndicator(this: ClearStatusContext, kind?: "working"): void;
};

const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrototype;

describe("clear-on-shrink status spacing", () => {
	it("reserves status height only on the main-screen renderer", () => {
		for (const [tuiMode, expectedChildren] of [
			["regular", 1],
			["fullscreen", 0],
		] as const) {
			const dispose = vi.fn();
			const context: ClearStatusContext = {
				activeStatusIndicator: { kind: "working", dispose },
				statusContainer: new Container(),
				options: { tuiMode },
				ui: { getClearOnShrink: () => true },
				idleStatus: new Text("", 0, 0),
			};

			interactiveModePrototype.clearStatusIndicator.call(context);

			expect(dispose).toHaveBeenCalledOnce();
			expect(context.statusContainer.children).toHaveLength(expectedChildren);
		}
	});
});

// ---- T2-3:app.thinking.focus / app.thinking.fold 处理器(prototype-call 轻量集成) ----

// 自未设置(缺省 collapsed)出发,连续 fold 的期望态序:preview → full → collapsed → preview。
const stateKeys = ["preview", "full", "collapsed", "preview"] as const;

type ThinkingKeysContext = {
	thinkingEntryOrder: string[];
	thinkingFocusIndex: number;
	thinkingFoldState: Map<string, ThinkingFoldState>;
	showStatus: (message: string) => void;
	ui: { requestRender: () => void };
};

type ThinkingKeysPrototype = {
	handleThinkingFocus(this: ThinkingKeysContext): void;
	handleThinkingFold(this: ThinkingKeysContext): void;
};

const thinkingKeysPrototype = InteractiveMode.prototype as unknown as ThinkingKeysPrototype;

function thinkingContext(overrides: Partial<ThinkingKeysContext> = {}): ThinkingKeysContext {
	return {
		thinkingEntryOrder: [],
		thinkingFocusIndex: 0,
		thinkingFoldState: new Map<string, ThinkingFoldState>(),
		showStatus: vi.fn(),
		ui: { requestRender: vi.fn() },
		...overrides,
	};
}

// ---- T3-1:fullscreen dock 结构集成断言(composer/editor/footer 固定底栏,transcript 滚动) ----

type MountDockContext = {
	fullscreenLayoutRoot: Component | undefined;
};

type MountPrototype = {
	mountInteractiveTui(this: MountDockContext, tui: TUI, components: readonly Component[]): void;
};

const mountPrototype = InteractiveMode.prototype as unknown as MountPrototype;

function expectVStack(node: LayoutNode | undefined): StackLayoutNode {
	expect(node?.type).toBe("vstack");
	return node as StackLayoutNode;
}

function expectScroll(node: LayoutNode | undefined): ScrollLayoutNode {
	expect(node?.type).toBe("scroll");
	return node as ScrollLayoutNode;
}

// 与 InteractiveMode.init() 相同的 dock 组合:transcriptScrollView 包 documentContainer,
// dock VStack 固定 pending/status/widgetsAbove/editor/widgetsBelow/footer。
function buildFullscreenDock() {
	const documentContainer = new Container();
	const pendingMessagesContainer = new Container();
	const statusContainer = new Container();
	const widgetContainerAbove = new Container();
	const widgetContainerBelow = new Container();
	const editorContainer = new Container();
	const footerContainer = new Container();
	const transcriptScrollView = new ScrollView(documentContainer, {
		follow: "end",
		primary: true,
		overscroll: "chain",
	});
	const dock = new VStack([
		{ component: pendingMessagesContainer, shrink: 1, minSize: 0 },
		{ component: statusContainer, shrink: 1, minSize: 0 },
		{ component: widgetContainerAbove, shrink: 1, minSize: 0 },
		{ component: editorContainer, shrink: 1, minSize: 3 },
		{ component: widgetContainerBelow, shrink: 1, minSize: 0 },
		{ component: footerContainer, shrink: 1, minSize: 1 },
	]);
	const fullscreenLayoutRoot = new VStack([
		{ component: transcriptScrollView, basis: 0, grow: 1, shrink: 1, minSize: 1 },
		{ component: dock, basis: "auto", grow: 0, shrink: 1, minSize: 1 },
	]);
	return {
		documentContainer,
		pendingMessagesContainer,
		statusContainer,
		widgetContainerAbove,
		widgetContainerBelow,
		editorContainer,
		footerContainer,
		transcriptScrollView,
		dock,
		fullscreenLayoutRoot,
	};
}

describe("InteractiveMode fullscreen dock composition (T3-1)", () => {
	it("mounts the dock as the alt-screen layout root: transcript scrolls, composer/editor/footer stay fixed", async () => {
		const terminal = new RecordingTerminal(40, 8);
		const tui = createInteractiveTui({
			tuiMode: "fullscreen",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal,
		});
		const {
			documentContainer,
			pendingMessagesContainer,
			statusContainer,
			widgetContainerAbove,
			widgetContainerBelow,
			editorContainer,
			footerContainer,
			transcriptScrollView,
			dock,
			fullscreenLayoutRoot,
		} = buildFullscreenDock();

		// 挂载路径 = 真实 mountInteractiveTui:fullscreen TUI 上 setLayoutRoot(dock)。
		const setLayoutRoot = vi.spyOn(
			tui as unknown as { setLayoutRoot(component: Component | undefined): void },
			"setLayoutRoot",
		);
		const context = Object.assign(Object.create(InteractiveMode.prototype), { fullscreenLayoutRoot });
		mountPrototype.mountInteractiveTui.call(context, tui, [
			documentContainer,
			pendingMessagesContainer,
			statusContainer,
			widgetContainerAbove,
			editorContainer,
			widgetContainerBelow,
			footerContainer,
		]);

		expect(isViewportTUI(tui)).toBe(true);
		expect(tui.children).toEqual([
			documentContainer,
			pendingMessagesContainer,
			statusContainer,
			widgetContainerAbove,
			editorContainer,
			widgetContainerBelow,
			footerContainer,
		]);
		expect(setLayoutRoot).toHaveBeenCalledWith(fullscreenLayoutRoot);

		// 根 VStack:transcript grow + dock basis auto(transcript 滚动, dock 固定)。
		const rootNode = expectVStack(getLayoutNode(fullscreenLayoutRoot));
		expect(rootNode.entries).toHaveLength(2);
		expect(rootNode.entries[0]).toMatchObject({ component: transcriptScrollView, basis: 0, grow: 1 });
		expect(rootNode.entries[1]).toMatchObject({ component: dock, basis: "auto", grow: 0 });

		// transcriptScrollView 是包住 documentContainer 的滚动视图(primary + chain overscroll)。
		const scrollNode = expectScroll(getLayoutNode(transcriptScrollView));
		expect(scrollNode.component).toBe(documentContainer);
		expect(scrollNode.state.primary).toBe(true);
		expect(scrollNode.state.overscroll).toBe("chain");

		// dock VStack 依次固定 pending/status/widgetsAbove/editor/widgetsBelow/footer,
		// composer(editorContainer) 与 footerContainer 都在 dock 内。
		const dockNode = expectVStack(getLayoutNode(dock));
		expect(dockNode.entries.map((entry) => entry.component)).toEqual([
			pendingMessagesContainer,
			statusContainer,
			widgetContainerAbove,
			editorContainer,
			widgetContainerBelow,
			footerContainer,
		]);
		expect(dockNode.entries.map((entry) => entry.minSize)).toEqual([0, 0, 0, 3, 0, 1]);
	});

	it("renders the dock fixed at the bottom while the transcript scrolls", async () => {
		const terminal = new RecordingTerminal(40, 8);
		const tui = createInteractiveTui({
			tuiMode: "fullscreen",
			showHardwareCursor: false,
			logDirectory: "/tmp",
			terminal,
		});
		const { documentContainer, editorContainer, footerContainer, fullscreenLayoutRoot } = buildFullscreenDock();

		// composer(editorContainer) 与 footer 各占 dock 一行可辨识内容。
		const transcript = new Text(Array.from({ length: 8 }, (_, index) => `line ${index + 1}`).join("\n"), 0, 0);
		documentContainer.addChild(transcript);
		editorContainer.addChild(new Text("editor", 0, 0));
		footerContainer.addChild(new Text("footer", 0, 0));

		const context = Object.assign(Object.create(InteractiveMode.prototype), { fullscreenLayoutRoot });
		mountPrototype.mountInteractiveTui.call(context, tui, [documentContainer, editorContainer, footerContainer]);

		tui.start();
		try {
			await terminal.waitForRender();
			const viewport = () => terminal.getViewport().map((line) => line.trimEnd());

			// 底部固定 dock:composer(editor, 高 3) 之上 4 行 transcript,footer 贴底。
			expect(viewport()).toEqual(["line 5", "line 6", "line 7", "line 8", "editor", "", "", "footer"]);

			// transcript 追加内容后滚动, dock(editor/footer) 仍固定贴底。
			transcript.setText(Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n"));
			tui.requestRender(true);
			await terminal.waitForRender();
			expect(viewport()).toEqual(["line 9", "line 10", "line 11", "line 12", "editor", "", "", "footer"]);
		} finally {
			tui.stop();
		}
	});
});

describe("InteractiveMode T2-3 thinking interaction keys", () => {
	it("focus advances the cursor with a 1-based status hint and wraps around", () => {
		const ctx = thinkingContext({ thinkingEntryOrder: ["a1:1", "a1:2", "a2:1"] });

		thinkingKeysPrototype.handleThinkingFocus.call(ctx); // → 1
		expect(ctx.thinkingFocusIndex).toBe(1);
		expect(ctx.showStatus).toHaveBeenLastCalledWith("Thinking 2/3");
		expect(ctx.ui.requestRender).toHaveBeenCalled();

		thinkingKeysPrototype.handleThinkingFocus.call(ctx); // → 2
		expect(ctx.thinkingFocusIndex).toBe(2);
		expect(ctx.showStatus).toHaveBeenLastCalledWith("Thinking 3/3");

		thinkingKeysPrototype.handleThinkingFocus.call(ctx); // → 0 (环绕)
		expect(ctx.thinkingFocusIndex).toBe(0);
		expect(ctx.showStatus).toHaveBeenLastCalledWith("Thinking 1/3");
	});

	it("fold cycles the focused entry collapsed→preview→full→collapsed", () => {
		const fold = new Map<string, ThinkingFoldState>();
		const ctx = thinkingContext({ thinkingEntryOrder: ["a1:1", "a1:2"], thinkingFoldState: fold });

		for (const expected of stateKeys) {
			thinkingKeysPrototype.handleThinkingFold.call(ctx);
			expect(fold.get("a1:1")).toBe(expected);
		}
		expect(ctx.showStatus).toHaveBeenLastCalledWith("Thinking 1/2 · preview");
	});

	it("fold acts on the focused entry after the focus moved", () => {
		const fold = new Map<string, ThinkingFoldState>();
		const ctx = thinkingContext({
			thinkingEntryOrder: ["a1:1", "a1:2"],
			thinkingFocusIndex: 1,
			thinkingFoldState: fold,
		});

		thinkingKeysPrototype.handleThinkingFold.call(ctx);
		expect(fold.get("a1:2")).toBe("preview");
		expect(fold.get("a1:1")).toBeUndefined();
		expect(ctx.showStatus).toHaveBeenLastCalledWith("Thinking 2/2 · preview");
	});

	it("focus and fold no-op without thinking entries", () => {
		const ctx = thinkingContext();

		thinkingKeysPrototype.handleThinkingFocus.call(ctx);
		thinkingKeysPrototype.handleThinkingFold.call(ctx);

		expect(ctx.thinkingFocusIndex).toBe(0);
		expect(ctx.showStatus).not.toHaveBeenCalled();
		expect(ctx.ui.requestRender).not.toHaveBeenCalled();
	});
});
