// cards.ts —— 三顿号卡片（、、、）的展示层视觉投影（纯函数,display-only）。
// 把 `、、、` 围栏卡片投影为单列 Markdown 表格,使 TUI 原生渲染出 box-drawing 卡片:
//
//   、、、
//   验收结论
//   基线逐字节、tui 909/909 全绿
//   、、、
//   ↓ 投影
//   | 验收结论 |
//   |---|
//   | 基线逐字节、tui 909/909 全绿 |
//   ↓ TUI 原生渲染
//   ┌──────────────┐
//   │ 验收结论      │   ← 粗体标题头
//   ├──────────────┤
//   │ 基线逐字节…  │
//   └──────────────┘
//
// 只改 TUI 渲染输入:原始 Markdown 正文、session、模型上下文、print/json 输出
// 均逐字不变(经 pi 公开 `registerMarkdownTransformer` 接入,见 index.ts 接线说明)。
//
// 解析纪律(与 headings.ts 同纪律):小逐行 scanner,不用跨全文宽泛正则;fenced 代码块
// (``` / ~~~,含 blockquote 前缀形式)内一律跳过,卡片体内嵌代码块时块内 `、、、` 不闭卡;
// `、、、` 围栏须独占一行(前导空格 ≤3);
// 开栏后首个非空行为标题,其后至闭栏的非空行为内容(单空格连接,保留行内 Markdown);
// 内容/标题中的 `|` 转义为 `\|`;未闭合 / 空卡片 / 缺标题 fail-open 原样;CRLF 不破坏;
// 幂等(输出为表格,不再含 `、、、` 行);fail-open。
import type { MarkdownTransformContext } from "@earendil-works/pi-coding-agent";
import { joinLines, parseFence, splitLines, type Line } from "./headings.ts";

/** `、、、` 围栏行:前导空格 ≤3,其后仅空白;带其他文本的顿号行不是围栏。 */
const DUNHAO_FENCE_RE = /^ {0,3}、、、[ \t]*$/;

/** 表格单元格安全化:转义 `|`,防破坏表格列。 */
function escapeCell(text: string): string {
	return text.includes("|") ? text.replace(/\|/g, "\\|") : text;
}

/**
 * 把 `、、、` 围栏卡片投影为单列 Markdown 表格的 display-only 投影。
 *
 * - 只作用于 assistant 完成态消息(interactive final);user / thinking / 流式中完全不变。
 * - fenced 代码块内(顶层或带 blockquote 前缀)逐字不动。
 * - 开栏 `、、、` 后首个非空行 = 标题(表格头行);其后至闭栏 `、、、` 的非空行 = 内容
 *   (单空格连接,含行内 Markdown);内容为空则仅标题头(无 body 行)。
 * - 未闭合(有开无闭)/ 空卡片(开栏即闭)/ 缺标题 → fail-open 原样。
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

		// 顶层 `、、、` 开栏:向后找闭栏。
		if (DUNHAO_FENCE_RE.test(line.content)) {
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
				if (DUNHAO_FENCE_RE.test(cand.content)) break;
				j++;
			}
			if (j >= lines.length) {
				// 未闭合 → fail-open 原样。
				out.push(line);
				i++;
				continue;
			}
			const body = lines.slice(i + 1, j);
			const titleIdx = body.findIndex((l) => l.content.trim() !== "");
			if (titleIdx === -1) {
				// 空卡片(开栏即闭,无标题)→ fail-open 原样。
				out.push(line);
				i++;
				continue;
			}
			const title = escapeCell(body[titleIdx].content.trim());
			const content = body
				.slice(titleIdx + 1)
				.filter((l) => l.content.trim() !== "")
				.map((l) => escapeCell(l.content.trim()))
				.join(" ");

			out.push({ content: `| ${title} |`, ending: lines[i].ending });
			out.push({ content: `|---|`, ending: lines[i].ending });
			if (content !== "") {
				out.push({ content: `| ${content} |`, ending: lines[j].ending });
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
