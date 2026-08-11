import type { AssistantMessage } from "@earendil-works/pi-ai";
import { Container, Markdown, type MarkdownTheme, Spacer, Text } from "@earendil-works/pi-tui";
import type { MarkdownTransformer } from "../../../core/extensions/types.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";
import { BODY_INDENT } from "./motto-layout.ts";
import {
	buildThinkingPreview,
	DEFAULT_THINKING_FOLD_STATE,
	type ThinkingFoldState,
	thinkingEntryId,
} from "./thinking-fold.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a complete assistant message
 */
export class AssistantMessageComponent extends Container {
	private contentContainer: Container;
	private hideThinkingBlock: boolean;
	private markdownTheme: MarkdownTheme;
	private hiddenThinkingLabel: string;
	private outputPad: number;
	private markdownTransformers: readonly MarkdownTransformer[];
	private lastMessage?: AssistantMessage;
	private hasToolCalls = false;
	private isStreaming = false;
	// T2-1:thinking 块稳定身份。messageKey 于 message_start 定死(I7-1),run 序数
	// 与 run 合并逻辑对齐;entryId = `${messageKey}:${runIndex}`(纯 UI 推导,不落 session)。
	private thinkingMessageKey?: string;
	// 当前消息各 thinking run 的 entryId(按 run 序数 1-based 对齐),供 fold map 查表(T2-1 管道)。
	private thinkingEntryIds: string[] = [];
	// T2-2:per-entry fold 状态提供者(interactive-mode 的 getThinkingEntryFoldState 绑定)。
	// 缺省 undefined → 每条 entry 回落 DEFAULT(collapsed),组件可独立使用(测试/基线)。
	private thinkingFoldProvider?: (entryId: string) => ThinkingFoldState;

	constructor(
		message?: AssistantMessage,
		hideThinkingBlock = false,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
		hiddenThinkingLabel = "Thinking...",
		outputPad = 1,
		markdownTransformers: readonly MarkdownTransformer[] = [],
		thinkingMessageKey?: string,
		thinkingFoldProvider?: (entryId: string) => ThinkingFoldState,
	) {
		super();

		this.hideThinkingBlock = hideThinkingBlock;
		this.markdownTheme = markdownTheme;
		this.hiddenThinkingLabel = hiddenThinkingLabel;
		this.outputPad = outputPad;
		this.markdownTransformers = markdownTransformers;
		this.thinkingMessageKey = thinkingMessageKey;
		this.thinkingFoldProvider = thinkingFoldProvider;

		// Container for text/thinking content
		this.contentContainer = new Container();
		this.addChild(this.contentContainer);

		if (message) {
			this.updateContent(message);
		}
	}

	override invalidate(): void {
		super.invalidate();
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setHideThinkingBlock(hide: boolean): void {
		this.hideThinkingBlock = hide;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setHiddenThinkingLabel(label: string): void {
		this.hiddenThinkingLabel = label;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setOutputPad(padding: number): void {
		this.outputPad = padding;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	/** T2-1:当前消息各 thinking run 的稳定 entryId(与 run 合并序数对齐)。 */
	getThinkingEntryIds(): readonly string[] {
		return this.thinkingEntryIds;
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		if (this.hasToolCalls || lines.length === 0) {
			return lines;
		}

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
		return lines;
	}

	updateContent(message: AssistantMessage, isStreaming = this.isStreaming): void {
		this.lastMessage = message;
		this.isStreaming = isStreaming;

		// Clear content container
		this.contentContainer.clear();
		this.thinkingEntryIds = [];

		const hasVisibleContent = message.content.some(
			(c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()),
		);

		if (hasVisibleContent) {
			this.contentContainer.addChild(new Spacer(1));
		}

		// Render content in order
		let thinkingRunIndex = 0;
		for (let i = 0; i < message.content.length; i++) {
			const content = message.content[i];
			if (content.type === "text" && content.text.trim()) {
				// Assistant text messages with no background - trim the text
				// Set paddingY=0 to avoid extra spacing before tool executions
				// S2: 正文列对齐 BODY_INDENT(与 user 悬挂正文同列),间距而非框线承担分隔。
				this.contentContainer.addChild(
					new Markdown(content.text.trim(), BODY_INDENT, 0, this.markdownTheme, undefined, {
						transform: createMarkdownTransform("assistant", this.isStreaming, this.markdownTransformers),
					}),
				);
			} else if (content.type === "thinking") {
				const thinkingBlocks: string[] = [];
				for (; i < message.content.length; i++) {
					const thinkingContent = message.content[i];
					if (thinkingContent.type !== "thinking") {
						break;
					}
					const thinking = thinkingContent.thinking.trim();
					if (thinking) {
						thinkingBlocks.push(thinking);
					}
				}
				i--;

				if (thinkingBlocks.length === 0) {
					continue;
				}

				// T2-1:按 run 合并序数取稳定 entryId 并暴露。T2-2:hideThinkingBlock 兼容路径优先
				// (全隐不变);否则按 fold 状态三态渲染(collapsed 默认 / preview 有界摘要 / full 原文)。
				thinkingRunIndex++;
				let entryId: string | undefined;
				if (this.thinkingMessageKey !== undefined) {
					entryId = thinkingEntryId(this.thinkingMessageKey, thinkingRunIndex);
					this.thinkingEntryIds.push(entryId);
				}

				// Add spacing only when another visible assistant content block follows.
				// This avoids a superfluous blank line before separately-rendered tool execution blocks.
				const hasVisibleContentAfter = message.content
					.slice(i + 1)
					.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));

				if (this.hideThinkingBlock) {
					// Show one static label for each run of thinking blocks when hidden.
					this.contentContainer.addChild(
						new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0),
					);
				} else {
					// T2-2:per-entry 三态。provider 缺省(无 entryId 或未注入)→ DEFAULT(collapsed),
					// 与 hideThinkingBlock 全隐同款单行标签;fold 状态只属 UI,不写 session。
					const foldState =
						entryId !== undefined && this.thinkingFoldProvider
							? this.thinkingFoldProvider(entryId)
							: DEFAULT_THINKING_FOLD_STATE;
					switch (foldState) {
						case "full":
							// full = 完整 thinking 原文(原非隐藏路径不变)。
							this.contentContainer.addChild(
								new Markdown(
									thinkingBlocks.join("\n\n"),
									this.outputPad,
									0,
									this.markdownTheme,
									{
										color: (text: string) => theme.fg("thinkingText", text),
										italic: true,
									},
									{
										transform: createMarkdownTransform(
											"assistant-thinking",
											this.isStreaming,
											this.markdownTransformers,
										),
									},
								),
							);
							break;
						case "preview":
							// preview = 有界首尾摘要(单 Text 块,thinkingText 色 + italic;Text 自动折行,
							// 预算 64+…+40 → 40 列下 ~3 行、其余宽度 ≤ 2 行,零超宽)。
							this.contentContainer.addChild(
								new Text(
									theme.italic(theme.fg("thinkingText", buildThinkingPreview(thinkingBlocks.join("\n\n")))),
									this.outputPad,
									0,
								),
							);
							break;
						default:
							// collapsed(默认)= 每 run 单行静态标签,复用 hiddenThinkingLabel 样式。
							this.contentContainer.addChild(
								new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0),
							);
							break;
					}
				}
				if (hasVisibleContentAfter) {
					this.contentContainer.addChild(new Spacer(1));
				}
			}
		}

		// Check if incomplete/failed - show after partial content.
		// For aborted/error tool calls, tool execution components show the error.
		// Length stops can happen before a tool call is complete, so surface them here too.
		const hasToolCalls = message.content.some((c) => c.type === "toolCall");
		this.hasToolCalls = hasToolCalls;
		if (message.stopReason === "length") {
			this.contentContainer.addChild(new Spacer(1));
			this.contentContainer.addChild(
				new Text(theme.fg("error", "Response was truncated before completion."), BODY_INDENT, 0),
			);
		} else if (!hasToolCalls) {
			if (message.stopReason === "aborted") {
				const abortMessage =
					message.errorMessage && message.errorMessage !== "Request was aborted"
						? message.errorMessage
						: "Operation aborted";
				this.contentContainer.addChild(new Spacer(1));
				this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), BODY_INDENT, 0));
			} else if (message.stopReason === "error") {
				const errorMsg = message.errorMessage || "Unknown error";
				this.contentContainer.addChild(new Spacer(1));
				this.contentContainer.addChild(new Text(theme.fg("error", `Error: ${errorMsg}`), BODY_INDENT, 0));
			}
		}
	}
}
