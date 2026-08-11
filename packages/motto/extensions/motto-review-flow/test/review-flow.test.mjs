// motto-review-flow 验收测试(体例 gate 6 fixture + GPT 政策 fixture)
// 运行:NODE_PATH=/opt/homebrew/lib/node_modules node --test notes/review-flow.test.mjs
// (从 ~/.pi/agent 下执行;node ≥ 23 原生 type-strip 导入 extensions/*.ts)

import test from "node:test";
import assert from "node:assert/strict";

import factory from "../index.ts";
import {
	buildTurnLines,
	clip,
	diffStats,
	errorTail,
	makeColor,
	makeToolReview,
	toolExitStatus,
	toolMetric,
	toolTarget,
	turnStats,
	turnStatsLine,
	wrapUnits,
} from "../core.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

// ============================================================================
// 一、GPT 政策 fixture(照用)
// ============================================================================

test("clip counts Unicode code points and normalizes whitespace", () => {
	assert.equal(clip("  alpha\n beta  ", 20), "alpha beta");
	assert.equal(clip("甲乙丙丁戊", 4), "甲乙丙…");
});

test("targets never serialize arbitrary content payloads", () => {
	assert.equal(toolTarget("custom_tool", { content: "secret body", token: "secret token" }), "");
	assert.equal(toolTarget("custom_tool", { path: "/tmp/a.txt", content: "secret body" }), "path=/tmp/a.txt");
});

test("built-in targets are review-oriented", () => {
	assert.equal(toolTarget("read", { path: "src/main.ts" }), "src/main.ts");
	assert.equal(toolTarget("grep", { pattern: "packBinding", path: "apps/desktop" }), "/packBinding/ in apps/desktop");
	assert.equal(toolTarget("bash", { command: "pnpm test\n" }), "pnpm test");
	assert.equal(toolTarget("bash", { command: "git status --short" }), "git status");
});

test("command targets never persist credential-shaped arguments", () => {
	const fixtures = [
		['curl -H "Authorization: Bearer xxx" https://example.test', "curl"],
		["deploy sk-project_AbCdEf0123456789", "deploy"],
		["echo eyJhbGciOiJIUzI1NiJ9.c2VjcmV0.c2lnbmF0dXJl", "echo"],
		["curl https://user:password@example.test/path", "curl"],
		["curl https://example.test/callback?value=sk-project_AbCdEf0123456789", "curl"],
		["deploy abcdef0123456789abcdef0123456789", "deploy"],
		["API_TOKEN=secret pnpm test", "pnpm test"],
		["env API_KEY=secret command", "env"],
	];
	for (const [command, expected] of fixtures) {
		const projected = toolTarget("bash", { command });
		assert.equal(projected, expected, command);
		assert.equal(projected.includes("secret"), false, command);
		assert.equal(projected.includes("xxx"), false, command);
	}
	const review = makeToolReview({
		name: "bash",
		args: { command: 'curl -H "Authorization: Bearer xxx" https://example.test' },
		result: { content: [{ type: "text", text: "ok" }] },
		startedAt: 0,
		endedAt: 1,
	});
	assert.equal(review.target, "curl");
	assert.equal(JSON.stringify(review).includes("xxx"), false);
});

test("diff stats ignore file headers", () => {
	assert.deepEqual(diffStats("--- a/a.ts\n+++ b/a.ts\n-old\n+new\n+next\n context"), { additions: 2, deletions: 1 });
});

test("tool metrics stay compact", () => {
	assert.equal(toolMetric("grep", {}, { content: [{ type: "text", text: "a.ts:1\nb.ts:2\n" }] }, false), "2 matches");
	assert.equal(toolMetric("edit", {}, { details: { diff: "--- a\n+++ b\n-old\n+new\n+next" }, content: [] }, false), "+2 −1");
	// run 成功不记输出度量。
	assert.equal(toolMetric("bash", {}, { content: [{ type: "text", text: "first\nsecond\n" }] }, false), "");
	// 失败不记普通度量,由退出状态/错误提要承载。
	assert.equal(toolMetric("bash", {}, { content: [{ type: "text", text: "fatal: failed" }] }, true), "");
});

test("exit status is mechanical projection from native result", () => {
	const exited = { content: [{ type: "text", text: "ok\n\nCommand exited with code 1" }] };
	assert.equal(toolExitStatus(exited), "exit 1");
	const timeout = { content: [{ type: "text", text: "hung\n\nCommand timed out after 30 seconds" }] };
	assert.equal(toolExitStatus(timeout), "timeout 30s");
	const aborted = { content: [{ type: "text", text: "\nCommand aborted" }] };
	assert.equal(toolExitStatus(aborted), "aborted");
	assert.equal(toolExitStatus({ content: [{ type: "text", text: "just some stderr" }] }), "");
});

test("error tail is verbatim stderr tail, dedupes status line", () => {
	const result = {
		content: [{ type: "text", text: "line1\nline2\nline3\n\nCommand exited with code 2" }],
	};
	// 3 行 ≤ 5 行上限,全部保留;状态行去重。
	assert.deepEqual(errorTail(result), ["line1", "line2", "line3"]);
	const long = { content: [{ type: "text", text: Array.from({ length: 10 }, (_, i) => `l${i}`).join("\n") }] };
	assert.deepEqual(errorTail(long), ["l5", "l6", "l7", "l8", "l9"]);
});

test("review record stores projection, not raw args or output", () => {
	const review = makeToolReview({
		name: "write",
		args: { path: "a.ts", content: "secret\nbody" },
		result: { content: [{ type: "text", text: "written" }] },
		isError: false,
		startedAt: 1000,
		endedAt: 1250,
	});
	assert.deepEqual(review, {
		name: "write",
		category: "change",
		target: "a.ts",
		metric: "2 lines",
		status: "ok",
		durationMs: 250,
	});
	assert.equal(JSON.stringify(review).includes("secret"), false);
});

test("failed bash carries exit status and bounded tail", () => {
	const review = makeToolReview({
		name: "bash",
		args: { command: "pnpm test" },
		result: { content: [{ type: "text", text: "AssertionError\n\nCommand exited with code 1" }] },
		isError: true,
		startedAt: 0,
		endedAt: 4000,
	});
	assert.equal(review.status, "error");
	assert.equal(review.metric, "exit 1");
	assert.deepEqual(review.errorLines, ["AssertionError"]);
});

test("turn stats and summary line expose review structure", () => {
	const data = {
		durationMs: 2500,
		tools: [
			{ category: "explore", status: "ok" },
			{ category: "explore", status: "ok" },
			{ category: "change", status: "ok" },
			{ category: "execute", status: "error" },
		],
	};
	assert.deepEqual(turnStats(data.tools), { total: 4, explore: 2, change: 1, execute: 1, other: 0, failed: 1 });
	// 勘误一:汇总行无标签,直接以计数起始。
	assert.equal(turnStatsLine(data), "4 tools · explore 2 · change 1 · run 1 · 1 failed · 2.5s");
});

// ============================================================================
// 二、勘误三:渲染输出 / 标识符红线
// ============================================================================

test("no label or internal design terms in source or output", async () => {
	const fs = await import("node:fs");
	const source = [
		fs.readFileSync(new URL("../core.ts", import.meta.url), "utf8"),
		fs.readFileSync(new URL("../index.ts", import.meta.url), "utf8"),
	].join("\n");
	// 无任何标签词(目/ledger/review 作标签),汇总行直接以计数起始。
	assert.equal(source.includes("目"), false);
	assert.equal(source.includes("ledger"), false);
	assert.equal(/review\s+\d+\s+tools/.test(source), false);
	// 色槽红线:不得出现 success/warning/error/toolTitle/muted 语义色;不得有 ✓/×。
	for (const token of ["theme.fg(\"success\"", "theme.fg(\"warning\"", "theme.fg(\"error\"", "theme.fg(\"toolTitle\"", "theme.fg(\"muted\""]) {
		assert.equal(source.includes(token), false, `forbidden token: ${token}`);
	}
	for (const glyph of ["✓", "×"]) {
		assert.equal(source.includes(glyph), false, `forbidden glyph: ${glyph}`);
	}
	// 无 sendMessage 降级路径。
	assert.equal(source.includes("sendMessage"), false);
});

// ============================================================================
// 三、session 负载有界 + 纯文本 turn 无条目
// ============================================================================

/** 驱动扩展工厂的最小 pi 桩(仅事件路由与 entry 收集,不做任何模型上下文注入)。 */
function makePi() {
	const entries = [];
	const handlers = new Map();
	const pi = {
		appendEntry: (customType, data) => entries.push({ customType, data }),
		registerEntryRenderer: () => {},
		on: (event, handler) => {
			if (!handlers.has(event)) handlers.set(event, []);
			handlers.get(event).push(handler);
		},
	};
	return {
		entries,
		emit: (event, payload) => {
			for (const h of handlers.get(event) ?? []) h(payload);
		},
		pi,
	};
}

test("plain-text turn appends no entry", () => {
	const { pi, entries, emit } = makePi();
	factory(pi);
	emit("turn_start", { type: "turn_start", turnIndex: 0, timestamp: 1000 });
	emit("turn_end", { type: "turn_end", turnIndex: 0, message: {}, toolResults: [] });
	assert.equal(entries.length, 0);
});

test("typical turn (8 tools): projection ≤1KB", () => {
	const { pi, entries, emit } = makePi();
	factory(pi);
	emit("turn_start", { type: "turn_start", turnIndex: 2, timestamp: 0 });
	const tools = [
		["read", { path: "src/case/store.ts" }, { content: [{ type: "text", text: "a\nb\nc" }] }, false],
		["grep", { pattern: "packBinding", path: "apps/desktop" }, { content: [{ type: "text", text: "x.ts:1\ny.ts:2" }] }, false],
		["edit", { path: "src/case/store.ts" }, { details: { diff: "--- a\n+++ b\n-old\n+new" } }, false],
		["bash", { command: "pnpm test" }, { content: [{ type: "text", text: "output" }] }, false],
		["read", { path: "src/case/selectors.ts" }, { content: [{ type: "text", text: "a\nb" }] }, false],
		["write", { path: "src/case/new.ts", content: "line1\nline2\nline3" }, { content: [{ type: "text", text: "ok" }] }, false],
		["find", { pattern: "*.ts", path: "src" }, { content: [{ type: "text", text: "a.ts\nb.ts" }] }, false],
		["ls", { path: "src/case" }, { content: [{ type: "text", text: "a.ts\nb.ts" }] }, false],
	];
	tools.forEach(([name, args, result, isError], i) => {
		emit("tool_execution_start", { type: "tool_execution_start", toolCallId: `c${i}`, toolName: name, args });
		emit("tool_execution_end", { type: "tool_execution_end", toolCallId: `c${i}`, toolName: name, result, isError });
	});
	emit("turn_end", { type: "turn_end", turnIndex: 2, message: {}, toolResults: [] });
	assert.equal(entries.length, 1);
	assert.ok(JSON.stringify(entries[0].data).length <= 1024, `projection too large: ${JSON.stringify(entries[0].data).length} bytes`);
});

test("explore flood (20 tools): bounded, no raw content", () => {
	const { pi, entries, emit } = makePi();
	factory(pi);
	emit("turn_start", { type: "turn_start", turnIndex: 3, timestamp: 1000 });
	for (let i = 0; i < 20; i++) {
		emit("tool_execution_start", { type: "tool_execution_start", toolCallId: `c${i}`, toolName: "read", args: { path: `src/case/file${i}.ts` } });
		emit("tool_execution_end", {
			type: "tool_execution_end",
			toolCallId: `c${i}`,
			toolName: "read",
			result: { content: [{ type: "text", text: `${"x".repeat(60)}\n`.repeat(3) }] },
			isError: false,
		});
	}
	emit("turn_end", { type: "turn_end", turnIndex: 3, message: {}, toolResults: [] });
	assert.equal(entries.length, 1);
	assert.equal(entries[0].customType, "motto-review-flow.turn.v1");
	assert.equal(entries[0].data.tools.length, 20);
	// 有界:不落原始输出,单 turn 投影控制在 ~2.5KB 内(结构开销随工具数线性)。
	const bytes = JSON.stringify(entries[0].data).length;
	assert.ok(bytes <= 2560, `projection too large: ${bytes} bytes`);
	assert.equal(JSON.stringify(entries[0].data).includes("x".repeat(60)), false);
});

test("failed test long stderr: bounded ≤5-line tail, forced visible", () => {
	const { pi, entries, emit } = makePi();
	factory(pi);
	const stderr = Array.from({ length: 200 }, (_, i) => `error line ${i}: ${"detail".repeat(40)}`).join("\n");
	emit("turn_start", { type: "turn_start", turnIndex: 1, timestamp: 0 });
	emit("tool_execution_start", { type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: { command: "pnpm test" } });
	emit("tool_execution_end", { type: "tool_execution_end", toolCallId: "t1", toolName: "bash", result: { content: [{ type: "text", text: stderr + "\n\nCommand exited with code 1" }] }, isError: true });
	emit("turn_end", { type: "turn_end", turnIndex: 1, message: {}, toolResults: [] });

	assert.equal(entries.length, 1);
	const tool = entries[0].data.tools[0];
	assert.equal(tool.status, "error");
	assert.equal(tool.metric, "exit 1");
	assert.ok(tool.errorLines.length <= 5, `tail >5 lines: ${tool.errorLines.length}`);
	for (const line of tool.errorLines) assert.ok(line.length <= 101, `tail line too long: ${line.length}`);
	// 尾部是 stderr 原文截取(非概括),且状态行已去重。
	assert.ok(tool.errorLines[tool.errorLines.length - 1].startsWith("error line 199"), "tail is stderr tail");
	assert.equal(tool.errorLines.some((l) => l.includes("Command exited with code")), false);
	assert.ok(JSON.stringify(entries[0].data).length <= 1024);
});

test("dimmer 缺槽时静默降级(非 motto 主题不炸)", () => {
	const stockTheme = {
		fg: (slot, text) => {
			if (slot === "dimmer") throw new Error(`Unknown theme color: ${slot}`);
			return `${slot}:${text}`;
		},
	};
	const color = makeColor(stockTheme);
	assert.equal(color("dimmer", "22ms"), "dim:22ms");
	assert.equal(color("accent", "x"), "accent:x");
	assert.equal(color("text", "y"), "text:y");
});

// ============================================================================
// 四、两列悬挂 + CJK 双列 + 窗口缩放折行
// ============================================================================

function renderPlain(lines) {
	return lines.map((line) => line.map((u) => u.text).join(""));
}

test("汇总行无标签 + 工具行两列悬挂", () => {
	const data = {
		version: 1,
		turnIndex: 0,
		durationMs: 4200,
		tools: [
			{ name: "read", category: "explore", target: "src/case/store.ts", metric: "184 lines", status: "ok", durationMs: 22 },
			{ name: "edit", category: "change", target: "src/case/store.ts", metric: "+18 −3", status: "ok", durationMs: 17 },
			{ name: "bash", category: "execute", target: "pnpm test", metric: "", status: "ok", durationMs: 4000 },
		],
	};
	const lines = renderPlain(buildTurnLines(data, true, 120));
	assert.equal(lines[0], "  3 tools · explore 1 · change 1 · run 1 · 4.2s");
	assert.equal(lines[1], "  read  src/case/store.ts · 184 lines · 22ms");
	assert.equal(lines[2], "  edit  src/case/store.ts · +18 −3 · 17ms");
	assert.equal(lines[3], "  bash  pnpm test · 4.0s");
});

test("collapsed 态:失败工具强制展示,成功工具折叠", () => {
	const data = {
		version: 1,
		turnIndex: 0,
		durationMs: 5000,
		tools: [
			{ name: "read", category: "explore", target: "a.ts", metric: "1 line", status: "ok", durationMs: 5 },
			{ name: "bash", category: "execute", target: "pnpm test", metric: "exit 1", status: "error", durationMs: 4000, errorLines: ["fatal: no tests", "npm ERR! code 1"] },
		],
	};
	const collapsed = renderPlain(buildTurnLines(data, false, 120));
	assert.equal(collapsed[0], "  2 tools · explore 1 · run 1 · 1 failed · 5.0s");
	assert.ok(collapsed[0].includes("1 failed"));
	// read 不出现(成功折叠),bash 失败行 + 错误提要出现。
	assert.equal(collapsed.some((l) => l.includes("read  a.ts")), false);
	assert.ok(collapsed.some((l) => l.startsWith("  bash  pnpm test · exit 1")), "failed run visible when collapsed");
	assert.ok(collapsed.some((l) => l.includes("fatal: no tests")), "error tail visible when collapsed");
	// 错误提要悬挂到内容列(动词列 4 + 间隔 2 = 6)。
	const preview = collapsed.find((l) => l.includes("fatal: no tests"));
	assert.equal(preview.startsWith("        fatal: no tests"), true, `tail hanging: "${preview}"`);

	const expanded = renderPlain(buildTurnLines(data, true, 120));
	assert.ok(expanded.some((l) => l.startsWith("  read  a.ts")), "expanded shows successful tools");
});

test("窗口缩放折行:续行悬挂对齐,断点在 · 处", () => {
	const data = {
		version: 1,
		turnIndex: 0,
		durationMs: 1200,
		tools: [
			{ name: "read", category: "explore", target: "src/case/very/long/path/store.ts", metric: "184 lines", status: "ok", durationMs: 22 },
			{ name: "edit", category: "change", target: "src/case/store.ts", metric: "+18 −3", status: "ok", durationMs: 17 },
		],
	};
	const lines = renderPlain(buildTurnLines(data, true, 44));
	// 汇总行:著录缩进 2,计数起始。
	const statsLine = lines[0];
	assert.ok(statsLine.startsWith("  2 tools"), `stats starts with count: "${statsLine}"`);
	// 工具行:首行 = 缩进 2 + 动词;续行悬挂第 8 列(缩进 2 + 动词列 4 + 间隔 2)。
	for (const line of lines.slice(1)) {
		if (/^ {2}(read|edit|bash)/.test(line)) continue; // 工具首行
		assert.equal(/^ {8}/.test(line), true, `continuation hanging to col 8: "${line}"`);
	}
});

test("CJK 对象按双列宽度折行,不错列", () => {
	const data = {
		version: 1,
		turnIndex: 0,
		durationMs: 100,
		tools: [
			{ name: "read", category: "explore", target: "src/案例/很长的中文路径名文件.ts", metric: "1 line", status: "ok", durationMs: 10 },
		],
	};
	const lines = renderPlain(buildTurnLines(data, true, 20));
	for (const line of lines) assert.ok(visibleWidth(line) <= 20, `overflow: "${line}" (${visibleWidth(line)})`);
	// 工具行续行悬挂第 8 列(著录缩进 2 + 动词 read 4 + 间隔 2)。
	for (const line of lines) {
		if (/^ {2}(read|edit|bash)/.test(line)) continue; // 工具首行
		if (/^ {2}\d/.test(line)) continue; // 汇总行续行(悬挂第 2 列)
		if (line.startsWith("        ")) {
			assert.equal(/^ {8}/.test(line), true, `CJK continuation hanging: "${line}"`);
		}
	}
});

test("超长单元硬折(错误提要 > 可用宽)", () => {
	const long = "x".repeat(50);
	const lines = wrapUnits([{ text: "      ", slot: null }], [{ text: long, slot: "dim" }], 6, 20);
	const plain = lines.map((l) => l.map((u) => u.text).join(""));
	for (const line of plain) assert.ok(visibleWidth(line) <= 20, `overflow: ${visibleWidth(line)}`);
	for (const line of plain) assert.notEqual(line.trim(), "", `zero-content line: ${JSON.stringify(line)}`);
	assert.ok(plain.length > 1, "long unit hard-wrapped");
});

test("48 列失败提要折行不产生零内容空行", () => {
	const data = {
		version: 1,
		turnIndex: 0,
		durationMs: 100,
		tools: [
			{
				name: "bash",
				category: "execute",
				target: "pnpm test",
				metric: "exit 1",
				status: "error",
				durationMs: 20,
				errorLines: ["AssertionError: expected 3 to equal 4"],
			},
		],
	};
	const lines = renderPlain(buildTurnLines(data, false, 48));
	for (const line of lines) {
		assert.notEqual(line.trim(), "", `zero-content line: ${JSON.stringify(line)}`);
		assert.ok(visibleWidth(line) <= 48, `overflow: "${line}" (${visibleWidth(line)})`);
	}
});

// ============================================================================
// 五、fail-closed(缺 API 静默失活)
// ============================================================================

test("缺 appendEntry/registerEntryRenderer 时静默失活,不抛、不注入上下文", () => {
	const oldPi = {
		// 旧版 pi:无 custom entry API,也无 sendMessage。
		on: () => {},
	};
	assert.doesNotThrow(() => factory(oldPi));
});

test("缺 custom entry API 时启动警告 notify 一次(仅 TUI,不抛)", () => {
	const handlers = new Map();
	const oldPi = {
		on: (event, handler) => {
			if (!handlers.has(event)) handlers.set(event, []);
			handlers.get(event).push(handler);
		},
	};
	assert.doesNotThrow(() => factory(oldPi));
	const sessionStart = handlers.get("session_start") ?? [];
	assert.equal(sessionStart.length, 1, "应注册一个 session_start 警告处理器");
	// TUI 下 notify 一次,warning 类型,文案提及缺失 API。
	const notified = [];
	sessionStart[0]({}, { hasUI: true, ui: { notify: (message, type) => notified.push([message, type]) } });
	assert.equal(notified.length, 1, "应 notify 一次");
	assert.equal(notified[0][1], "warning");
	assert.ok(notified[0][0].includes("appendEntry"), "文案应提及缺失 API");
	// 非 TUI 静默。
	const silent = [];
	sessionStart[0]({}, { hasUI: false, ui: { notify: (message) => silent.push(message) } });
	assert.equal(silent.length, 0, "非 TUI 不提示");
});
