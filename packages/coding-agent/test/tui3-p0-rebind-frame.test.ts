import type { Component, Terminal, TUI } from "@earendil-works/pi-tui";
import { Container, ScrollView, Text, VStack } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { VirtualTerminal } from "../../tui/test/virtual-terminal.ts";
import { FooterDataProvider } from "../src/core/footer-data-provider.ts";
import { FooterComponent } from "../src/modes/interactive/components/footer.ts";
import { createInteractiveTui, InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { createHarness } from "./suite/harness.ts";

/**
 * TUI-3 P0 修复——composer atomic footer replacement（MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1，
 * decision §9）。用真实生产方法/组件（`InteractiveMode.prototype` 的 resetExtensionUI /
 * setExtensionFooter / commitFooterAfterRebind + 真实 `FooterComponent` + 真实
 * `createInteractiveTui` alt-screen 渲染管线 + RecordingTerminal 80×24）驱动四类拓扑转换：
 *
 *   custom→custom：全程 1→1，无 native 中间帧，composer rect 不变；
 *   custom→native：commit 后一次原子 1→2/3，composer 一次有定义位移；
 *   native→custom：一次原子 2/3→1，composer 一次有定义位移；
 *   bind 失败/取消：一次原子 fallback，不得先 1→2→1。
 *
 * 并含 mutation proof：把 resetExtensionUI 改回旧链（立即恢复原生 footer）→ custom→custom
 * 断言必须失败。
 */
class RecordingTerminal extends VirtualTerminal implements Terminal {
	readonly writes: string[] = [];
	override write(data: string): void {
		this.writes.push(data);
		super.write(data);
	}
}

// 与 InteractiveMode.init() / T3-1 相同的 dock 组合。
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

type ExtensionFooterFactory = (
	tui: TUI,
	theme: unknown,
	footerData: FooterDataProvider,
) => Component & { dispose?(): void };

// 与 Motto extension `registerFooter` 同一契约的单行 footer。
function mottoSingleLineFooter(): Component & { dispose?(): void } {
	return {
		invalidate() {},
		dispose() {},
		render(): string[] {
			return ["motto-footer"];
		},
	};
}

type InteractiveModeProto = {
	mountInteractiveTui(this: RebindContext, tui: TUI, components: readonly Component[]): void;
	setExtensionFooter(this: RebindContext, factory: ExtensionFooterFactory | undefined): void;
	setExtensionHeader(this: RebindContext, factory: unknown): void;
	resetExtensionUI(this: RebindContext): void;
	commitFooterAfterRebind(this: RebindContext): void;
	dismissReloadBox(this: RebindContext, editor: Component): void;
};

// resetExtensionUI / setExtensionFooter / commitFooterAfterRebind 所需上下文：footer 链成员
// 全部真实，其余为惰性桩（不参与本机制）。
type RebindContext = {
	fullscreenLayoutRoot: Component | undefined;
	editorContainer: Container;
	footerContainer: Container;
	footer: FooterComponent;
	customFooter: (Component & { dispose?(): void }) | undefined;
	footerReplacePending: boolean;
	footerDataProvider: FooterDataProvider;
	ui: TUI;
	builtInHeader?: unknown;
	widgetContainerAbove: Container;
	widgetContainerBelow: Container;
	extensionWidgetsAbove: Map<string, Component>;
	extensionWidgetsBelow: Map<string, Component>;
	autocompleteProviderWrappers: unknown[];
	defaultEditor: { onExtensionShortcut?: unknown };
	workingMessage: unknown;
	workingVisible: boolean;
	activeStatusIndicator: { kind?: string; setMessage?(message: string): void } | undefined;
	hideExtensionSelector(): void;
	hideExtensionInput(): void;
	hideExtensionEditor(): void;
	clearExtensionTerminalInputListeners(): void;
	setExtensionFooter(factory: ExtensionFooterFactory | undefined): void;
	setExtensionHeader(_factory: unknown): void;
	clearExtensionWidgets(): void;
	setCustomEditorComponent(_: unknown): void;
	setupAutocompleteProvider(): void;
	updateTerminalTitle(): void;
	setWorkingIndicator(): void;
	setHiddenThinkingLabel(): void;
};

function createRebindContext(
	terminal: RecordingTerminal,
	footer: FooterComponent,
	footerDataProvider: FooterDataProvider,
): { tui: TUI; ctx: RebindContext; dock: ReturnType<typeof buildFullscreenDock> } {
	const tui = createInteractiveTui({
		tuiMode: "fullscreen",
		showHardwareCursor: false,
		logDirectory: "/tmp",
		terminal,
	});
	const dock = buildFullscreenDock();
	dock.documentContainer.addChild(new Text("transcript", 0, 0));
	dock.editorContainer.addChild(new Text("editor", 0, 0));
	dock.footerContainer.addChild(footer); // 内置 footer（native，2/3 行）先挂载

	const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;

	const ctx: RebindContext = {
		fullscreenLayoutRoot: dock.fullscreenLayoutRoot,
		editorContainer: dock.editorContainer,
		footerContainer: dock.footerContainer,
		footer,
		customFooter: undefined,
		footerReplacePending: false,
		footerDataProvider,
		ui: tui,
		widgetContainerAbove: dock.widgetContainerAbove,
		widgetContainerBelow: dock.widgetContainerBelow,
		extensionWidgetsAbove: new Map(),
		extensionWidgetsBelow: new Map(),
		autocompleteProviderWrappers: [],
		defaultEditor: {},
		workingMessage: undefined,
		workingVisible: true,
		activeStatusIndicator: undefined,
		hideExtensionSelector: () => {},
		hideExtensionInput: () => {},
		hideExtensionEditor: () => {},
		clearExtensionTerminalInputListeners: () => {},
		// 生产自引用：resetExtensionUI 内部调用 setExtensionFooter/setExtensionHeader/
		// clearExtensionWidgets，均走真实原型方法（footer 链真实；header 因 builtInHeader
		// 未定义而早退；widgets 容器为空，等价于清空 + requestRender）。
		setExtensionFooter: (factory) => proto.setExtensionFooter.call(ctx, factory),
		setExtensionHeader: (factory) => proto.setExtensionHeader.call(ctx, factory),
		clearExtensionWidgets: () => {
			ctx.extensionWidgetsAbove.clear();
			ctx.extensionWidgetsBelow.clear();
			ctx.ui.requestRender();
		},
		setCustomEditorComponent: () => {},
		setupAutocompleteProvider: () => {},
		updateTerminalTitle: () => {},
		setWorkingIndicator: () => {},
		setHiddenThinkingLabel: () => {},
	};

	proto.mountInteractiveTui.call(ctx, tui, [
		dock.documentContainer,
		dock.pendingMessagesContainer,
		dock.statusContainer,
		dock.widgetContainerAbove,
		dock.editorContainer,
		dock.widgetContainerBelow,
		dock.footerContainer,
	]);
	return { tui, ctx, dock };
}

function rowOf(viewport: string[], needle: string): number {
	return viewport.findIndex((line) => line.includes(needle));
}

function viewportRows(terminal: RecordingTerminal): string[] {
	return terminal.getViewport().map((line) => line.trimEnd());
}

async function renderAndCapture(terminal: RecordingTerminal): Promise<string[]> {
	await terminal.waitForRender();
	return viewportRows(terminal);
}

describe("TUI-3 P0 composer atomic footer replacement（MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1）", () => {
	it("custom→custom：全程 1→1，无 native 中间帧，composer rect 不变", async () => {
		initTheme("dark");
		const harness = await createHarness();
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
				const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;
				tui.start();
				try {
					// baseline：Motto 单行 footer，composer y20、footer 行 23。
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					const baseline = await renderAndCapture(terminal);
					expect(rowOf(baseline, "editor")).toBe(20);
					expect(rowOf(baseline, "motto-footer")).toBe(23);
					expect(baseline[22]).toBe("");

					// reset（修复后：延后 native 恢复，保留 custom footer）→ 异步间隙落盘。
					proto.resetExtensionUI.call(ctx);
					const during = await renderAndCapture(terminal);
					// custom→custom 全程 1→1：无 native 2/3-line 中间帧、composer rect 不变。
					expect(rowOf(during, "editor")).toBe(20);
					expect(rowOf(during, "motto-footer")).toBe(23);
					expect(during[22]).toBe(""); // 无原生 footer 第一行
					expect(ctx.footerReplacePending).toBe(true);

					// extension 重新注册单行 footer → 原子 1→1。
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					const after = await renderAndCapture(terminal);
					expect(rowOf(after, "editor")).toBe(20);
					expect(rowOf(after, "motto-footer")).toBe(23);
					expect(ctx.footerReplacePending).toBe(false);
				} finally {
					tui.stop();
				}
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			harness.cleanup();
		}
	});

	it("custom→native：commit 后一次原子 1→2/3，composer 一次有定义位移", async () => {
		initTheme("dark");
		const harness = await createHarness();
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
				const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;
				tui.start();
				try {
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					const baseline = await renderAndCapture(terminal);
					expect(rowOf(baseline, "editor")).toBe(20);

					// reset 延后 native；期间仍 1 行（无中间帧）。
					proto.resetExtensionUI.call(ctx);
					const during = await renderAndCapture(terminal);
					expect(rowOf(during, "editor")).toBe(20);
					expect(rowOf(during, "motto-footer")).toBe(23);

					// 无新 custom footer → commit 点原子回落 native：恰一次 1→2/3。
					proto.commitFooterAfterRebind.call(ctx);
					const after = await renderAndCapture(terminal);
					expect(rowOf(after, "editor")).toBe(19); // composer 一次有定义位移（上移 1）
					expect(after[22]).not.toBe(""); // 原生 footer 第一行（pwd）
					expect(after[23]).not.toBe(""); // 原生 footer 第二行（stats）
					expect(rowOf(after, "motto-footer")).toBe(-1);
					expect(ctx.footerReplacePending).toBe(false);
				} finally {
					tui.stop();
				}
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			harness.cleanup();
		}
	});

	it("native→custom：一次原子 2/3→1，composer 一次有定义位移", async () => {
		initTheme("dark");
		const harness = await createHarness();
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
				const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;
				tui.start();
				try {
					// 初始无 custom footer：native 两行 footer 在位，composer y19。
					const baseline = await renderAndCapture(terminal);
					expect(rowOf(baseline, "editor")).toBe(19);
					expect(baseline[22]).not.toBe("");
					expect(baseline[23]).not.toBe("");

					// reset：无 custom footer → 无事发生，native 保持。
					proto.resetExtensionUI.call(ctx);
					const during = await renderAndCapture(terminal);
					expect(rowOf(during, "editor")).toBe(19);
					expect(ctx.footerReplacePending).toBe(false);

					// 新会话注册 custom footer → 一次原子 2/3→1，composer 下移回 y20。
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					const after = await renderAndCapture(terminal);
					expect(rowOf(after, "editor")).toBe(20);
					expect(rowOf(after, "motto-footer")).toBe(23);
				} finally {
					tui.stop();
				}
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			harness.cleanup();
		}
	});

	it("bind 失败/取消：一次原子 fallback，不得先 1→2→1", async () => {
		initTheme("dark");
		const harness = await createHarness();
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
				const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;
				tui.start();
				try {
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					const baseline = await renderAndCapture(terminal);
					expect(rowOf(baseline, "editor")).toBe(20);

					// reset 延后 native；期间仍 1 行。
					proto.resetExtensionUI.call(ctx);
					const during = await renderAndCapture(terminal);
					expect(rowOf(during, "editor")).toBe(20);
					expect(rowOf(during, "motto-footer")).toBe(23);

					// bind 失败/取消 → rebindCurrentSession 的 finally 执行 commitFooterAfterRebind：
					// 直接一次原子 fallback 到 native。全程序列 = 1→2（never 1→2→1）：
					// during 从未出现 native 中间帧，after 恰一次落到 native。
					proto.commitFooterAfterRebind.call(ctx);
					const after = await renderAndCapture(terminal);
					expect(rowOf(after, "editor")).toBe(19);
					expect(rowOf(after, "motto-footer")).toBe(-1);
					// 不变量：rebind 期间 composer 未发生「先上移再回位」。
					expect(rowOf(baseline, "editor")).toBe(20);
					expect(rowOf(during, "editor")).toBe(20);
					expect(rowOf(after, "editor")).toBe(19);
					expect(ctx.footerReplacePending).toBe(false);
				} finally {
					tui.stop();
				}
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			harness.cleanup();
		}
	});

	it("reload 收尾：无额外输入即强制提交 footer 行", async () => {
		initTheme("dark");
		const harness = await createHarness();
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
				const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;
				tui.start();
				try {
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					const baseline = await renderAndCapture(terminal);
					expect(rowOf(baseline, "motto-footer")).toBe(23);

					// A reload progress frame can clear the footer cell while the logical footer line
					// remains equal to the renderer's differential baseline. Simulate that exact stale
					// row before the production reload commit helper runs.
					terminal.write("\x1b[24;1H\x1b[2K");
					await terminal.flush();
					expect(rowOf(viewportRows(terminal), "editor")).toBe(20);
					expect(rowOf(viewportRows(terminal), "motto-footer")).toBe(-1);
					proto.dismissReloadBox.call(ctx, new Text("editor", 0, 0));
					const after = await renderAndCapture(terminal);

					// The final reload frame must write the unchanged footer without keyboard input.
					expect(rowOf(after, "editor")).toBe(20);
					expect(rowOf(after, "motto-footer")).toBe(23);
				} finally {
					tui.stop();
				}
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			harness.cleanup();
		}
	});

	it("mutation proof：改回旧链（reset 立即恢复原生 footer）→ custom→custom 断言必须失败", async () => {
		initTheme("dark");
		const harness = await createHarness();
		const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;
		const originalReset = proto.resetExtensionUI;
		// 旧链：resetExtensionUI 立即恢复原生两行 footer（修复前行为）。
		proto.resetExtensionUI = function (this: RebindContext) {
			this.setExtensionFooter(undefined);
		};
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
				tui.start();
				try {
					proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
					await renderAndCapture(terminal);
					proto.resetExtensionUI.call(ctx);
					const during = await renderAndCapture(terminal);
					// 旧链下：原生两行 footer 中间帧出现、composer 上移（y20→y19）。
					expect(rowOf(during, "editor")).toBe(19);
					expect(during[22]).not.toBe("");
					expect(rowOf(during, "motto-footer")).toBe(-1);
					// 若把 custom→custom 验收断言（during 时 composer 必须 y20、无 native
					// 中间帧）套到旧链上，必然失败——证明验收测试能抓住旧链。
					expect(() => {
						expect(rowOf(during, "editor")).toBe(20);
					}).toThrow();
				} finally {
					tui.stop();
				}
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			proto.resetExtensionUI = originalReset;
			harness.cleanup();
		}
	});
});
