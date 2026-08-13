// cards 展示层投影单元测试(display-only,不触碰正文/session)。
// 纯函数边界:projectDunhaoCards(source, context) —— 只改 TUI 渲染输入,
// canonical 正文/session/print/json 均不经过本函数(见 index.ts 接线说明)。
// 运行:cd extensions/motto && node --test test/cards.test.mjs
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { initTheme, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown, resetCapabilitiesCache, setCapabilities, visibleWidth } from "@earendil-works/pi-tui";
import { projectDunhaoCards } from "../cards.ts";

// R3.1 测试确定性:显式固定终端能力,不依赖调用者 TERM/COLORTERM/NO_COLOR。
before(() => {
	setCapabilities({ images: null, trueColor: true, hyperlinks: false });
});
after(() => {
	resetCapabilitiesCache();
});

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

// ---------------------------------------------------------------- 16 紧凑 text 开栏(、、、text,MOTTO-TUI-4-S3)
test("紧凑 `、、、text` 与带标注 `、、、 text` 投影结果逐字相同(均发右上签 marker)", () => {
	const spaced = "、、、 text\nalpha\nbeta\n\ngamma\n、、、";
	const compact = "、、、text\nalpha\nbeta\n\ngamma\n、、、";
	const expected =
		"<!--motto-card:tag-top-right-->\n| text |\n|---|\n| alpha |\n| beta |\n|  |\n| gamma |";
	assert.equal(projectDunhaoCards(spaced, ctx()), expected, "带标注开栏行为逐字不变");
	assert.equal(projectDunhaoCards(compact, ctx()), expected, "紧凑开栏投影与带标注开栏一致");
	assert.equal(projectDunhaoCards(compact, ctx()), projectDunhaoCards(spaced, ctx()));
	// 只有标注为 text 才发右上签 marker;其他带标注与裸卡 marker 不变
	assert.equal(
		projectDunhaoCards("、、、 bash\n内容\n、、、", ctx()),
		"<!--motto-card:tag-->\n| bash |\n|---|\n| 内容 |",
	);
	assert.equal(
		projectDunhaoCards("、、、\n裸卡\n内容\n、、、", ctx()),
		"<!--motto-card-->\n| 裸卡 |\n|---|\n| 内容 |",
	);
});

test("端到端:紧凑 `、、、text` 渲染为右上嵌框 [text]——仅一条 top border,无独立 [text] 行", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const src = "前文\n\n、、、text\nalpha\nbeta\n\ngamma\n、、、\n\n后文";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const rawLines = md.render(80);
	const lines = rawLines.map(stripAnsi);

	// 只有一条 top border,`[text]` 嵌在其中,不再有独立 `[text]` 行
	const topBorders = lines.filter((l) => l.startsWith("┌") && l.endsWith("┐"));
	assert.equal(topBorders.length, 1, `应恰有一条 top border,实际: ${JSON.stringify(lines)}`);
	assert.ok(topBorders[0].includes("[text]"), "top border 内嵌 [text]");
	assert.ok(!lines.some((l) => l.trim() === "[text]"), "不应有独立的 [text] 行");
	// 标签前后至少各一格 `─`,左右角保留
	const top = topBorders[0];
	const tagIdx = top.indexOf("[text]");
	assert.ok(tagIdx >= 2, `[text] 前至少一格 ─: ${top}`);
	assert.ok(top.length - 1 - (tagIdx + 6) >= 1, `[text] 后至少一格 ─: ${top}`);
	// 标签为 accent(ANSI),框线为 cardBorder(borderMuted)——不是 accent
	const topRaw = rawLines.find((l) => l.startsWith("┌") || l.includes("┌"));
	assert.ok(topRaw.includes("\x1b[38;2;192;69;62m["), "标签使用 accent 槽");
	// 框线 `─`/角用 borderMuted 槽(#5c6166,92;97;102)而非 accent(192,69,62);标签为 accent
	const tagPos = topRaw.indexOf("[text]");
	assert.ok(topRaw.startsWith("\x1b[38;2;92;97;102m┌"), "top border 角/框线用 cardBorder(borderMuted)");
	assert.ok(topRaw.slice(0, tagPos).includes("\x1b[38;2;92;97;102m"), "框线 ─ 用 cardBorder(borderMuted)");
	assert.ok(topRaw.slice(0, tagPos).includes("\x1b[39m"), "框线段闭合重置");
	// top/body/bottom visibleWidth 完全相同且等于 availableWidth(R2 全宽)
	const widths = [...new Set(lines.filter((l) => l.startsWith("┌") || l.startsWith("│") || l.startsWith("└")).map((l) => [...l].length))];
	assert.equal(widths.length, 1, `卡片各行可见宽度应相同: ${widths}`);
	assert.equal(widths[0], 80, `卡片严格全宽 80(实际 ${widths[0]})`);
	// 无分隔线(轻框)
	assert.equal(lines.filter((l) => l.includes("├─")).length, 0, "轻框无分隔线");

	// 原始顿号围栏字符不残留
	assert.ok(!lines.some((l) => l.includes("、、、")), "围栏字符不残留");
	// 空行与正文顺序保留:alpha → 空行 → gamma
	const alphaIdx = lines.findIndex((l) => l.includes("alpha"));
	const gammaIdx = lines.findIndex((l) => l.includes("gamma"));
	assert.ok(alphaIdx !== -1 && gammaIdx !== -1 && alphaIdx < gammaIdx, "正文行存在且顺序正确");
	const between = lines.slice(alphaIdx + 1, gammaIdx);
	assert.ok(between.some((l) => /^[│ ]+$/.test(l)), "内部空行保留为空盒子行");
	// 前文/后文仍在
	assert.ok(lines.some((l) => l === "前文"));
	assert.ok(lines.some((l) => l === "后文"));
});

test("端到端:右上嵌框卡片在 40/60/80/120/200 列严格全宽,短内容拉伸至全宽", () => {
	initTheme("dark");
	const theme = getMarkdownTheme();
	const src = "、、、text\nalpha\nbeta\n\ngamma\n、、、";
	const projected = projectDunhaoCards(src, ctx());
	const md = new Markdown(projected, 0, 0, theme);
	for (const width of [40, 60, 80, 120, 200]) {
		const lines = md.render(width).map(stripAnsi);
		const cardLines = lines.filter((l) => /^[┌│└]/.test(l));
		assert.ok(cardLines.length > 0, `宽 ${width} 应有卡片`);
		for (const l of cardLines) {
			// R2 全宽:每条框体行 visibleWidth 严格等于 availableWidth(非 ≤)。
			assert.equal([...l].length, width, `宽 ${width} 严格全宽(实际 ${[...l].length}): ${JSON.stringify(l)}`);
		}
		// 短内容拉伸:top border 左右边框落在实际两端,[text] 右锚
		assert.ok(cardLines[0].startsWith("┌") && cardLines[0].endsWith("┐"), "左右角保留");
		assert.ok(cardLines[0].indexOf("[text]") > 2, "[text] 前有长框线(右锚)");
		assert.strictEqual(cardLines[0].length - 1 - (cardLines[0].indexOf("[text]") + 6), 1, "[text] 后恰一格 ─");
	}
});

test("端到端:短内容样本 `a` 在 200 列仍拉伸至 200,非 `┌─[text]─┐`", () => {
	initTheme("dark");
	const theme = getMarkdownTheme();
	const src = "、、、text\na\n、、、";
	const projected = projectDunhaoCards(src, ctx());
	const lines = new Markdown(projected, 0, 0, theme).render(200).map(stripAnsi);
	const top = lines.find((l) => l.startsWith("┌"));
	assert.ok(top, "应有 top border");
	assert.strictEqual([...top].length, 200, `短内容拉伸至 200(实际 ${[...top].length})`);
	assert.notStrictEqual(top, "┌─[text]─┐", "不得是自然宽小框");
	assert.ok(top.startsWith("┌") && top.endsWith("─┐"), "右锚保留");
});

test("端到端:text 卡框线(cardBorder)轻于自然表格,标签仍 accent,正文不染色", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const src = "前文\n\n、、、text\nalpha\n、、、\n\n| a | b |\n|---|---|\n| 1 | 2 |";
	const projected = projectDunhaoCards(src, ctx());
	const lines = new Markdown(projected, 0, 0, theme).render(80);
	const stripA = (l) => l.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
	// text 卡框线用 borderMuted 槽(#5c6166,92;97;102),标签用 accent 槽(192,69,62),正文不染色
	const cardTop = lines.find((l) => l.startsWith("\x1b[38;2;92;97;102m┌"));
	assert.ok(cardTop, "text 卡 top border 用 cardBorder(borderMuted)");
	assert.ok(cardTop.includes("\x1b[38;2;192;69;62m[text]"), "标签用 accent");
	const cardBody = lines.find((l) => stripA(l).includes("│ alpha"));
	assert.ok(cardBody, "body 行存在");
	const bodyInner = cardBody.split("alpha")[1].split("\x1b")[0];
	assert.ok(bodyInner.length > 0 && !bodyInner.startsWith("\x1b"), "正文不被 cardBorder 染色");
	// 自然表格完全不消费 cardBorder(无 muted 边框)
	const natTop = lines.find((l) => stripA(l).startsWith("┌") && !l.includes("92;97;102"));
	assert.ok(natTop, "自然表格边框不用 cardBorder");
});

test("R3: Motto cardBorder 映射 borderMuted(#5c6166)而非 dim(#a8adb2);标签 accent;正文不染色;自然表格不消费", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const frame = "┌───┐";
	// 机械证明:cardBorder 输出 === borderMuted RGB(92;97;102), !== dim RGB(168;173;178)
	assert.equal(theme.cardBorder(frame), `\x1b[38;2;92;97;102m${frame}\x1b[39m`, "cardBorder 用 borderMuted(#5c6166)");
	assert.notEqual(theme.cardBorder(frame), `\x1b[38;2;168;173;178m${frame}\x1b[39m`, "cardBorder 不等于 dim(#a8adb2)");
	// 标签仍 accent
	assert.ok(theme.cardLabel("[text]").includes("\x1b[38;2;192;69;62m["), "label 仍 accent");
	// 端到端:正文不染 cardBorder,自然表格不消费 borderMuted
	const src = "、、、text\n正文内容\n、、、\n\n| a | b |\n|---|---|\n| 1 | 2 |";
	const lines = new Markdown(projectDunhaoCards(src, ctx()), 0, 0, theme).render(60).map(stripAnsi);
	const bodyLine = lines.find((l) => l.includes("正文内容"));
	assert.ok(bodyLine && !bodyLine.includes("92;97;102"), "正文不被 cardBorder 染色");
	const natTop = lines.find((l) => l.startsWith("┌") && !l.includes("92;97;102"));
	assert.ok(natTop, "自然表格不消费 borderMuted");
});

test("行距:正文↔text 卡↔正文、卡开头/结尾、连续双卡均恰好一个空白行", () => {
	initTheme("motto");
	const theme = getMarkdownTheme();
	const stripA = (l) => l.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
	const render = (src) => new Markdown(projectDunhaoCards(src, ctx()), 0, 0, theme).render(60).map(stripA);
	const blankCount = (lines, from, to) => lines.slice(from, to).filter((l) => l === "").length;

	// 1. 正文 → 卡 → 正文(带源空行):前后各恰一空行
	let lines = render("正文段落\n\n、、、text\n内容\n、、、\n\n后续正文");
	let topIdx = lines.findIndex((l) => l.startsWith("┌"));
	assert.strictEqual(blankCount(lines, 0, topIdx), 1, "卡前恰一空行");
	assert.strictEqual(blankCount(lines, topIdx + 3, lines.length), 1, "卡后恰一空行");
	// 2. 无显式空行邻接:前后仍各恰一空行(后续正文不被吞进表格)
	lines = render("正文段落\n、、、text\n内容\n、、、\n后续正文");
	topIdx = lines.findIndex((l) => l.startsWith("┌"));
	assert.strictEqual(blankCount(lines, 0, topIdx), 1, "无空行邻接:卡前恰一空行");
	assert.strictEqual(blankCount(lines, topIdx + 3, lines.length), 1, "无空行邻接:卡后恰一空行");
	assert.ok(lines.some((l) => l.includes("后续正文")), "后续正文未被吞进表格");
	// 3. 多个源空行:折叠为恰一空行(无双倍)
	lines = render("正文段落\n\n\n、、、text\n内容\n、、、\n\n\n后续正文");
	topIdx = lines.findIndex((l) => l.startsWith("┌"));
	assert.strictEqual(blankCount(lines, 0, topIdx), 1, "多源空行:卡前仍恰一空行");
	assert.strictEqual(blankCount(lines, topIdx + 3, lines.length), 1, "多源空行:卡后仍恰一空行");
	// 4. 卡在消息开头/结尾:无 leading/trailing 空行
	lines = render("、、、text\n内容\n、、、\n\n后续正文");
	assert.notStrictEqual(lines[0], "", "卡在开头无 leading blank");
	lines = render("正文段落\n\n、、、text\n内容\n、、、");
	assert.notStrictEqual(lines.at(-1), "", "卡在结尾无 trailing blank");
	// 5. 连续双卡(0/1 个源空行):块间恰一空行
	for (const sep of ["\n", "\n\n"]) {
		lines = render(`、、、text\n甲\n、、、${sep}、、、text\n乙\n、、、`);
		topIdx = lines.findIndex((l) => l.startsWith("┌"));
		const secondTop = lines.indexOf("┌", topIdx + 1);
		assert.strictEqual(blankCount(lines, topIdx + 3, secondTop), 1, `连续双卡间恰一空行(sep=${JSON.stringify(sep)})`);
	}
});

test("无空格正文 `、、、标题` 及近似紧凑 token 仍非围栏 → 原样", () => {
	const src = "、、、标题\n内容\n、、、";
	assert.equal(projectDunhaoCards(src, ctx()), src);
	// 近似 token 不误识别:非 text 紧凑正文、text 前缀扩展、紧凑多词
	assert.equal(projectDunhaoCards("、、、bash\n内容\n、、、", ctx()), "、、、bash\n内容\n、、、");
	assert.equal(projectDunhaoCards("、、、textx\n内容\n、、、", ctx()), "、、、textx\n内容\n、、、");
	assert.equal(projectDunhaoCards("、、、text extra\n内容\n、、、", ctx()), "、、、text extra\n内容\n、、、");
});

test("未闭合紧凑 `、、、text`(有开无裸闭) → 原样 fail-open", () => {
	const src = "、、、text\nalpha\nbeta";
	assert.equal(projectDunhaoCards(src, ctx()), src);
	// 只有带标注闭栏(无裸闭栏)同样未闭合
	assert.equal(projectDunhaoCards("、、、text\nalpha\n、、、 note", ctx()), "、、、text\nalpha\n、、、 note");
});

test("fenced 代码块内 `、、、text` 原样,块外卡片照常", () => {
	const src = "```\n、、、text\nalpha\n```\n\n、、、\n真卡片\n内容\n、、、";
	const out = projectDunhaoCards(src, ctx());
	assert.ok(out.includes("```\n、、、text\nalpha\n```"), "代码块内逐字不动");
	assert.ok(out.includes("| 真卡片 |"), "块外卡片照常投影");
	// 卡片体内嵌代码块含 `、、、text` → 不提前闭卡,块逐行保真
	const nested = "、、、text\n```\n、、、text\n```\n、、、";
	assert.equal(
		projectDunhaoCards(nested, ctx()),
		"<!--motto-card:tag-top-right-->\n| text |\n|---|\n| ``` |\n| 、、、text |\n| ``` |",
	);
});

test("守卫:user / thinking / 流式 下紧凑 `、、、text` 一律原样", () => {
	const src = "、、、text\nalpha\n、、、";
	for (const c of [
		{ messageType: "user", isStreaming: false },
		{ messageType: "assistant", isStreaming: true },
		{ messageType: "thinking", isStreaming: false },
	]) {
		assert.equal(projectDunhaoCards(src, ctx(c)), src, JSON.stringify(c));
	}
});

test("紧凑 `、、、text`:CRLF 行尾保留、幂等、40 列零超宽", () => {
	// CRLF
	const crlf = "前文\r\n\r\n、、、text\r\nalpha\r\nbeta\r\n、、、\r\n\r\n后文";
	assert.equal(
		projectDunhaoCards(crlf, ctx()),
		"前文\r\n\r\n<!--motto-card:tag-top-right-->\r\n| text |\r\n|---|\r\n| alpha |\r\n| beta |\r\n\r\n后文",
	);
	// 幂等:输出不再含 `、、、`,重跑结果不变
	const once = projectDunhaoCards("、、、text\nalpha\nbeta\n、、、", ctx());
	const twice = projectDunhaoCards(once, ctx());
	assert.equal(once, twice);
	assert.ok(!twice.includes("、、、"));
	// 40 列零超宽
	initTheme("dark");
	const theme = getMarkdownTheme();
	const md = new Markdown(once, 0, 0, theme);
	for (const line of md.render(40).map(stripAnsi)) {
		assert.ok([...line].length <= 40, `超宽: ${JSON.stringify(line)}`);
	}
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
