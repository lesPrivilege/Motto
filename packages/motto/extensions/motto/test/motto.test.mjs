// motto splash/footer/取色单元测试:宽度上界、theme 槽降级、全屏红线。
// 运行:cd ~/.pi/agent && node --test notes/motto.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visibleWidth } from "@earendil-works/pi-tui";
import { buildFooterLine, buildSplash, makeColor } from "../core.ts";

const WIDTHS = [40, 60, 66, 80, 200];
const FACTS = {
	context: ["AGENTS.md"],
	skills: ["archive", "env-audit", "reading-companion", "weread-skills"],
	extensions: ["pi-rewind@0.5.0", "pi-lsp@0.49.4", "pi-subagents@0.14.3", "motto", "motto-review-flow"],
	themes: ["motto-dark", "motto-light"],
};

/** motto 主题形状的 theme 桩(SGR 色码为零可见宽)。 */
const mottoTheme = {
	fg: (slot, text) => `\x1b[38;2;0;0;${slot.length}m${text}\x1b[39m`,
	bold: (text) => `\x1b[1m${text}\x1b[22m`,
};

/** 内置主题形状的 theme 桩:缺 dimmer/mid,对未知槽抛错(与 pi theme.fg 一致)。 */
const stockTheme = {
	fg(slot, text) {
		if (slot !== "text" && slot !== "dim" && slot !== "accent") throw new Error(`Unknown theme color: ${slot}`);
		return `\x1b[38;2;1;1;1m${text}\x1b[39m`;
	},
	bold: (text) => `\x1b[1m${text}\x1b[22m`,
};

function plainWidth(line) {
	return visibleWidth(line.replace(/\x1b\[[0-9;]*m/g, ""));
}

test("splash 渲染恒 ≤ 目标宽度(40/60/66/80/200),且不抛错", () => {
	for (const width of WIDTHS) {
		const color = makeColor(mottoTheme);
		const lines = buildSplash("慎厥身修思永", "deepseek-v4-flash", "2026-08-08", FACTS, width).map((line) =>
			line.segments.map((s) => (s.bold ? color.bold(s.text) : s.slot ? color.fg(s.slot, s.text) : s.text)).join(""),
		);
		for (const line of lines) {
			assert.ok(plainWidth(line) <= width, `w=${width} 超宽 ${plainWidth(line)}: ${JSON.stringify(line.slice(0, 60))}`);
		}
	}
});

test("非 motto 主题(缺 dimmer/mid)不炸:dimmer/mid 降级到 dim", () => {
	const color = makeColor(stockTheme);
	assert.equal(color.fg("dimmer", "x"), stockTheme.fg("dim", "x"));
	assert.equal(color.fg("mid", "x"), stockTheme.fg("dim", "x"));
	assert.equal(color.fg("dim", "x"), stockTheme.fg("dim", "x"));
	assert.equal(color.fg("accent", "x"), stockTheme.fg("accent", "x"));
	// splash 整体在缺槽主题下可渲染。
	const lines = buildSplash("慎厥身修思永", "m", "d", FACTS, 80).map((line) =>
		line.segments.map((s) => (s.bold ? color.bold(s.text) : s.slot ? color.fg(s.slot, s.text) : s.text)).join(""),
	);
	assert.ok(lines.length > 0);
});

function mockCtx(overrides = {}) {
	const entries = [
		{ type: "message", message: { role: "assistant", usage: { input: 135000, output: 18000, cacheRead: 3000000, cacheWrite: 2000, cost: { total: 0.005 } } } },
		{ type: "message", message: { role: "toolResult", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } } } },
	];
	return {
		sessionManager: {
			getCwd: () => "/private/tmp/motto-audit",
			getSessionName: () => undefined,
			getEntries: () => entries,
		},
		model: { id: "deepseek-v4-flash", provider: "deepseek", reasoning: true, contextWindow: 1000000 },
		thinkingLevel: "max",
		getContextUsage: () => ({ contextWindow: 1000000, percent: 0.5 }),
		...overrides,
	};
}

const footerData = {
	getGitBranch: () => "main",
};

test("footer 渲染恒 ≤ 目标宽度(40/60/66/80/200),不抛错", () => {
	for (const width of WIDTHS) {
		const color = makeColor(mottoTheme);
		const line = buildFooterLine(color, mockCtx(), footerData, width);
		assert.ok(plainWidth(line) <= width, `w=${width} 超宽 ${plainWidth(line)}: ${JSON.stringify(line)}`);
	}
});

test("footer 右簇两级退化 + 左簇降级(内置主题缺 mid 时降级不炸)", () => {
	const color = makeColor(stockTheme);
	// 窄到仅剩左簇也能渲染。
	const line = buildFooterLine(color, mockCtx(), footerData, 30);
	assert.ok(plainWidth(line) <= 30, `w=30 超宽: ${plainWidth(line)}`);
	assert.ok(line.length > 0);
});

// ============================================================================
// 全屏红线(与 MOTTO.md Acceptance 一致):无 hex、无 `•`、DECDHL 关闭时不发序列。
// ============================================================================

test("motto 无 hex、间隔符无 •、DECDHL 关闭时无 ESC#3/#4", async () => {
	for (const name of ["../core.ts", "../index.ts"]) {
		const source = readFileSync(new URL(name, import.meta.url), "utf8");
		const codeLines = source.split("\n").filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"));
		for (const line of codeLines) {
			assert.equal(/#[0-9a-fA-F]{6}/.test(line), false, `${name} hex in code: ${line}`);
		}
		assert.equal(codeLines.join("\n").includes("•"), false, `${name} 代码含 • 间隔符`);
		assert.equal(source.includes("\x1b#3"), false, `${name} DECDHL 上序列出现`);
		assert.equal(source.includes("\x1b#4"), false, `${name} DECDHL 下序列出现`);
	}
});
