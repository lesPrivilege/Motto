#!/usr/bin/env node
// render-baseline.mjs — MOTTO-TUI-0 无头渲染基线(审计脚本,不改产品行为)。
//
// P0-1/P0-2 升级(2026-08-11):--write / --check 两态 + OSC8 归一。
// 用真实 pi 渲染组件(pi-tui Markdown + coding-agent getMarkdownTheme/initTheme)与
// 真实 Motto 主题(motto / motto-dark / motto-light,部署位 ~/.pi/agent/themes),
// 对 fixture 会话的各类正文做确定性渲染,输出基线文本供回归比对与文档引用。
//
// 覆盖:
//   - assistant markdown(原始 vs Motto 投影 projectDeepHeadings)× 5 宽度
//   - 内置 dark 主题对照(记录 stock 基线)
//   - review-flow custom entry(collapsed/expanded)× 宽度
//   - 长 user paste(按 pi user 消息渲染路径)
//
// 运行:
//   node --experimental-strip-types fixtures/tui/render-baseline.mjs --write   # 写基线(重生成)
//   node --experimental-strip-types fixtures/tui/render-baseline.mjs --check   # 与已提交基线逐字节比对
//   (无参数 = --check,防误写)
//
// P0-2 OSC8 归一:渲染前强制 canonical capability(TERM=screen → hyperlinks:false),
// 使输出不随宿主终端能力变化(修复 I0-2 幂等性未受控变量);strip() 同步硬化,
// 完整移除 OSC8 序列(BEL 与 ST 两种终止)。

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

// ---- P0-2 canonical capability:须在任何 getCapabilities() 调用之前设置 ----
// TERM=screen → hyperlinks:false,链接统一渲染为 `text (url)`(跨终端确定);
// COLORTERM=truecolor → trueColor:true,与已提交基线同一 truecolor 色域。
process.env.TERM = "screen";
process.env.COLORTERM = "truecolor";
delete process.env.TERM_PROGRAM;
delete process.env.TMUX;

const HERE = dirname(fileURLToPath(import.meta.url));
const SCEN = join(HERE, "scenarios");
const OUT = join(HERE, "baseline");
const MODE = process.argv.includes("--write") ? "write" : "check";

// 直连全局安装的 pi 包(绝对路径,fixture 自包含;pack 测试则经各自 node_modules 解析)
const PI_CORE = "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
const PI_TUI = "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui/dist/index.js";
const { initTheme, getMarkdownTheme } = await import(PI_CORE);
const { Markdown, visibleWidth } = await import(PI_TUI);

// TUI-1 表面经 fork(lesPrivilege/pi)构建产物渲染:S1 user 左界栏等只在 fork 组件中存在。
// PI_FORK_ROOT 可覆盖(默认 ~/Projects/pi)。
const PI_FORK_ROOT = process.env.PI_FORK_ROOT ?? join(os.homedir(), "Projects", "pi");
const FORK_COMPONENTS = join(
	PI_FORK_ROOT,
	"packages/coding-agent/dist/modes/interactive/components/index.js",
);
const FORK_THEME = join(PI_FORK_ROOT, "packages/coding-agent/dist/modes/interactive/theme/theme.js");
let forkComponents;
let forkTheme;
try {
	forkComponents = await import(FORK_COMPONENTS);
	forkTheme = await import(FORK_THEME);
} catch {
	forkComponents = undefined;
	forkTheme = undefined;
}
function forkUserGutterLines(text, width, themeName) {
	// fork 未构建时(纯 P0 状态)跳过 S1 表面,不参与比对。
	if (!forkComponents || !forkTheme) return null;
	forkTheme.initTheme(themeName);
	const uc = new forkComponents.UserMessageComponent(text);
	return uc.render(width);
}

// S2:assistant 正文经 fork AssistantMessageComponent 渲染(正文列 BODY_INDENT 对齐)。
function forkAssistantBodyLines(text, width, themeName) {
	if (!forkComponents || !forkTheme) return null;
	forkTheme.initTheme(themeName);
	const message = {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-4o-mini",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: {} },
		stopReason: "stop",
		timestamp: Date.now(),
	};
	const comp = new forkComponents.AssistantMessageComponent(message);
	return comp.render(width);
}

// S3:内置工具成功/失败经 fork ToolExecutionComponent 渲染(成功→低对比目行,失败→全卡)。
function forkToolLines(toolName, args, resultText, isError, width, themeName, { expanded = false } = {}) {
	if (!forkComponents || !forkTheme) return null;
	forkTheme.initTheme(themeName);
	const comp = new forkComponents.ToolExecutionComponent(
		toolName,
		"baseline-tool",
		args,
		{},
		undefined,
		{ requestRender: () => {} },
		process.cwd(),
	);
	comp.setExpanded(expanded);
	comp.updateResult({ content: [{ type: "text", text: resultText }], details: {}, isError }, false);
	return comp.render(width);
}

// T2-2:thinking 经 fork AssistantMessageComponent 三态渲染(collapsed 默认 / preview
// 有界摘要 / full 原文),经 fold-state provider 注入;hideThinkingBlock 兼容路径
// (T2-1)经 hidden=true 单独表示,保持全隐行为字节不变。foldState 缺省 = 纯默认
// (无 provider,组件独立可用)。长文本夹具使 preview 与 full 目视可分。
function forkThinkingLines(thinkingText, width, themeName, { foldState, hidden = false } = {}) {
	if (!forkComponents || !forkTheme) return null;
	forkTheme.initTheme(themeName);
	const message = {
		role: "assistant",
		content: [
			{ type: "thinking", thinking: thinkingText },
			{ type: "text", text: "正文段落。thinking 归不著录之列,review-safe 是著录学的不滥收。" },
		],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-4o-mini",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: {} },
		stopReason: "stop",
		timestamp: Date.now(),
	};
	if (hidden) {
		// hideThinkingBlock 兼容路径(T2-1):全隐,每 run 单行标签。
		return new forkComponents.AssistantMessageComponent(message, true).render(width);
	}
	if (foldState === undefined) {
		// 纯默认(collapsed):无 provider,组件独立可用(测试/基线)。
		return new forkComponents.AssistantMessageComponent(message, false).render(width);
	}
	// 三态经 provider 注入(entryId 无关,provider 恒返回目标态)。
	return new forkComponents.AssistantMessageComponent(
		message,
		false,
		undefined,
		"Thinking...",
		1,
		[],
		"b1",
		() => foldState,
	).render(width);
}
const { projectDeepHeadings } = await import(join(HERE, "..", "..", "extensions", "motto", "headings.ts"));
const { buildTurnLines } = await import(join(HERE, "..", "..", "extensions", "motto-review-flow", "core.ts"));

const WIDTHS = [40, 60, 80, 120, 200];
const THEMES = ["dark", "motto", "motto-dark", "motto-light"];
const read = (n) => readFileSync(join(SCEN, n), "utf8");

// strip ANSI(保留可读性):CSI 序列 + OSC 序列(BEL \x07 或 ST \x1b\ 终止,含 OSC8 链接)
const strip = (s) => s
	.replace(/\x1b\[[0-9;:?]*[ -/]*[@-~]/g, "")
	.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
	.replace(/\x1b\\/g, "")
	.replace(/\x1b\([B0]/g, "");

function renderMarkdown(text, width, padX = 1) {
	const md = new Markdown(text, padX, 0, getMarkdownTheme());
	return md.render(width);
}

function block(title, lines) {
	return `──── ${title} ────\n` + lines.join("\n") + "\n";
}

// ---------------------------------------------------------------- 渲染:输出收集 + 逐宽度超宽校验
mkdirSync(OUT, { recursive: true });
const summary = [];
const outputs = new Map();
let overflowLines = 0;

for (const themeName of THEMES) {
	initTheme(themeName);
	const parts = [];
	for (const width of WIDTHS) {
		const raw = renderMarkdown(read("md-multilevel.md"), width);
		const proj = renderMarkdown(
			projectDeepHeadings(read("md-multilevel.md"), { messageType: "assistant", isStreaming: false, availableWidth: width }),
			width,
		);
		parts.push(block(`width=${width} · md-multilevel (raw)`, raw));
		parts.push(block(`width=${width} · md-multilevel (motto-projected)`, proj));
		parts.push(block(`width=${width} · md-list-quote`, renderMarkdown(read("md-list-quote.md"), width)));
		parts.push(block(`width=${width} · md-code`, renderMarkdown(read("md-code.md"), width)));
		parts.push(block(`width=${width} · unicode-tabs-ansi`, renderMarkdown(read("unicode-tabs-ansi.txt"), width)));
		parts.push(block(`width=${width} · paste-long (user)`, renderMarkdown(read("paste-long.txt"), width)));
		const userGutter = forkUserGutterLines(read("paste-long.txt"), width, themeName);
		if (userGutter) parts.push(block(`width=${width} · user-gutter (S1)`, userGutter));
		const assistantBody = forkAssistantBodyLines(read("md-multilevel.md"), width, themeName);
		if (assistantBody) parts.push(block(`width=${width} · assistant-body (S2)`, assistantBody));
		const toolOk = forkToolLines("bash", { command: "ls -la" }, "file1\nfile2", false, width, themeName);
		if (toolOk) parts.push(block(`width=${width} · tool-index-ok (S3)`, toolOk));
		const toolFail = forkToolLines("bash", { command: "./process.sh" }, "Error: boom", true, width, themeName);
		if (toolFail) parts.push(block(`width=${width} · tool-index-fail (S3)`, toolFail));
		const thinkingLong =
			"思考:TUI 的 thinking 披露应分三级——collapsed 单行标签、preview 有界首尾摘要、full 完整原文。" +
			"著录层纪律要求 thinking 默认归不著录之列,故默认 collapsed;仅当用户主动展开时才进入预览或全文。" +
			"preview 预算取 head 64 字符 + 省略号 + tail 40 字符,Text 自动折行保证窄列零超宽;" +
			"full 则是完整原文,经 assistant-thinking Markdown 变换渲染,thinkingText 色 + italic。" +
			"fold 状态纯属 UI 内存,不写 session、不入模型上下文;entryId 由 assistant 消息序数与 run 序数推导," +
			"流式/恢复/重建同源同序,身份稳定(I7-1)。结束标记 TAIL_END_MARKER。";
		const thinkingHidden = forkThinkingLines(thinkingLong, width, themeName, { hidden: true });
		if (thinkingHidden) parts.push(block(`width=${width} · thinking-hidden (T2-1 compat)`, thinkingHidden));
		const thinkingCollapsed = forkThinkingLines(thinkingLong, width, themeName, {});
		if (thinkingCollapsed) parts.push(block(`width=${width} · thinking-collapsed (T2-2)`, thinkingCollapsed));
		const thinkingPreview = forkThinkingLines(thinkingLong, width, themeName, { foldState: "preview" });
		if (thinkingPreview) parts.push(block(`width=${width} · thinking-preview (T2-2)`, thinkingPreview));
		const thinkingFull = forkThinkingLines(thinkingLong, width, themeName, { foldState: "full" });
		if (thinkingFull) parts.push(block(`width=${width} · thinking-full (T2-2)`, thinkingFull));
	}
	const body = parts.join("\n");
	outputs.set(`theme-${themeName}.ansi.txt`, body);
	outputs.set(`theme-${themeName}.txt`, strip(body));
	// 逐宽度超宽校验(I9-1/I4-3):块内每行 ≤ 块标题声明的宽度。
	let currentWidth = null;
	let themeOverflow = 0;
	for (const line of body.split("\n")) {
		const m = /^──── width=(\d+) ·/.exec(line);
		if (m) { currentWidth = Number(m[1]); continue; }
		if (currentWidth === null) continue;
		if (visibleWidth(strip(line)) > currentWidth) themeOverflow++;
	}
	overflowLines += themeOverflow;
	summary.push(`theme ${themeName}: per-width overflow ${themeOverflow}`);
}

// review-flow custom entry 基线
const reviewData = {
	version: 1,
	turnIndex: 0,
	durationMs: 4551,
	tools: [
		{ name: "bash", category: "execute", target: "ls", metric: "", durationMs: 320, status: "ok", errorLines: [] },
		{ name: "read", category: "explore", target: "fixtures/tui/scenarios/md-code.md", metric: "63 lines", durationMs: 180, status: "ok", errorLines: [] },
		{ name: "bash", category: "execute", target: "./process.sh", metric: "exit 0", durationMs: 902, status: "ok", errorLines: [] },
		{ name: "bash", category: "execute", target: "node /tmp/script.mjs", metric: "exit 1", durationMs: 41, status: "failed", errorLines: ["Error: cannot open input file 'missing.txt'", "    at Object.readFileSync"] },
	],
};
const rfParts = [];
for (const themeName of ["motto-dark", "motto-light"]) {
	initTheme(themeName);
	for (const width of WIDTHS) {
		for (const expanded of [false, true]) {
			const lines = buildTurnLines(reviewData, expanded, Math.max(1, Math.floor(width))).map((row) =>
				row.map((u) => (u.slot ? `[${u.slot}]${u.text}` : u.text)).join(""),
			);
			rfParts.push(block(`width=${width} · review-flow ${expanded ? "expanded" : "collapsed"} (theme ${themeName})`, lines));
		}
	}
}
const rfBody = rfParts.join("\n");
outputs.set("review-flow.txt", rfBody);
summary.push(`review-flow: ${rfBody.split("\n").length} lines`);

const manifest = [
	"# MOTTO-TUI-0 无头渲染基线 — 清单",
	`生成时间(UTC): ${new Date().toISOString()}`,
	`pi: @earendil-works/pi-coding-agent 0.84.1 (v0.84.1 -> 53fa77ccd8a279eb87e92294ef3687b03ff80112)`,
	`pi-tui: 0.84.1 | node: ${process.version}`,
	`主题来源: ~/.pi/agent/themes/{motto,motto-dark,motto-light}.json + 内置 dark`,
	`宽度: ${WIDTHS.join("/")}`,
	"",
	...summary,
	"",
	"说明: 本基线为无头渲染层记录;流式、鼠标拖选、pbpaste、Ctrl+O 全局展开、",
	"composer 等交互面由 fixtures/tui/ghostty-capture.sh 在真实 Ghostty 中记录(用户侧)。",
	"",
	"P0-2 OSC8 归一: canonical capability(TERM=screen),输出不随终端能力变化;",
	"--check 与已提交基线逐字节比对(MANIFEST 含时间戳,不计入)。",
].join("\n") + "\n";

// ---------------------------------------------------------------- 逐宽度超宽门禁(I9-1)
if (overflowLines > 0) {
	console.error(`BASELINE_OVERFLOW: ${overflowLines} 行超宽(I9-1 违例)`);
	process.exitCode = 1;
}

// ---------------------------------------------------------------- write / check
if (MODE === "write") {
	for (const [name, content] of outputs) writeFileSync(join(OUT, name), content);
	writeFileSync(join(OUT, "MANIFEST.txt"), manifest);
	console.log(summary.join("\n"));
	console.log(`written ${outputs.size} baseline files + MANIFEST to ${OUT}`);
	process.exit(process.exitCode ?? 0);
}

// check 态:与已提交基线逐字节比对(MANIFEST 含时间戳,不计入),不一致即非零退出
let diffFiles = 0;
for (const [name, content] of outputs) {
	const committed = join(OUT, name);
	if (!readFileSync(committed, "utf8").split("\n").length) { console.error(`MISSING committed baseline: ${name}`); diffFiles++; continue; }
	const prev = readFileSync(committed, "utf8");
	if (prev !== content) {
		const prevLines = prev.split("\n");
		const curLines = content.split("\n");
		let same = 0;
		const max = Math.min(prevLines.length, curLines.length);
		while (same < max && prevLines[same] === curLines[same]) same++;
		console.error(`BASELINE_DIFF: ${name} — ${prevLines.length} → ${curLines.length} 行,首个差异 @${same + 1}`);
		diffFiles++;
	}
}
if (diffFiles > 0) {
	console.error(`BASELINE_CHECK_FAIL: ${diffFiles} 个文件与已提交基线不一致(需 --write 重生成并说明漂移理由)`);
	process.exit(1);
}
console.log(summary.join("\n"));
console.log("BASELINE_CHECK_PASS: 与已提交基线逐字节一致,逐宽度零超宽");
