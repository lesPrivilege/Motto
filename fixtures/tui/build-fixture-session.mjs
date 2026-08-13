#!/usr/bin/env node
// build-fixture-session.mjs — MOTTO-TUI-0 基线会话构建器(确定性、幂等)。
//
// 从 fixtures/tui/scenarios/ 读取内容 fixture,组装一张覆盖全部 TUI 表面的
// session JSONL(resume 渲染路径 renderSessionEntries 消费同款格式)。
// 输出:fixtures/tui/sessions/motto-tui-baseline.jsonl
//
// 运行:cd ~/Projects/Motto && node fixtures/tui/build-fixture-session.mjs
// 渲染:cd ~/Projects/Motto && node fixtures/tui/render-baseline.mjs
// 真终端捕获:./fixtures/tui/ghostty-capture.sh(用户侧,见 README)

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCEN = join(HERE, "scenarios");
const OUT_DIR = join(HERE, "sessions");
const OUT = join(OUT_DIR, "motto-tui-baseline.jsonl");
// 单仓自足:仓根由脚本位置推导(fixtures/tui 上两级),不再硬编码双仓路径。
const CWD = join(HERE, "..", "..");

const read = (name) => readFileSync(join(SCEN, name), "utf8");

const T0 = Date.parse("2026-08-11T00:00:00.000Z");
let seq = 0;
const nextId = () => `f${String(++seq).padStart(4, "0")}`;

const entries = [];
let parentId = null;
const push = (entry) => {
	const id = entry.id ?? nextId();
	entry.id = id;
	if (parentId !== null) entry.parentId = parentId;
	entries.push(entry);
	parentId = id;
	return id;
};
const ts = (i = 0) => new Date(T0 + i * 1000).toISOString();
const tsm = (i = 0) => T0 + i * 1000;

// ---------------------------------------------------------------- 会话头
push({
	type: "session",
	version: 3,
	id: "motto-tui-baseline",
	timestamp: ts(0),
	cwd: CWD,
});

// ---------------------------------------------------------------- 消息助手
const msg = (role, content, extra = {}, i = 0) =>
	push({
		type: "message",
		timestamp: ts(i),
		message: { role, content, timestamp: tsm(i), ...extra },
	});

const text = (t) => ({ type: "text", text: t });
const thinking = (t) => ({ type: "thinking", thinking: t });
const toolCall = (name, id, args) => ({ type: "toolCall", id, name, arguments: args });
const toolResult = (toolCallId, toolName, body, { isError = false, i = 0 } = {}) =>
	msg(
		"toolResult",
		[{ type: "text", text: body }],
		{ toolCallId, toolName, isError },
		i,
	);

// ================================================================ T1 多级 Markdown + 成功 bash
msg("user", [text("用 Motto 的体例简述当前 TUI 层级设计。")], {}, 1);

const a1 = msg(
	"assistant",
	[
		thinking("思考:TUI 层级应分正文、著录、异常三层;常事从简,失败才醒目标记。"),
		text(read("md-multilevel.md")),
		toolCall("bash", "tc-0001", { command: "ls", description: "列出当前目录" }),
	],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	2,
);
toolResult("tc-0001", "bash", read("bash-success.txt"), { i: 3 });

// ================================================================ T2 列表/引用 + read
msg(
	"assistant",
	[text(read("md-list-quote.md")), toolCall("read", "tc-0002", { path: "fixtures/tui/scenarios/md-code.md", offset: 0 })],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	4,
);
toolResult("tc-0002", "read", read("md-code.md"), { i: 5 });

// ================================================================ T3 长 paste + 混合输出 bash
msg("user", [text(read("paste-long.txt"))], {}, 6);

msg(
	"assistant",
	[
		text("已收到长文本。以下为混合输出(成功但带 stderr 警告)的工具调用。"),
		toolCall("bash", "tc-0003", { command: "./process.sh --fast" }),
	],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	7,
);
toolResult("tc-0003", "bash", read("bash-mixed.txt"), { i: 8 });

// ================================================================ T4 失败 bash(exit 1)
msg(
	"assistant",
	[
		text("下面的命令预期失败——失败是唯一获得醒目标记的常事。"),
		toolCall("bash", "tc-0004", { command: "node /tmp/script.mjs" }),
	],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	9,
);
toolResult("tc-0004", "bash", read("bash-exit1.txt"), { isError: true, i: 10 });

// ================================================================ T5 空输出 bash
msg(
	"assistant",
	[text("空输出工具调用——验证无内容时的渲染与折叠。"), toolCall("bash", "tc-0005", { command: "true" })],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	11,
);
toolResult("tc-0005", "bash", read("bash-empty.txt"), { i: 12 });

// ================================================================ T6 edit + write
msg(
	"assistant",
	[
		text("编辑与写入的 diff 投影。"),
		toolCall("edit", "tc-0006", {
			path: "fixtures/tui/README.md",
			edits: [{ oldText: "old line", newText: "new line" }],
		}),
		toolCall("write", "tc-0007", { path: "fixtures/tui/out.txt", content: "hello" }),
	],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	13,
);
toolResult(
	"tc-0006",
	"edit",
	"Edited fixtures/tui/README.md: 1 insertion(+), 1 deletion(-)\n\n--- a/fixtures/tui/README.md\n+++ b/fixtures/tui/README.md\n@@ -1,3 +1,3 @@\n-old line\n+new line",
	{ i: 14 },
);
toolResult("tc-0007", "write", "Wrote fixtures/tui/out.txt (5 bytes)", { i: 15 });

// ================================================================ T7 custom tools: cu_see + motto_vision
msg(
	"assistant",
	[
		text("自定义工具调用(computer-use 门禁关闭时的 fail-closed 形态;vision 工具结果形态)。"),
		toolCall("cu_see", "tc-0008", { app_target: "Ghostty" }),
		toolCall("motto_vision", "tc-0009", { path: "fixtures/tui/scenarios/probe.png", question: "描述颜色" }),
	],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	16,
);
toolResult(
	"tc-0008",
	"cu_see",
	"Computer use is not approved in this session. Run the \"/computer-use approve\" command to arm the 8-tool allowlist (session-scoped; resets on restart). The gate lives in the extension's execute path and opens only via a user command.",
	{ isError: true, i: 17 },
);
toolResult(
	"tc-0009",
	"motto_vision",
	"[Vision response] The image is a solid red rectangle (RGB ≈ 0xC0453E). model=gemini-2.5-flash durationMs=4200 tokens=96",
	{ i: 18 },
);

// ================================================================ T8 Unicode/制表/ANSI/长行 + 超长 bash 输出
msg(
	"assistant",
	[
		text(read("unicode-tabs-ansi.txt")),
		toolCall("bash", "tc-0010", { command: "seq 1 300 | awk '{print ...}'" }),
	],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	19,
);
toolResult("tc-0010", "bash", read("bash-huge.txt"), { i: 20 });

// ================================================================ T9 中途取消(aborted)
msg(
	"assistant",
	[
		text("此轮被用户中断。"),
		toolCall("bash", "tc-0011", { command: "sleep 300" }),
	],
	{ stopReason: "aborted", errorMessage: "Operation aborted", model: "deepseek-v4-flash" },
	21,
);

// ================================================================ review-flow 投影(两 turn)
push({
	type: "custom",
	customType: "motto-review-flow.turn.v1",
	data: {
		version: 1,
		turnIndex: 0,
		durationMs: 4551,
		tools: [
			{ name: "bash", category: "execute", target: "ls", metric: "", durationMs: 320, status: "ok", errorLines: [] },
			{ name: "read", category: "explore", target: "fixtures/tui/scenarios/md-code.md", metric: "63 lines", durationMs: 180, status: "ok", errorLines: [] },
			{ name: "bash", category: "execute", target: "./process.sh", metric: "exit 0", durationMs: 902, status: "ok", errorLines: [] },
			{ name: "bash", category: "execute", target: "node /tmp/script.mjs", metric: "exit 1", durationMs: 41, status: "failed", errorLines: ["Error: cannot open input file 'missing.txt'", "    at Object.readFileSync"] },
		],
	},
	timestamp: ts(22),
});

// ================================================================ compaction 条目 + 其后回答
push({
	type: "compaction",
	summary: "前 8 轮已压缩:多级 markdown 投影、列表引用、长 paste、混合/失败/空/超长输出、edit/write、custom tools、unicode 与取消均已验证;后续从 T9 保留。",
	tokensBefore: 48213,
	firstKeptEntryId: entries.find((e) => e.type === "message" && e.message?.role === "assistant" && e.message.content?.some((c) => c.type === "toolCall" && c.id === "tc-0010"))?.id,
	timestamp: ts(23),
});

msg(
	"assistant",
	[text("## 压缩后的回答\n\n这是 compaction 之后的最终回答,验证压缩摘要消息与后续正文的衔接。")],
	{ stopReason: "end_turn", model: "deepseek-v4-flash" },
	24,
);

// ================================================================ 第二个 review 投影(纯文本 turn → 应无条目)
push({
	type: "custom",
	customType: "motto-review-flow.turn.v1",
	data: {
		version: 1,
		turnIndex: 1,
		durationMs: 1204,
		tools: [
			{ name: "bash", category: "execute", target: "true", metric: "exit 0", durationMs: 12, status: "ok", errorLines: [] },
		],
	},
	timestamp: ts(25),
});

// ---------------------------------------------------------------- 写盘
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
console.log(`written ${entries.length} entries -> ${OUT}`);
console.log(`surface coverage: ${entries.filter((e) => e.type === "message").length} messages, ${entries.filter((e) => e.type === "custom").length} custom, 1 compaction`);
