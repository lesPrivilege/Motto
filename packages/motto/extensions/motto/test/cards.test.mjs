// cards 展示层投影单元测试(display-only,不触碰正文/session)。
// 纯函数边界:projectDunhaoCards(source, context) —— 只改 TUI 渲染输入,
// canonical 正文/session/print/json 均不经过本函数(见 index.ts 接线说明)。
// 运行:cd extensions/motto && node --test test/cards.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { initTheme, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown, visibleWidth } from "@earendil-works/pi-tui";
import { projectDunhaoCards } from "../cards.ts";

/** 默认 assistant 完成态上下文。 */
const ctx = (overrides = {}) => ({ messageType: "assistant", isStreaming: false, availableWidth: 80, ...overrides });

function stripAnsi(line) {
	return line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
}

// ---------------------------------------------------------------- 1-3 基础投影
test("单卡片:标题+内容 → 单列表格(前置卡片帧标记),内容每行一个 body 行", () => {
	const src = "、、、\n验收结论\n基线逐字节、tui 909/909 全绿\n第二行内容\n、、、";
	assert.equal(
		projectDunhaoCards(src, ctx()),
		"<!--motto-card-->\n| 验收结论 |\n|---|\n| 基线逐字节、tui 909/909 全绿 |\n| 第二行内容 |",
	);
});

test("卡片嵌于前后文中,周边逐字不动", () => {
	const src = "前文\n\n、、、\n标题\n内容\n、、、\n\n后文";
	const out = projectDunhaoCards(src, ctx());
	assert.ok(out.startsWith("前文\n\n"));
	assert.ok(out.endsWith("\n\n后文"));
	assert.ok(out.includes("| 标题 |"));
});

test("多卡片依次投影", () => {
	const src = "、、、\n卡一\n甲\n、、、\n\n、、、\n卡二\n乙\n丙\n、、、";
	const out = projectDunhaoCards(src, ctx());
	assert.equal(
		out,
		"<!--motto-card-->\n| 卡一 |\n|---|\n| 甲 |\n\n<!--motto-card-->\n| 卡二 |\n|---|\n| 乙 |\n| 丙 |",
	);
});

test("仅标题卡片(无内容) → 仅标题头表格(带标记)", () => {
	const src = "、、、\n只有标题\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), "<!--motto-card-->\n| 只有标题 |\n|---|");
});

test("卡片帧标记:每个卡片表格前有独立一行 `<!--motto-card-->`,紧跟表格", () => {
	const src = "、、、\n卡一\n甲\n乙\n、、、\n\n、、、\n卡二\n丙\n、、、";
	const out = projectDunhaoCards(src, ctx());
	assert.equal(out.match(/<!--motto-card-->/g)?.length, 2, "每个卡片一个标记");
	assert.ok(out.startsWith("<!--motto-card-->\n"), "标记独立一行、位于表格之前");
	// 标记与表格相邻(下一行即表格头行),表格头行后接分隔线行
	assert.ok(out.includes("<!--motto-card-->\n| 卡一 |\n|---|"), "标记紧跟卡一表格");
	assert.ok(out.includes("<!--motto-card-->\n| 卡二 |\n|---|"), "标记紧跟卡二表格");
});

test("内容保留行内 Markdown(加粗/代码),内部空行保留为空行", () => {
	const src = "、、、\n标题\n第一段 **加粗**\n\n`code` 第二段\n、、、";
	assert.equal(
		projectDunhaoCards(src, ctx()),
		"<!--motto-card-->\n| 标题 |\n|---|\n| 第一段 **加粗** |\n|  |\n| `code` 第二段 |",
	);
});

test("标题取首个非空行(前导空行跳过)", () => {
	const src = "、、、\n\n\n标题\n内容\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), "<!--motto-card-->\n| 标题 |\n|---|\n| 内容 |");
});

// ---------------------------------------------------------------- 4-7 fail-open
test("未闭合卡片(有开无闭) → 原样", () => {
	const src = "、、、\n标题\n内容";
	assert.equal(projectDunhaoCards(src, ctx()), src);
});

test("空卡片(开栏即闭) → 原样", () => {
	const src = "、、、\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), src);
});

test("缺标题(开栏后全是空行即闭) → 原样", () => {
	const src = "、、、\n\n\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), src);
});

test("顿号后无空白直接接文本(如 `、、、标题`)不是围栏 → 原样", () => {
	const src = "、、、标题\n内容\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), src);
});

// ---------------------------------------------------------------- 8-9 围栏纪律
test("fenced 代码块内 `、、、` 一律跳过", () => {
	const src = "```\n、、、\n不是卡片\n、、、\n```\n\n、、、\n真卡片\n内容\n、、、";
	const out = projectDunhaoCards(src, ctx());
	// 代码块内逐字不动
	assert.ok(out.includes("```\n、、、\n不是卡片\n、、、\n```"));
	// 代码块外的卡片照常投影
	assert.ok(out.includes("| 真卡片 |"));
});

test("~~~ 波浪号代码块内 `、、、` 也跳过", () => {
	const src = "~~~\n、、、\n内容\n、、、\n~~~";
	assert.equal(projectDunhaoCards(src, ctx()), src);
});

test("卡片体内嵌代码块含 `、、、` → 不提前闭卡,闭卡在块后,块逐行保真", () => {
	const src = "、、、\n标题\n```\n、、、\n```\n、、、";
	const out = projectDunhaoCards(src, ctx());
	assert.equal(out, "<!--motto-card-->\n| 标题 |\n|---|\n| ``` |\n| 、、、 |\n| ``` |");
});

test("`|` 竖线在标题/内容中转义为 `\\|`", () => {
	const src = "、、、\n标题 | 副题\n内容 | 竖线\n、、、";
	assert.equal(
		projectDunhaoCards(src, ctx()),
		"<!--motto-card-->\n| 标题 \\| 副题 |\n|---|\n| 内容 \\| 竖线 |",
	);
});

// ---------------------------------------------------------------- 10-12 幂等/CRLF/守卫
test("幂等:输出不再含 `、、、`,重跑结果不变", () => {
	const src = "、、、\n标题\n内容\n、、、";
	const once = projectDunhaoCards(src, ctx());
	const twice = projectDunhaoCards(once, ctx());
	assert.equal(once, twice);
	assert.ok(!twice.includes("、、、"));
});

test("CRLF 行尾保留不破坏", () => {
	const src = "前文\r\n\r\n、、、\r\n标题\r\n内容\r\n、、、\r\n\r\n后文";
	const out = projectDunhaoCards(src, ctx());
	assert.equal(out, "前文\r\n\r\n<!--motto-card-->\r\n| 标题 |\r\n|---|\r\n| 内容 |\r\n\r\n后文");
});

test("守卫:user / thinking / 流式 / 非字符串 一律原样", () => {
	const src = "、、、\n标题\n内容\n、、、";
	for (const c of [
		{ messageType: "user", isStreaming: false },
		{ messageType: "assistant", isStreaming: true },
		{ messageType: "thinking", isStreaming: false },
	]) {
		assert.equal(projectDunhaoCards(src, ctx(c)), src, JSON.stringify(c));
	}
	assert.equal(projectDunhaoCards(null, ctx()), null);
});

test("组合契约:headings 投影后卡片照常投影(同消息双投影不互扰)", async () => {
	// index.ts 以单一组合 transformer 注册(pi 每扩展只存一个,后注册覆盖先注册)。
	// 此处验证顺序组合(headings → cards)对同一消息两条投影都生效。
	const { projectDeepHeadings } = await import("../headings.ts");
	const src = "### 小节标题\n\n、、、\n卡片标题\n卡片内容\n、、、";
	const once = projectDunhaoCards(projectDeepHeadings(src, ctx()), ctx());
	assert.ok(once.includes("## › 小节标题"), "headings 投影生效");
	assert.ok(once.includes("<!--motto-card-->\n| 卡片标题 |"), "cards 投影生效且带卡片帧标记");
	assert.ok(!once.includes("、、、"), "无残留围栏");
});

// ---------------------------------------------------------------- 13 带标注围栏(方案 A → 小标签)
test("带标注 `、、、 bash`:标注=表格头行(卡片帧标记带 :tag),内容每行一个 body 行且保留行首缩进", () => {
	const src = "、、、 bash\ncd ~/Projects/Motto\n  git status\n  git diff\n、、、";
	assert.equal(
		projectDunhaoCards(src, ctx()),
		"<!--motto-card:tag-->\n| bash |\n|---|\n| cd ~/Projects/Motto |\n| `  `git status |\n| `  `git diff |",
	);
});

test("带标注 `、、、 txt` 同理;标注含多词(`、、、 验收结论`)整段为头行", () => {
	assert.equal(
		projectDunhaoCards("、、、 txt\n第一行\n第二行\n、、、", ctx()),
		"<!--motto-card:tag-->\n| txt |\n|---|\n| 第一行 |\n| 第二行 |",
	);
	assert.equal(
		projectDunhaoCards("、、、 验收结论\n基线逐字节\n、、、", ctx()),
		"<!--motto-card:tag-->\n| 验收结论 |\n|---|\n| 基线逐字节 |",
	);
});

test("带标注开栏:内容区首尾空行去除,内部空行保留为空表格行", () => {
	const src = "、、、 bash\n\ncmd1\n\ncmd2\n\n、、、";
	assert.equal(
		projectDunhaoCards(src, ctx()),
		"<!--motto-card:tag-->\n| bash |\n|---|\n| cmd1 |\n|  |\n| cmd2 |",
	);
});

test("带标注 + 无内容 → 仅头行(标注为头行,卡片帧标记带 :tag)", () => {
	assert.equal(projectDunhaoCards("、、、 bash\n、、、", ctx()), "<!--motto-card:tag-->\n| bash |\n|---|");
});

test("闭栏必须裸 `、、、`:卡内带标注顿号行是内容,不闭卡;无裸闭栏则未闭合 fail-open", () => {
	// 卡内 `、、、 note` 是内容行,裸 `、、、` 才闭卡
	const src = "、、、 bash\nfoo\n、、、 note\nbar\n、、、";
	assert.equal(
		projectDunhaoCards(src, ctx()),
		"<!--motto-card:tag-->\n| bash |\n|---|\n| foo |\n| 、、、 note |\n| bar |",
	);
	// 只有带标注闭栏,无裸闭栏 → 未闭合,原样
	const unclosed = "、、、 bash\nfoo\n、、、 note";
	assert.equal(projectDunhaoCards(unclosed, ctx()), unclosed);
});

test("裸开栏维持现状:首个非空行=标题,内容区带标注顿号行不闭卡", () => {
	const src = "、、、\n标题\n、、、 note\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), "<!--motto-card-->\n| 标题 |\n|---|\n| 、、、 note |");
});

test("标注含 `|` 转义为 `\\|`", () => {
	const src = "、、、 bash | zsh\n内容\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), "<!--motto-card:tag-->\n| bash \\| zsh |\n|---|\n| 内容 |");
});

// ---------------------------------------------------------------- 14 端到端:TUI 渲染成卡片
test("端到端:投影后经 TUI Markdown 组件渲染为 box-drawing 卡片", () => {
	initTheme("dark");
	const theme = getMarkdownTheme();
	const src = "前文\n\n、、、\n验收结论\n基线逐字节、tui 909/909 全绿\n、、、\n\n后文";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const lines = md.render(80).map(stripAnsi);

	// 卡片 = 完整边框盒:首行上边框、末行下边框
	assert.ok(lines.some((l) => l.startsWith("┌─") && l.endsWith("─┐")), "应有上边框");
	assert.ok(lines.some((l) => l.startsWith("└─") && l.endsWith("─┘")), "应有下边框");
	assert.ok(lines.some((l) => l.includes("│ 验收结论")), "标题头在卡片内");
	assert.ok(lines.some((l) => l.includes("│ 基线逐字节、tui 909/909 全绿")), "内容在卡片内");
	// 前文/后文仍在
	assert.ok(lines.some((l) => l === "前文"));
	assert.ok(lines.some((l) => l === "后文"));
});

test("端到端:带标注 `、、、 bash` 渲染为小标签卡片——标注=盒顶上方 [bash],盒内无头行", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const src = "、、、 bash\ncd ~/Projects/Motto\n  git status\n  git diff\n、、、";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const lines = md.render(80).map(stripAnsi);

	// 小标签:标注渲染为盒顶上方 `[bash]`,不再作为盒内粗体头
	assert.ok(lines.some((l) => l === "[bash]"), `应有小标签 [bash],实际: ${JSON.stringify(lines)}`);
	assert.ok(!lines.some((l) => l.includes("│ bash")), "标注不再是盒内头行");
	assert.ok(lines.some((l) => l.startsWith("┌─") && l.endsWith("─┐")), "应有上边框");
	assert.ok(lines.some((l) => l.startsWith("└─") && l.endsWith("─┘")), "应有下边框");
	assert.ok(lines.some((l) => l.includes("│ cd ~/Projects/Motto")), "内容行在卡片内");
	assert.ok(lines.some((l) => l.includes("│   git status")), "行首缩进可见");
	assert.ok(lines.some((l) => l.includes("│   git diff")), "行首缩进可见");
	// 小标签在盒外:位于上边框之前
	const tagIdx = lines.findIndex((l) => l === "[bash]");
	const topIdx = lines.findIndex((l) => l.startsWith("┌─"));
	assert.ok(tagIdx !== -1 && topIdx !== -1 && tagIdx < topIdx, "小标签位于上边框之前");
});

test("端到端:裸卡(无标注)标题仍为盒内粗体头——小标签仅限带标注卡", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const src = "、、、\n验收结论\n基线逐字节\n、、、";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const lines = md.render(80).map(stripAnsi);

	assert.ok(lines.some((l) => l.includes("│ 验收结论")), "裸卡标题仍在盒内粗体头");
	assert.ok(!lines.some((l) => l.startsWith("[") && l.endsWith("]")), "裸卡无盒外小标签");
	const separators = lines.filter((l) => l.includes("├─"));
	assert.equal(separators.length, 1, `裸卡仅 1 条表头线,实际: ${separators.length}`);
});

test("端到端:窄宽(40)卡片折行且无超宽", () => {
	initTheme("dark");
	const theme = getMarkdownTheme();
	const src = "、、、\n验收结论\n基线逐字节、tui 909/909、drill 11/11、regression 11/11 全绿\n、、、";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	for (const line of md.render(40).map(stripAnsi)) {
		assert.ok([...line].length <= 40, `超宽: ${JSON.stringify(line)}`);
	}
});

test("端到端:带标注投影卡片(多内容行)小标签帧——无头行/无分隔线(0 条 ─),标记不泄漏为文本", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const src = "、、、 bash\ncd ~/Projects/Motto\n  git status\n  git diff\n  git log\n、、、";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const lines = md.render(80).map(stripAnsi);

	// 外框完整:上框 / 下框
	assert.ok(lines.some((l) => l.startsWith("┌─") && l.endsWith("─┐")), "应有上边框");
	assert.ok(lines.some((l) => l.startsWith("└─") && l.endsWith("─┘")), "应有下边框");
	// 小标签帧:无头行 → 无表头分隔线,亦无行间分隔线(0 条 ─)
	const separators = lines.filter((l) => l.includes("├─"));
	assert.equal(separators.length, 0, `带标注卡应无任何分隔线,实际: ${separators.length}`);
	// 内容行均在卡片内(行首缩进可见),标注为盒上小标签,标记不泄漏为可见文本
	assert.ok(lines.some((l) => l === "[bash]"), "标注=盒上小标签");
	assert.ok(lines.some((l) => l.includes("│ cd ~/Projects/Motto")), "内容行 1");
	assert.ok(lines.some((l) => l.includes("│   git status")), "内容行 2");
	assert.ok(lines.some((l) => l.includes("│   git diff")), "内容行 3");
	assert.ok(!lines.some((l) => l.includes("motto-card")), "标记不渲染为可见文本");
});

test("端到端:自然 markdown 表格(无标记)逐行分隔线保留——边界不受卡片帧影响", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const src = "| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
	const md = new Markdown(src, 0, 0, theme);
	const lines = md.render(80).map(stripAnsi);

	assert.ok(lines.some((l) => l.startsWith("┌─") && l.endsWith("─┐")), "应有上边框");
	assert.ok(lines.some((l) => l.startsWith("└─") && l.endsWith("─┘")), "应有下边框");
	const separators = lines.filter((l) => l.includes("├─"));
	assert.ok(separators.length >= 2, `自然表格逐行分隔线保留(表头线+行间线),实际: ${separators.length}`);
});

// ---------------------------------------------------------------- 15 超长标注截断(I9-1 / tui-4-s2)
test("端到端:超长标注(60 字)× 窄宽 40——小标签按显示宽度截断,零超宽且截断符 …", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const longLabel = "超长标注".repeat(15); // 60 字 → 显示宽 120 列
	const src = `、、、 ${longLabel}\n内容行\n、、、`;
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const lines = md.render(40);

	// I9-1:逐行显示宽度 ≤ 终端宽(CJK 双列计)
	for (const line of lines) {
		assert.ok(visibleWidth(line) <= 40, `超宽 ${visibleWidth(line)}: ${JSON.stringify(line)}`);
	}

	// 截断正确:小标签以 [ 开头、…] 结尾,显示宽度 ≤ 终端宽,且确实发生截断
	const tag = lines.map(stripAnsi).find((l) => l.startsWith("[") && l.endsWith("]"));
	assert.ok(tag, `应有小标签行,实际: ${JSON.stringify(lines.map(stripAnsi))}`);
	assert.ok(visibleWidth(tag) <= 40, `小标签显示宽度 ${visibleWidth(tag)} ≤ 40`);
	assert.ok(tag.endsWith("…]"), `小标签应以 …] 结尾(截断符 …),实际: ${JSON.stringify(tag)}`);
	assert.ok(tag.length < longLabel.length, `超长标注被截断,不整段透传: ${JSON.stringify(tag)}`);

	// 对照:同标注在宽终端(200)不截断,整段保留
	const mdWide = new Markdown(projected, 0, 0, theme);
	const wideTag = mdWide.render(200).map(stripAnsi).find((l) => l.startsWith("[") && l.endsWith("]"));
	assert.equal(wideTag, `[${longLabel}]`, "宽终端(200)下小标签整段保留");
});
