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
 * TUI-3 P0（MOTTO-TUI-3 重开）——composer 坐标稳定性：真实 rebind 链逐帧证据。
 *
 * 背景：Motto extension 注册单行 footer；`resetExtensionUI()` 会先恢复**原生两行 footer**，
 * 随后 extension 异步 re-bind 再注册单行 footer。若 reset 与 re-register 之间被 render 上屏，
 * composer（editor，dock 内 footer 上方）会先上移再回位 = 用户回报的「上下跳跃、闪烁」。
 *
 * 本文件用**真实生产方法/组件**驱动这条链（`InteractiveMode.prototype.resetExtensionUI` /
 * `setExtensionFooter` + 真实 `FooterComponent` + 真实 `createInteractiveTui` alt-screen
 * 渲染管线 + RecordingTerminal 80×24），在受控异步间隙（渲染计时器先于 re-register 落盘）
 * 逐帧捕获 1→2→1 中间帧，作为 ROOT_CAUSE 的机械证明；并以「原子 rebind」mutation 证明
 * 测试对该机制敏感（改掉中间帧即翻转断言）。
 */
class RecordingTerminal extends VirtualTerminal implements Terminal {
	readonly writes: string[] = [];
	override write(data: string): void {
		this.writes.push(data);
		super.write(data);
	}
}

// 与 InteractiveMode.init() / T3-1 相同的 dock 组合：transcriptScrollView 包 documentContainer，
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

type ExtensionFooterFactory = (
	tui: TUI,
	theme: unknown,
	footerData: FooterDataProvider,
) => Component & { dispose?(): void };

type InteractiveModeProto = {
	mountInteractiveTui(this: RebindContext, tui: TUI, components: readonly Component[]): void;
	setExtensionFooter(this: RebindContext, factory: ExtensionFooterFactory | undefined): void;
	setExtensionHeader(this: RebindContext, factory: unknown): void;
	resetExtensionUI(this: RebindContext): void;
};

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

// resetExtensionUI / setExtensionFooter 所需上下文：footer 链成员全部真实，
// 其余（selector/input/editor/title/working 等）为惰性桩——本测试只证明 footer 链机制。
type RebindContext = {
	fullscreenLayoutRoot: Component | undefined;
	footerContainer: Container;
	footer: FooterComponent;
	customFooter: (Component & { dispose?(): void }) | undefined;
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
	dock.footerContainer.addChild(footer); // 内置 footer 先挂载（reset 后也会恢复它）

	const proto = InteractiveMode.prototype as unknown as InteractiveModeProto;

	const ctx: RebindContext = {
		fullscreenLayoutRoot: dock.fullscreenLayoutRoot,
		footerContainer: dock.footerContainer,
		footer,
		customFooter: undefined,
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
		// 生产自引用：resetExtensionUI 内部会调用 setExtensionFooter/setExtensionHeader/
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

/**
 * 驱动一次真实 logical rebind 并返回三段帧证据：
 *   baseline —— Motto 单行 footer 在位（rebind 前）；
 *   during   —— resetExtensionUI 已恢复原生两行 footer、**渲染在 re-register 前落盘**（异步间隙）；
 *   after    —— extension 重新注册 Motto 单行 footer 后。
 * 80×24：editor 高 3。footer 1 行 → composer y20；footer 2 行 → composer y19（与已证报告一致）。
 */
async function captureRebindFrames(
	terminal: RecordingTerminal,
	footer: FooterComponent,
	footerDataProvider: FooterDataProvider,
): Promise<{ baseline: string[]; during: string[]; after: string[] }> {
	const { tui, ctx } = createRebindContext(terminal, footer, footerDataProvider);
	const proto = InteractiveMode.prototype as unknown as Pick<
		InteractiveModeProto,
		"setExtensionFooter" | "resetExtensionUI"
	>;
	tui.start();
	try {
		// STEP 1 —— Motto 单行 footer 注册（extension registerFooter 契约）。
		proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
		await terminal.waitForRender();
		const baseline = viewportRows(terminal);

		// STEP 2 —— 真实生产链：resetExtensionUI 恢复原生两行 footer。
		proto.resetExtensionUI.call(ctx);
		// 受控异步间隙：渲染计时器（MIN_RENDER_INTERVAL_MS=16，waitForRender 等 20ms）先落盘，
		// 此刻 re-register 尚未发生 → 原生两行中间态应可见。
		await terminal.waitForRender();
		const during = viewportRows(terminal);

		// STEP 3 —— extension re-bind 重新注册 Motto 单行 footer。
		proto.setExtensionFooter.call(ctx, mottoSingleLineFooter);
		await terminal.waitForRender();
		const after = viewportRows(terminal);

		return { baseline, during, after };
	} finally {
		tui.stop();
	}
}

describe("TUI-3 P0 rebind frame stability（真实生产 footer 链）", () => {
	it("驱动 resetExtensionUI → 原生两行 footer → Motto 单行 footer，捕获 1→2→1 中间可见帧", async () => {
		initTheme("dark");
		const harness = await createHarness();
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { baseline, during, after } = await captureRebindFrames(terminal, footer, footerDataProvider);

				// baseline：Motto 单行 footer，composer y20、footer 行 23；行 22 为空。
				expect(rowOf(baseline, "editor")).toBe(20);
				expect(rowOf(baseline, "motto-footer")).toBe(23);
				expect(baseline[22]).toBe("");

				// during：reset 后原生两行 footer 中间态上屏 → composer 上移 1 行（y20→y19）。
				expect(rowOf(during, "editor")).toBe(19);
				expect(during[22]).not.toBe(""); // 原生 footer 第一行（pwd）
				expect(during[23]).not.toBe(""); // 原生 footer 第二行（stats）
				expect(rowOf(during, "motto-footer")).toBe(-1); // 单行 footer 尚未恢复

				// after：re-register 后单行 footer 回位 → composer 回到 y20、行 22 空。
				expect(rowOf(after, "editor")).toBe(20);
				expect(rowOf(after, "motto-footer")).toBe(23);
				expect(after[22]).toBe("");

				// 1→2→1 序列已捕获：footer 1→2→1 行、composer y20→y19→y20（非预期先上移再回位）。
				expect(rowOf(baseline, "editor")).toBe(20);
				expect(rowOf(during, "editor")).toBe(19);
				expect(rowOf(after, "editor")).toBe(20);
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			harness.cleanup();
		}
	});

	it("mutation proof：原子 rebind（原生 footer 可见化延后至单行 footer 就位）后中间帧消失、断言翻转", async () => {
		initTheme("dark");
		const harness = await createHarness();
		const proto = InteractiveMode.prototype as unknown as Pick<InteractiveModeProto, "setExtensionFooter">;
		const original = proto.setExtensionFooter;
		// 模拟候选最小修复（§8.5 改法 b：延后原生 footer 可见化）——reset 时以高度恒定占位替代
		// 原生两行 footer，使 composer 在 rebind 期间不移动。
		proto.setExtensionFooter = function (this: RebindContext, factory: ExtensionFooterFactory | undefined) {
			if (factory === undefined) {
				this.footerContainer.clear();
				this.customFooter = undefined;
				const placeholder: Component & { dispose?(): void } = {
					invalidate() {},
					dispose() {},
					render(): string[] {
						return ["native-deferred"];
					},
				};
				this.footerContainer.addChild(placeholder);
				this.ui.requestRender();
				return;
			}
			return original.call(this, factory);
		};
		try {
			const terminal = new RecordingTerminal(80, 24);
			const footerDataProvider = new FooterDataProvider(harness.tempDir);
			const footer = new FooterComponent(harness.session, footerDataProvider);
			try {
				const { baseline, during, after } = await captureRebindFrames(terminal, footer, footerDataProvider);

				// 修复后：整个 rebind 期间 composer 恒 y20，无 1→2→1 中间帧。
				expect(rowOf(baseline, "editor")).toBe(20);
				expect(rowOf(during, "editor")).toBe(20);
				expect(rowOf(after, "editor")).toBe(20);
				expect(rowOf(during, "motto-footer")).toBe(-1);
				// 原生两行中间态不再可见（占位为单行，行 22 保持空）。
				expect(during[22]).toBe("");
				expect(during[23]).not.toBe(""); // 占位单行 footer 在位

				// 翻转验证：若把上一测试的断言（during 时 composer 必须上移、原生 footer 必须可见）
				// 套到修复后的链上，必然失败——证明原测试对该机制敏感，而非空转。
				expect(() => {
					expect(rowOf(during, "editor")).toBe(19);
				}).toThrow();
			} finally {
				footerDataProvider.dispose();
			}
		} finally {
			proto.setExtensionFooter = original;
			harness.cleanup();
		}
	});
});
