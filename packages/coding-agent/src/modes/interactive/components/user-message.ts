import { Container, Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import type { MarkdownTransformer } from "../../../core/extensions/types.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";
import { GUTTER, GUTTER_WIDTH } from "./motto-layout.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a user message.
 *
 * Motto 视觉构成（TUI-1 S1）：去整宽气泡卡——不再套整宽背景 Box。
 * 首行以中灰左 gutter `│ ` 标记消息边界（I6-4 显示投影），续行以
 * GUTTER_WIDTH 个空格悬挂缩进,正文列仍左锚于 gutter 之后（第 3 列），
 * 与 S2 assistant 正文 BODY_INDENT 同列；大篇幅正文不再逐行成 rail。
 * gutter 为显示投影，会随拖选进入剪贴板（I6-4）。
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
		// gutter 布局下 user 正文固定左锚于 gutter 后，不随 outputPad 平移。
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
		// 正文在 gutter 后的可用宽度内折行；首行前缀 gutter 标记消息边界，
		// 续行以 GUTTER_WIDTH 个空格悬挂缩进(正文列仍锚于第 3 列)。
		const body = super.render(Math.max(1, width - GUTTER_WIDTH));
		if (body.length === 0) {
			return body;
		}

		const gutter = theme.fg("muted", GUTTER);
		const lines = body.map((line, i) => (i === 0 ? gutter : " ".repeat(GUTTER_WIDTH)) + line);

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = lines[lines.length - 1] + OSC133_ZONE_END + OSC133_ZONE_FINAL;
		return lines;
	}
}
