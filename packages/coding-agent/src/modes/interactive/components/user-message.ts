import { Container, Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import type { MarkdownTransformer } from "../../../core/extensions/types.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";
import { GUTTER_RULE, GUTTER_WIDTH } from "./motto-layout.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a user message.
 *
 * Motto 视觉构成（TUI-1 S1 + tui-1-s1-r1 + r2 + r3）：去整宽气泡卡——不再套整宽背景 Box。
 * 首行为左上方短横衬线 `─────────`（脚注分隔线风格，tui-1-s1-r1 替代原首行竖界栏，
 * tui-1-s1-r2 加长 3→5 × U+2500；tui-1-s1-r3 加长 5→9 × U+2500），
 * 独立成行、左锚、muted；正文续行以 GUTTER_WIDTH 空格悬挂缩进，正文列左锚于
 * 第 3 列，与 S2 assistant 正文 BODY_INDENT 同列；大篇幅正文不再逐行成 rail。
 * 衬线为显示投影，会随拖选进入剪贴板（I6-4）。
 */
export class UserMessageComponent extends Container {
	private text: string;
	private markdownTheme: MarkdownTheme;
	private markdownTransformers: readonly MarkdownTransformer[];

	constructor(
		text: string,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
		_outputPad = 1,
		markdownTransformers: readonly MarkdownTransformer[] = [],
	) {
		super();
		this.text = text;
		this.markdownTheme = markdownTheme;
		this.markdownTransformers = markdownTransformers;
		this.rebuild();
	}

	setOutputPad(): void {
		// gutter 布局下 user 正文固定左锚于第 3 列，不随 outputPad 平移。
		this.rebuild();
	}

	private rebuild(): void {
		this.clear();
		this.addChild(
			new Markdown(
				this.text,
				0,
				0,
				this.markdownTheme,
				{
					color: (content: string) => theme.fg("userMessageText", content),
				},
				{
					preserveOrderedListMarkers: true,
					preserveBackslashEscapes: true,
					transform: createMarkdownTransform("user", false, this.markdownTransformers),
				},
			),
		);
	}

	override render(width: number): string[] {
		// 首行为左上方短横衬线（独立成行、muted）；正文在衬线下方以
		// width - GUTTER_WIDTH 折行，全部续行 GUTTER_WIDTH 空格悬挂缩进。
		const body = super.render(Math.max(1, width - GUTTER_WIDTH));
		if (body.length === 0) {
			return body;
		}

		const rule = theme.fg("muted", GUTTER_RULE);
		const lines = [rule, ...body.map((line) => " ".repeat(GUTTER_WIDTH) + line)];

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = lines[lines.length - 1] + OSC133_ZONE_END + OSC133_ZONE_FINAL;
		return lines;
	}
}
