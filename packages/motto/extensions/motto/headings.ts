// headings.ts —— 多级 Markdown 标题的展示层视觉投影(纯函数,display-only)。
// 把 H3–H6(`###`~`######`)投影为 H2 文本 `## › 原标题`,使 TUI 呈现收敛为
// 常规 chatbot 的三层视觉:
//   H1(bold+underline,无前缀)/ H2(bold,无前缀)/ H3–H6(统一为 `› 标题`,bold,无井号)。
// 只改 TUI 渲染输入:原始 Markdown 正文、session、模型上下文、print/json 输出
// 均逐字不变(经 pi 公开 `registerMarkdownTransformer` 接入,见 index.ts 接线说明)。
//
// 解析纪律:小逐行 scanner,不用跨全文宽泛正则;fenced 代码块(``` / ~~~,含简单
// blockquote 前缀形式)内一律跳过;只认 CommonMark ATX heading(前导空格 ≤3)及其
// 简单 blockquote 前缀(`>` 可嵌套,非递归);list 内嵌套标题不做(须递归解析,超出
// 最小面,原样保留);CRLF 不破坏正文;幂等;fail-open。
import type { MarkdownTransformContext } from "@earendil-works/pi-coding-agent";

/** 一行的内容与行尾;行尾原样保留(\n 或 \r\n),最后一行可能无行尾。 */
export interface Line {
	content: string;
	ending: string;
}

/** 逐行切分,行尾原样保留;不 trim、不重排任何正文。 */
export function splitLines(source: string): Line[] {
	const lines: Line[] = [];
	let start = 0;
	while (start <= source.length) {
		const nl = source.indexOf("\n", start);
		if (nl === -1) {
			lines.push({ content: source.slice(start), ending: "" });
			break;
		}
		let contentEnd = nl;
		let ending = "\n";
		if (contentEnd > start && source[contentEnd - 1] === "\r") {
			contentEnd -= 1;
			ending = "\r\n";
		}
		lines.push({ content: source.slice(start, contentEnd), ending });
		start = nl + 1;
	}
	return lines;
}

export function joinLines(lines: readonly Line[]): string {
	return lines.map((l) => l.content + l.ending).join("");
}

interface FenceInfo {
	quote: string; // blockquote 前缀原文(如 "> " / "> > "),顶层为空串
	marker: string; // 反引号或波浪号
	run: number; // marker 连续长度
	rest: string; // marker 之后到行尾的原文(info string / 尾部空白)
}

/**
 * 解析 fence 行:前导空格 ≤3,可选 blockquote 前缀(可嵌套),marker 为 ≥3 个 ` 或 ~。
 * 非 fence 行返回 undefined。顶层与 blockquote 前缀形式都认,以跳过代码块正文。
 */
export function parseFence(content: string): FenceInfo | undefined {
	const m = /^( {0,3})((?:>[ \t]?)*)(`{3,}|~{3,})(.*)$/.exec(content);
	if (!m) return undefined;
	return { quote: m[2], marker: m[3][0], run: m[3].length, rest: m[4] };
}

/**
 * CommonMark ATX heading(可带 blockquote 前缀):前导空格 ≤3(>3 空格为缩进代码,不动);
 * 3–6 个 `#` 后须紧跟空白或行尾(`###foo` 不是 heading,不动)。
 */
const ATX_HEADING_RE = /^( {0,3})((?:>[ \t]?)*)(#{3,6})(?=[ \t]|$)/;

/** 若行为 H3–H6 则投影为 `## › 原标题` 返回新行;否则 undefined。行尾由调用方保留。 */
function projectHeadingLine(content: string): string | undefined {
	const m = ATX_HEADING_RE.exec(content);
	if (!m) return undefined;
	return m[1] + m[2] + "## ›" + content.slice(m[0].length);
}

/**
 * 把 H3–H6 投影为 H2 文本 `## › 原标题` 的 display-only 投影。
 *
 * - 只作用于 assistant 完成态消息(interactive final);user / thinking / 流式中完全不变。
 * - fenced 代码块内(顶层或带 blockquote 前缀)逐字不动;closing 须同 quote/marker、
 *   run ≥ opening、marker 后仅空白。
 * - H1/H2、非 heading 行、缩进代码、list 嵌套标题一律原样。
 * - 幂等:`## › 原标题` 是 H2,不再投影,重跑结果不变。
 * - fail-open:非字符串输入原样返回。
 */
export function projectDeepHeadings(markdown: string, context: MarkdownTransformContext): string {
	if (typeof markdown !== "string") return markdown;
	if (context.messageType !== "assistant" || context.isStreaming) return markdown;

	const lines = splitLines(markdown);
	const out: Line[] = [];
	let changed = false;
	let fence: { quote: string; marker: string; run: number } | undefined;

	for (const line of lines) {
		const f = parseFence(line.content);
		if (fence !== undefined) {
			// fenced 块内:正文一律原样;closing 判定后退出。
			out.push(line);
			if (
				f !== undefined &&
				f.quote === fence.quote &&
				f.marker === fence.marker &&
				f.run >= fence.run &&
				f.rest.trim() === ""
			) {
				fence = undefined;
			}
			continue;
		}
		if (f !== undefined) {
			fence = { quote: f.quote, marker: f.marker, run: f.run };
			out.push(line);
			continue;
		}
		const projected = projectHeadingLine(line.content);
		if (projected !== undefined) {
			out.push({ content: projected, ending: line.ending });
			changed = true;
		} else {
			out.push(line);
		}
	}

	return changed ? joinLines(out) : markdown;
}
