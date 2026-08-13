// cards.ts —— 三顿号卡片（、、、）的展示层视觉投影（纯函数,display-only）。
// 把 `、、、` 围栏卡片投影为单列 Markdown 表格,使 TUI 原生渲染出 box-drawing 卡片:
//
//   、、、 bash
//   cd ~/Projects/Motto
//     git status
//     git diff
//   、、、
//   ↓ 投影
//   <!--motto-card:tag-->
//   | bash |
//   |---|
//   | cd ~/Projects/Motto |
//   | `  `git status |
//   | `  `git diff |
//   ↓ TUI 原生渲染(小标签:标注=盒顶上方 accent 小标签,盒内无头行,无行间分隔线)
//   [bash]                 ← 小标签（accent 色）
//   ┌───────────────────┐
//   │ cd ~/Projects/Motto  │
//   │   git status      │
//   │   git diff        │
//   └───────────────────┘
//
// 只改 TUI 渲染输入:原始 Markdown 正文、session、模型上下文、print/json 输出
// 均逐字不变(经 pi 公开 `registerMarkdownTransformer` 接入,见 index.ts 接线说明)。
//
// 解析纪律(与 headings.ts 同纪律):小逐行 scanner,不用跨全文宽泛正则;fenced 代码块
// (``` / ~~~,含 blockquote 前缀形式)内一律跳过,卡片体内嵌代码块时块内 `、、、` 不闭卡;
// 顿号围栏须独占一行(前导空格 ≤3);开栏可裸 `、、、` 或带标注 `、、、 标注`(须空白分隔),
// 或紧凑别名 `、、、text`(无空白,仅此一个 ASCII token,投影等同 `、、、 text`);闭栏必须裸 `、、、`;
// 带标注开栏:标注 = 表格头行(卡片帧标记带 :tag 后缀 → TUI 渲染为盒顶上方小标签,
// 盒内不再渲染头行/分隔线),首个非空内容行是正文(不再是标题);
// 裸开栏:首个非空行 = 标题(卡片帧标记不带 :tag → 标题仍为盒内粗体头),其后为内容;
// 内容逐行保真:每个非空行 = 一个表格行,行首缩进保留(marked 表格单元格会 trim 前导空白,
// 故把前导空白包进内联代码保真,渲染时列宽按最宽行自适应),内部空行保留为空表格行,
// 首尾空行去除;
// 行内 Markdown 解析维持现状(代码内容里的 `*`/`_`/反引号可能被轻度解析,已知可接受风险);
// 内容/标题/标注中的 `|` 转义为 `\|`;未闭合 / 空卡片 / 缺标题 fail-open 原样;CRLF 不破坏;
// 幂等(输出为表格,不再含 `、、、` 行);fail-open。
//
// 卡片帧标记:每个卡片表格**之前**输出独立一行 HTML 注释(行尾用开栏行尾)。TUI 核心
// (pi-tui markdown.ts)识别该标记:裸卡 `<!--motto-card-->` → 置「卡片帧模式」→ 表格去行间
// 分隔线(仅外框 + 粗体表头行 + 表头分隔线);带标注卡 `<!--motto-card:tag-->` → 另置「卡片
// 标签模式」→ 标注(表格头行)渲染为盒顶上方 accent 小标签,盒内无头行/分隔线;标注为 text 的
// 卡(`、、、text` / `、、、 text`)发 `<!--motto-card:tag-top-right-->` → 标注嵌进 top border
// 右上角(`┌─…─[text]─┐`),不占独立行。自然 markdown 表格无标记不受影响(逐行分隔线保留)。
// 标记为纯注释,对幂等(输出无 `、、、` 行,重跑不变)与守卫/fail-open/CRLF/行尾逻辑无影响。
// 标注入表格头行(而非入标记):标注可含任意字符(`--`/`>`/`:` 等)均安全,标记只承载裸/带标注
// 二态;TUI 从紧随表格的头行读标签文本。盒宽以内容为准(标签在盒外,不参与列宽)。
import type { MarkdownTransformContext } from "@earendil-works/pi-coding-agent";
import { joinLines, parseFence, splitLines, type Line } from "./headings.ts";

/** 顿号裸围栏行(开/闭栏共用判定):前导空格 ≤3,其后仅空白。 */
const DUNHAO_BARE_RE = /^ {0,3}、、、[ \t]*$/;

/** 顿号带标注开栏:前导空格 ≤3,`、、、` 后须至少一个空白再跟标注。 */
const DUNHAO_ANNOT_RE = /^ {0,3}、、、[ \t]+(.*)$/;

/** 顿号紧凑 text 开栏:`、、、` 后无空白直接接 `text`(模型常见 plain-text 紧凑别名,等同 `、、、 text`)。 */
const DUNHAO_COMPACT_TEXT_RE = /^ {0,3}、、、text[ \t]*$/;

/** 表格单元格安全化:转义 `|`,防破坏表格列。 */
function escapeCell(text: string): string {
	return text.includes("|") ? text.replace(/\|/g, "\\|") : text;
}

/**
 * 解析顿号围栏行:返回标注(trim 后;裸围栏为 "")。非围栏行返回 undefined——
 * 含 `、、、` 后无空白直接接文本的行(`、、、标题`)不是围栏;唯一例外是紧凑
 * text 别名 `、、、text`(标注恒为 text,投影等同 `、、、 text`)。
 */
function dunhaoAnnotation(content: string): string | undefined {
	const m = DUNHAO_ANNOT_RE.exec(content);
	if (m) return m[1].trim();
	// 紧凑 text 别名(`、、、text` 无空白):标注恒为 text,投影等同 `、、、 text`。
	if (DUNHAO_COMPACT_TEXT_RE.test(content)) return "text";
	return DUNHAO_BARE_RE.test(content) ? "" : undefined;
}

/**
 * 行首缩进保真:marked 表格单元格解析会把前导空白 trim 掉,把前导空白包进内联代码
 * (`` `  ` ``)以保真——渲染时列宽按最宽行自适应,行首缩进可见。
 */
function preserveIndent(text: string): string {
	const m = /^([ \t]+)/.exec(text);
	return m ? "`" + m[1] + "`" + text.slice(m[1].length) : text;
}

/**
 * 把 `、、、` 围栏卡片投影为单列 Markdown 表格的 display-only 投影。
 *
 * - 只作用于 assistant 完成态消息(interactive final);user / thinking / 流式中完全不变。
 * - fenced 代码块内(顶层或带 blockquote 前缀)逐字不动。
 * - 开栏可裸 `、、、` 或带标注 `、、、 标注`(须空白分隔),另接受紧凑 text 别名
 *   `、、、text`(标注恒为 text,投影等同 `、、、 text`);带标注时标注为表格头行
 *   (卡片帧标记带 `:tag` → TUI 渲染为盒顶上方 accent 小标签,盒内无头行/分隔线);
 *   裸开栏时首个非空行 = 标题(盒内粗体头),其后为内容。
 * - 闭栏必须裸 `、、、`;带标注的顿号行在卡内是内容,不闭卡。
 * - 内容逐行保真:每个非空行 = 一个表格行(行首缩进保留,`|` 转义),内部空行保留为
 *   空表格行,首尾空行去除;内容为空则仅标题头。
 * - 未闭合(有开无闭)/ 空卡片(裸开栏即闭)/ 缺标题 → fail-open 原样。
 * - 幂等:输出为表格(无 `、、、` 行),重跑结果不变。
 * - fail-open:非字符串输入原样返回。
 */
export function projectDunhaoCards(markdown: string, context: MarkdownTransformContext): string {
	if (typeof markdown !== "string") return markdown;
	if (context.messageType !== "assistant" || context.isStreaming) return markdown;

	const lines = splitLines(markdown);
	const out: Line[] = [];
	let changed = false;
	let fence: { quote: string; marker: string; run: number } | undefined;

	let i = 0;
	while (i < lines.length) {
		const line = lines[i];

		// fenced 代码块内:正文一律原样;closing 判定后退出。
		if (fence !== undefined) {
			out.push(line);
			const f = parseFence(line.content);
			if (
				f !== undefined &&
				f.quote === fence.quote &&
				f.marker === fence.marker &&
				f.run >= fence.run &&
				f.rest.trim() === ""
			) {
				fence = undefined;
			}
			i++;
			continue;
		}

		const f = parseFence(line.content);
		if (f !== undefined) {
			fence = { quote: f.quote, marker: f.marker, run: f.run };
			out.push(line);
			i++;
			continue;
		}

		// 顶层顿号围栏(裸或带标注)开栏:向后找裸闭栏。
		const annot = dunhaoAnnotation(line.content);
		if (annot !== undefined) {
			let j = i + 1;
			// 卡片体内嵌 fenced 代码块时,块内 `、、、` 不是闭栏,跳过整个块再继续找。
			let innerFence: { quote: string; marker: string; run: number } | undefined;
			while (j < lines.length) {
				const cand = lines[j];
				if (innerFence !== undefined) {
					const cf = parseFence(cand.content);
					if (
						cf !== undefined &&
						cf.quote === innerFence.quote &&
						cf.marker === innerFence.marker &&
						cf.run >= innerFence.run &&
						cf.rest.trim() === ""
					) {
						innerFence = undefined;
					}
					j++;
					continue;
				}
				const cf = parseFence(cand.content);
				if (cf !== undefined) {
					innerFence = { quote: cf.quote, marker: cf.marker, run: cf.run };
					j++;
					continue;
				}
				if (DUNHAO_BARE_RE.test(cand.content)) break;
				j++;
			}
			if (j >= lines.length) {
				// 未闭合 → fail-open 原样。
				out.push(line);
				i++;
				continue;
			}
			const body = lines.slice(i + 1, j);
			let title: string;
			let contentStart: number;
			if (annot !== "") {
				// 带标注开栏:标注即标题,首个非空内容行是正文(不再是标题)。
				title = escapeCell(annot);
				contentStart = 0;
			} else {
				// 裸开栏:首个非空行 = 标题(维持现状)。
				const titleIdx = body.findIndex((l) => l.content.trim() !== "");
				if (titleIdx === -1) {
					// 空卡片(开栏即闭,无标题)→ fail-open 原样。
					out.push(line);
					i++;
					continue;
				}
				title = escapeCell(body[titleIdx].content.trim());
				contentStart = titleIdx + 1;
			}
			// 内容区逐行保真:去首尾空行,内部空行保留为空表格行;行首缩进保留。
			const contentLines = body.slice(contentStart).map((l) => l.content);
			let a = 0;
			let b = contentLines.length - 1;
			while (a <= b && contentLines[a].trim() === "") a++;
			while (b >= a && contentLines[b].trim() === "") b--;
			const rows: Line[] = [];
			for (let k = a; k <= b; k++) {
				const raw = contentLines[k];
				const content = raw.trim() === "" ? "|  |" : `| ${escapeCell(preserveIndent(raw))} |`;
				// 中间内容行用其原始行尾;末行用闭栏行尾(与既有单行行为一致)。
				rows.push({ content, ending: k === b ? lines[j].ending : body[contentStart + k].ending });
			}

			// 卡片帧标记:独立一行,位于表格之前,行尾用开栏行尾(与表格行一致)。
			// 标注为 `text`(`、、、text` 紧凑别名或 `、、、 text` 带标注)发
			// `<!--motto-card:tag-top-right-->`(TUI 把标注嵌进 top border 右上角);
			// 其他带标注(annot !== "")发 `<!--motto-card:tag-->`(盒上小标签);
			// 裸卡发 `<!--motto-card-->`(标题仍为盒内粗体头)。
			const marker =
				annot === "text"
					? "<!--motto-card:tag-top-right-->"
					: annot !== ""
						? "<!--motto-card:tag-->"
						: "<!--motto-card-->";
			out.push({ content: marker, ending: lines[i].ending });
			out.push({ content: `| ${title} |`, ending: lines[i].ending });
			out.push({ content: `|---|`, ending: lines[i].ending });
			if (rows.length > 0) {
				for (const r of rows) out.push(r);
			} else {
				out[out.length - 1].ending = lines[j].ending;
			}
			// R2 行距:闭栏后若紧邻非空行(源无空行),补一个空行终止表格,防后续正文被
			// 吞进表格;源已有空行时不补(避免双倍),marked 会把连续空行折叠为单空行。
			if (j + 1 < lines.length && lines[j + 1].content.trim() !== "") {
				out.push({ content: "", ending: lines[j].ending });
			}
			changed = true;
			i = j + 1;
			continue;
		}

		out.push(line);
		i++;
	}

	return changed ? joinLines(out) : markdown;
}
