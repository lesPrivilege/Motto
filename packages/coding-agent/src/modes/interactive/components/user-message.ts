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
 * Motto 视觉构成（TUI-1 S1）：去整宽气泡卡——不再套整宽背景 Box，
 * 改为逐行中灰左界栏 `│ ` + 悬挂正文。正文列左锚于界栏之后（第 3 列），
 * 续行同列悬挂。界栏为显示投影，会随拖选进入剪贴板（I6-4）。
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
		// 界栏布局下 user 正文固定左锚于界栏后，不随 outputPad 平移。
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
		// 正文在界栏后的可用宽度内折行，随后逐行前缀界栏。
		const body = super.render(Math.max(1, width - GUTTER_WIDTH));
		if (body.length === 0) {
			return body;
		}

		const gutter = theme.fg("muted", GUTTER);
		const lines = body.map((line) => gutter + line);

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = lines[lines.length - 1] + OSC133_ZONE_END + OSC133_ZONE_FINAL;
		return lines;
	}
}
