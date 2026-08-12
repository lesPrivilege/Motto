// motto 品牌化单测:「功能语不可侵」。
// 回归锚点:曾用全文正则把独立 "pi" 替换为 "Motto",越界改写 `.pi`/`/pi` 路径
// (~/.pi/agent/skills/... → ~/.Motto/agent/skills/...)导致 skill 读取 ENOENT。
// 修复为只注入身份段,上游提示词原文逐字节不动。凡例见 docs/MOTTO.md 总纲五.5。
import { test } from "node:test";
import assert from "node:assert/strict";
import { injectBrandIdentity } from "../core.ts";

// 上游提示词样本:覆盖三类功能 token(任务规格要求)——
//   `.pi` 路径(~/.pi/agent/skills/...)、`pi-subagents` 包名、`@earendil-works/pi-*` 前缀;
// 另加 `/pi` 路径与 `pi` 命令/环境变量,防同一正则缺陷换位复发。
const PROMPT_SAMPLE = [
	"# System prompt (upstream, byte-for-byte sacred)",
	"",
	"Skills live under ~/.pi/agent/skills/<name>/SKILL.md and are loaded by path.",
	"pi-subagents is the subagent pack; pi-rewind and pi-lsp are sibling packs.",
	"Import the SDK from @earendil-works/pi-coding-agent; TUI utils from @earendil-works/pi-tui.",
	"The CLI binary is at /usr/local/pi/bin/pi; env PI_CODING_AGENT_DIR points at the agent dir.",
	"pi is the agent; run `pi --version` and `pi --help` for usage.",
].join("\n");

test("品牌化不改写上游提示词:含 .pi 路径/pi-subagents/@earendil-works/pi-* 样本逐字节不变", () => {
	const out = injectBrandIdentity(PROMPT_SAMPLE);
	// 结果 = 原文(逐字节)+ 追加身份段;原文不得有任何改动。
	assert.equal(out.slice(0, PROMPT_SAMPLE.length), PROMPT_SAMPLE, "上游原文必须逐字节保留");
	assert.ok(out.length > PROMPT_SAMPLE.length, "身份段必须追加在原文之后");
	// 无 .pi → .Motto / /pi → /Motto 类污染。
	assert.equal(out.includes(".Motto"), false, ".pi 路径不得被改写");
	assert.equal(out.includes("/Motto"), false, "/pi 路径不得被改写");
	// 三(四)类功能 token 原样在位。
	for (const token of [
		"~/.pi/agent/skills/<name>/SKILL.md",
		"pi-subagents",
		"pi-rewind",
		"pi-lsp",
		"@earendil-works/pi-coding-agent",
		"@earendil-works/pi-tui",
		"/usr/local/pi/bin/pi",
		"PI_CODING_AGENT_DIR",
		"`pi --version`",
	]) {
		assert.equal(out.includes(token), true, `功能 token 缺失: ${token}`);
	}
});

test("身份段照常生效:追加于末尾,含 Motto 身份与功能语不可侵条款", () => {
	const out = injectBrandIdentity(PROMPT_SAMPLE);
	assert.ok(out.includes("## Motto identity"), "身份段标题必须存在");
	assert.ok(out.includes("presented as Motto"), "身份声明必须存在");
	// 条款在原文中跨行(按 80 列折行),分段断言。
	assert.ok(out.includes("Keep technical package,"), "「功能语不可侵」条款(前段)必须存在");
	assert.ok(out.includes("command, path, and API names unchanged"), "「功能语不可侵」条款(后段)必须存在");
	// 身份段必须整体落在原文之后(纯追加,不侵入原文内部)。
	const tail = out.slice(PROMPT_SAMPLE.length);
	assert.ok(tail.includes("## Motto identity"), "身份段必须位于原文之后");
	assert.equal(tail.length > 0, true);
});

test("卡片用法段随身份段注入:含卡片语法与展示层约定", () => {
	const out = injectBrandIdentity(PROMPT_SAMPLE);
	assert.ok(out.includes("## 卡片用法"), "卡片用法小节必须存在");
	// 三顿号围栏语法(开/闭围栏 + 首行标题 + 内容)必须在位。
	assert.ok(out.includes("、、、"), "顿号围栏标记必须存在");
	assert.ok(out.includes("首个非空行为标题"), "标题规则必须存在");
	// 展示层边界:卡片不影响模型上下文 / session。
	assert.ok(out.includes("展示层约定"), "展示层约定声明必须存在");
	assert.ok(out.includes("模型上下文 / session"), "不改模型上下文 / session 条款必须存在");
	// 新段位于身份段之后(纯追加,不侵入上游原文与既有身份段)。
	const tail = out.slice(PROMPT_SAMPLE.length);
	assert.ok(tail.includes("## 卡片用法"), "卡片用法段必须位于原文之后");
	assert.ok(tail.indexOf("## 卡片用法") > tail.indexOf("## Motto identity"), "卡片用法段必须位于身份段之后");
});

test("空提示词边界:空串也可注入身份段", () => {
	const out = injectBrandIdentity("");
	assert.ok(out.includes("## Motto identity"));
	assert.equal(out.trimStart().startsWith("## Motto identity"), true);
});
