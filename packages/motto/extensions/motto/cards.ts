// cards.ts —— 三顿号卡片（、、、）的展示层视觉投影（纯函数,display-only）。
// 把 `、、、` 围栏卡片投影为单列 Markdown 表格,使 TUI 原生渲染出 box-drawing 卡片:
//
//   、、、 bash
//   cd ~/Projects/pi
//     git status
//     git diff
//   、、、
//   ↓ 投影
//   | bash |
//   |---|
//   | cd ~/Projects/pi |
//   | `  `git status |
//   | `  `git diff |
//   ↓ TUI 原生渲染
//   ┌───────────────────┐
//   │ bash              │   ← 粗体标题头（标注）
//   ├───────────────────┤
//   │ cd ~/Projects/pi  │
//   ├───────────────────┤
//   │   git status      │
//   ├───────────────────┤
//   │   git diff        │
//   └───────────────────┘
//
// 只改 TUI 渲染输入:原始 Markdown 正文、session、模型上下文、print/json 输出
// 均逐字不变(经 pi 公开 `registerMarkdownTransformer` 接入,见 index.ts 接线说明)。
//
// 解析纪律(与 headings.ts 同纪律):小逐行 scanner,不用跨全文宽泛正则;fenced 代码块
// (``` / ~~~,含 blockquote 前缀形式)内一律跳过,卡片体内嵌代码块时块内 `、、、` 不闭卡;
// 顿号围栏须独占一行(前导空格 ≤3);开栏可裸 `、、、` 或带标注 `、、、 标注`(须空白分隔),
// 闭栏必须裸 `、、、`;
// 带标注开栏:标注即标题(表格头行/粗体),首个非空内容行是正文(不再是标题);
// 裸开栏:首个非空行 = 标题,其后为内容;
// 内容逐行保真:每个非空行 = 一个表格行,行首缩进保留(marked 表格单元格会 trim 前导空白,
// 故把前导空白包进内联代码保真,渲染时列宽按最宽行自适应),内部空行保留为空表格行,
// 首尾空行去除;
// 行内 Markdown 解析维持现状(代码内容里的 `*`/`_`/反引号可能被轻度解析,已知可接受风险);
// 内容/标题/标注中的 `|` 转义为 `\|`;未闭合 / 空卡片 / 缺标题 fail-open 原样;CRLF 不破坏;
// 幂等(输出为表格,不再含 `、、、` 行);fail-open。
import type { MarkdownTransformContext } from "@earendil-works/pi-coding-agent";
import { joinLines, parseFence, splitLines, type Line } from "./headings.ts";

/** 顿号裸围栏行(开/闭栏共用判定):前导空格 ≤3,其后仅空白。 */
const DUNHAO_BARE_RE = /^ {0,3}、、、[ \t]*$/;

/** 顿号带标注开栏:前导空格 ≤3,`、、、` 后须至少一个空白再跟标注。 */
const DUNHAO_ANNOT_RE = /^ {0,3}、、、[ \t]+(.*)$/;

/** 表格单元格安全化:转义 `|`,防破坏表格列。 */
function escapeCell(text: string): string {
	return text.includes("|") ? text.replace(/\|/g, "\\|") : text;
}

/**
 * 解析顿号围栏行:返回标注(trim 后;裸围栏为 "")。非围栏行返回 undefined——
 * 含 `、、、` 后无空白直接接文本的行(`、、、标题`)不是围栏。
 */
function dunhaoAnnotation(content: string): string | undefined {
	const m = DUNHAO_ANNOT_RE.exec(content);
	if (m) return m[1].trim();
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
 * - 开栏可裸 `、、、` 或带标注 `、、、 标注`(须空白分隔);带标注时标注即标题(表格头行/
 *   粗体),首个非空内容行是正文;裸开栏时首个非空行 = 标题,其后为内容。
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

			out.push({ content: `| ${title} |`, ending: lines[i].ending });
			out.push({ content: `|---|`, ending: lines[i].ending });
			if (rows.length > 0) {
				for (const r of rows) out.push(r);
			} else {
				out[out.length - 1].ending = lines[j].ending;
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
