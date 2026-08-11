// headings 展示层投影单元测试(display-only,不触碰正文/session)。
// 纯函数边界:projectDeepHeadings(source, context) —— 只改 TUI 渲染输入,
// canonical 正文/session/print/json 均不经过本函数(见 index.ts 接线说明)。
// 运行:cd extensions/motto && node --test test/headings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { initTheme, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
import { projectDeepHeadings } from "../headings.ts";

/** 默认 assistant 完成态上下文。 */
const ctx = (overrides = {}) => ({ messageType: "assistant", isStreaming: false, availableWidth: 80, ...overrides });

// ---------------------------------------------------------------- 1-3 投影 H3–H6 → `## › 标题`
test("H3/H4/H5/H6 → `## › 标题`,H1/H2 原样", () => {
	const src = "# H1\n## H2\n### 三级标题\n#### 四级标题\n##### 五级标题\n###### 六级标题";
	assert.equal(
		projectDeepHeadings(src, ctx()),
		"# H1\n## H2\n## › 三级标题\n## › 四级标题\n## › 五级标题\n## › 六级标题",
	);
});

test("单条 H3 投影,其余正文逐字不动", () => {
	const src = "前文\n\n### 子标题\n\n正文 **bold** 与 `code`\n\n- 列表项\n- 另一项";
	const out = projectDeepHeadings(src, ctx());
	assert.ok(out.includes("## › 子标题"));
	assert.ok(out.startsWith("前文\n\n"));
	assert.ok(out.endsWith("- 列表项\n- 另一项"));
});

test("多级混合文档:仅 ≥3 级行投影,其余逐字", () => {
	const src = "# 一\n## 二\n### 三\n#### 四\n## 又二\n###### 六\n正文";
	assert.equal(
		projectDeepHeadings(src, ctx()),
		"# 一\n## 二\n## › 三\n## › 四\n## 又二\n## › 六\n正文",
	);
});

// ---------------------------------------------------------------- 4-6 非 heading 不动
test("无空白分隔的 # 串不是 heading(###foo 等不动)", () => {
	for (const src of ["###foo", "####foo", "######foo", "####### Foo"]) {
		assert.equal(projectDeepHeadings(src, ctx()), src, `src=${JSON.stringify(src)}`);
	}
	// 纯 # 串(无文本)是合法空 heading:3–6 个被投影,1–2 个与 7+ 个原样。
	for (const src of ["#", "##", "###", "####", "######", "#######"]) {
		const expect = src.length >= 3 && src.length <= 6 ? "## ›" : src;
		assert.equal(projectDeepHeadings(src, ctx()), expect, `src=${JSON.stringify(src)}`);
	}
});

test("缩进 4+ 空格为缩进代码块,不动", () => {
	for (const src of ["    ### foo", "    #### foo", "    ###### foo"]) {
		assert.equal(projectDeepHeadings(src, ctx()), src);
	}
});

test("前导 ≤3 空格的 H3 投影,空格保留", () => {
	assert.equal(projectDeepHeadings("  ### foo", ctx()), "  ## › foo");
	assert.equal(projectDeepHeadings("   ##### foo", ctx()), "   ## › foo");
});

// ---------------------------------------------------------------- 7-10 fenced 代码块内不动
test("反引号 fenced 块内 ###–###### 行不动", () => {
	const src = "```python\n# 注释\n#### 不是标题\n### 也不是\n###### 更不是\n```";
	assert.equal(projectDeepHeadings(src, ctx()), src);
});

test("波浪号 fenced 块内不动;4 反引号围栏正确", () => {
	assert.equal(projectDeepHeadings("~~~\n### x\n#### y\n~~~", ctx()), "~~~\n### x\n#### y\n~~~");
	assert.equal(projectDeepHeadings("````\n### x\n#### y\n````", ctx()), "````\n### x\n#### y\n````");
});

test("fence 后的正文标题仍投影", () => {
	const src = "```\n### 代码内\n```\n\n### 代码外";
	assert.equal(projectDeepHeadings(src, ctx()), "```\n### 代码内\n```\n\n## › 代码外");
});

test("带 info string 与缩进的 fenced 块内不动", () => {
	const src = "  ```bash echo\n  ### x\n  #### y\n  ```";
	assert.equal(projectDeepHeadings(src, ctx()), src);
});

// ---------------------------------------------------------------- 11-12 blockquote 前缀
test("blockquote 内 H3 投影,可嵌套", () => {
	assert.equal(projectDeepHeadings("> ### 引用子标题", ctx()), "> ## › 引用子标题");
	assert.equal(projectDeepHeadings("> > ##### 嵌套引用", ctx()), "> > ## › 嵌套引用");
	assert.equal(projectDeepHeadings("> ######", ctx()), "> ## ›");
});

test("blockquote fenced 块内不动,list 嵌套标题不动", () => {
	const src = "> ```\n> ### 引用内代码\n> ```\n\n- #### 列表内标题";
	assert.equal(projectDeepHeadings(src, ctx()), src);
});

// ---------------------------------------------------------------- 13-15 健壮性
test("closing sequence 保持可解析(尾部 # 保留)", () => {
	assert.equal(projectDeepHeadings("### 标题 ###", ctx()), "## › 标题 ###");
});

test("heading 内 inline code/link/emphasis 保留", () => {
	assert.equal(projectDeepHeadings("### 含 `code` 与 **bold** 与 [link](https://x)", ctx()),
		"## › 含 `code` 与 **bold** 与 [link](https://x)");
});

test("CRLF 不破坏正文", () => {
	const src = "### H3\r\n正文\r\n##### H5\r\n";
	assert.equal(projectDeepHeadings(src, ctx()), "## › H3\r\n正文\r\n## › H5\r\n");
});

test("幂等:重跑结果不变", () => {
	const src = "### H3\n```\n#### 代码\n```\n> ##### H5";
	const once = projectDeepHeadings(src, ctx());
	assert.equal(projectDeepHeadings(once, ctx()), once);
});

test("fail-open:非字符串原样返回;空串与无标题文档原样", () => {
	assert.equal(projectDeepHeadings(null, ctx()), null);
	assert.equal(projectDeepHeadings(undefined, ctx()), undefined);
	assert.equal(projectDeepHeadings("", ctx()), "");
	const plain = "无标题的普通文档\n第二行";
	assert.equal(projectDeepHeadings(plain, ctx()), plain);
});

// ---------------------------------------------------------------- 16-18 消息类型与流式
test("user 消息完全不变", () => {
	const src = "### H3\n```\n#### 代码\n```";
	assert.equal(projectDeepHeadings(src, { ...ctx(), messageType: "user" }), src);
});

test("thinking 消息完全不变", () => {
	const src = "### H3\n```\n#### 代码\n```";
	assert.equal(projectDeepHeadings(src, { ...ctx(), messageType: "assistant-thinking" }), src);
});

test("流式期(isStreaming)完全不变", () => {
	const src = "### H3\n#### H4";
	assert.equal(projectDeepHeadings(src, { ...ctx(), isStreaming: true }), src);
});

// ---------------------------------------------------------------- 19 真实 pi-tui renderer 输出级断言
test("真实 pi-tui renderer:H3 最终渲染为 `› 标题`,不含 `### 三级标题`", () => {
	initTheme("dark");
	const theme = getMarkdownTheme();
	const strip = (lines) => lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");

	// 投影后的输入经真实 renderer 渲染。
	const projected = projectDeepHeadings("### 三级标题", ctx());
	const md = new Markdown(projected, 0, 0, theme);
	const rendered = strip(md.render(80));
	assert.ok(rendered.includes("› 三级标题"), `应包含 "› 三级标题",实际:${JSON.stringify(rendered)}`);
	assert.ok(!rendered.includes("### 三级标题"), `不得包含 "### 三级标题",实际:${JSON.stringify(rendered)}`);

	// 对照:原生 H3(未投影)确实带 `###` 前缀——证明断言有区分度。
	const native = strip(new Markdown("### 三级标题", 0, 0, theme).render(80));
	assert.ok(native.includes("### 三级标题"), `原生 H3 应保留前缀,实际:${JSON.stringify(native)}`);
});

test("真实 pi-tui renderer:H1/H2 原生渲染无井号前缀", () => {
	initTheme("dark");
	const theme = getMarkdownTheme();
	const strip = (lines) => lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
	const h1 = strip(new Markdown("# 一级标题", 0, 0, theme).render(80));
	const h2 = strip(new Markdown("## 二级标题", 0, 0, theme).render(80));
	assert.ok(h1.includes("一级标题") && !h1.trimStart().startsWith("#"));
	assert.ok(h2.includes("二级标题") && !h2.trimStart().startsWith("#"));
});
