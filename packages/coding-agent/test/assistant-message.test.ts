import type { AssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.ts";
import {
	getThinkingFoldState,
	setThinkingFoldState,
	type ThinkingFoldState,
} from "../src/modes/interactive/components/thinking-fold.ts";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

function createAssistantMessage(
	content: AssistantMessage["content"],
	overrides: Partial<Pick<AssistantMessage, "stopReason">> = {},
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "gpt-4o-mini",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: overrides.stopReason ?? "stop",
		timestamp: Date.now(),
	};
}

describe("AssistantMessageComponent", () => {
	test("adds OSC 133 zone markers to assistant messages without tool calls", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(createAssistantMessage([{ type: "text", text: "hello" }]));
		const lines = component.render(40);

		expect(lines).not.toHaveLength(0);
		expect(lines[0]).toContain(OSC133_ZONE_START);
		expect(lines[lines.length - 1].startsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
	});

	test("does not add OSC 133 zone markers when assistant message contains tool calls", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "text", text: "calling tool" },
				{ type: "toolCall", id: "tool-1", name: "read", arguments: { path: "file.txt" } },
			]),
		);
		const rendered = component.render(60).join("\n");

		expect(rendered.includes(OSC133_ZONE_START)).toBe(false);
		expect(rendered.includes(OSC133_ZONE_END)).toBe(false);
		expect(rendered.includes(OSC133_ZONE_FINAL)).toBe(false);
	});

	test("renders length stops with neutral truncation wording", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking: "private reasoning" }], { stopReason: "length" }),
			true,
		);
		const rendered = component.render(80).join("\n");

		expect(rendered).toContain("Thinking...");
		expect(rendered).toContain("Response was truncated before completion.");
	});

	test("coalesces adjacent thinking blocks into one hidden thinking label", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "thinking", thinking: "first thought" },
				{ type: "thinking", thinking: "" },
				{ type: "thinking", thinking: "second thought" },
				{ type: "text", text: "answer" },
			]),
			true,
		);
		const rendered = stripAnsi(component.render(80).join("\n"));

		expect(rendered.match(/Thinking\.\.\./g)).toHaveLength(1);
		expect(rendered).toContain("answer");
	});

	test("uses configured output padding for text and thinking", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "text", text: "hello" },
				{ type: "thinking", thinking: "reasoning" },
			]),
			false,
			undefined,
			"Thinking...",
			1,
			[],
			"a1",
			// T2-2:默认 collapsed,此测试验 padding 需显式 full 态渲染 thinking 原文。
			() => "full",
		);
		const lines = component.render(80).map((line) => stripAnsi(line));

		expect(lines.some((line) => line.includes(" hello"))).toBe(true);
		expect(lines.some((line) => line.includes(" reasoning"))).toBe(true);

		// S2: assistant 正文列固定 BODY_INDENT,不随 outputPad 平移;thinking 仍随 outputPad。
		component.setOutputPad(0);
		const updatedLines = component.render(80).map((line) => stripAnsi(line));
		expect(updatedLines.some((line) => line.startsWith("  hello"))).toBe(true);
		expect(updatedLines.some((line) => line.startsWith("reasoning"))).toBe(true);
	});

	test("chains Markdown transformers in registration order", () => {
		initTheme("dark");
		const calls: string[] = [];
		const message = createAssistantMessage([{ type: "text", text: "The result is $x^2$." }]);
		const component = new AssistantMessageComponent(message, false, undefined, "Thinking...", 1, [
			(markdown, context) => {
				calls.push("formula");
				expect(context).toEqual({ messageType: "assistant", isStreaming: false, availableWidth: 78 });
				return markdown.replace("$x^2$", "x²");
			},
			(markdown) => {
				calls.push("suffix");
				return `${markdown} Done.`;
			},
		]);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("The result is x². Done.");
		expect(calls).toEqual(["formula", "suffix"]);
	});

	test("identifies partial assistant Markdown as streaming", () => {
		initTheme("dark");
		const streamingStates: boolean[] = [];
		const message = createAssistantMessage([{ type: "text", text: "partial" }]);
		const component = new AssistantMessageComponent(undefined, false, undefined, "Thinking...", 1, [
			(markdown, context) => {
				streamingStates.push(context.isStreaming);
				return context.isStreaming ? markdown : `${markdown} transformed`;
			},
		]);

		component.updateContent(message, true);
		expect(stripAnsi(component.render(80).join("\n"))).not.toContain("transformed");

		component.updateContent(message, false);
		expect(stripAnsi(component.render(80).join("\n"))).toContain("partial transformed");
		expect(streamingStates).toEqual([true, false]);
	});

	test("reapplies Markdown transformers when available width changes", () => {
		initTheme("dark");
		const availableWidths: number[] = [];
		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "text", text: "answer" }]),
			false,
			undefined,
			"Thinking...",
			1,
			[
				(markdown, context) => {
					availableWidths.push(context.availableWidth);
					return `${markdown} (${context.availableWidth})`;
				},
			],
		);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("answer (76)");
		component.render(80);
		expect(stripAnsi(component.render(60).join("\n"))).toContain("answer (56)");
		expect(availableWidths).toEqual([76, 56]);
	});

	test("continues the Markdown transformer chain when a transformer throws", () => {
		initTheme("dark");
		const calls: string[] = [];
		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "text", text: "still visible" }]),
			false,
			undefined,
			"Thinking...",
			1,
			[
				(markdown) => {
					calls.push("first");
					return markdown.replace("still", "remains");
				},
				() => {
					calls.push("throw");
					throw new Error("broken transformer");
				},
				(markdown) => {
					calls.push("last");
					return `${markdown} after error`;
				},
			],
		);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("remains visible after error");
		expect(calls).toEqual(["first", "throw", "last"]);
	});

	test("transforms text and thinking Markdown without mutating the original message", () => {
		initTheme("dark");
		const message = createAssistantMessage([
			{ type: "text", text: "answer" },
			{ type: "thinking", thinking: "reasoning" },
		]);
		const component = new AssistantMessageComponent(
			message,
			false,
			undefined,
			"Thinking...",
			1,
			[
				(markdown, { messageType }) => {
					return `${messageType}:${markdown}`;
				},
			],
			"a1",
			() => "full",
		);

		const rendered = stripAnsi(component.render(80).join("\n"));
		expect(rendered).toContain("assistant:answer");
		expect(rendered).toContain("assistant-thinking:reasoning");
		expect(message.content).toEqual([
			{ type: "text", text: "answer" },
			{ type: "thinking", thinking: "reasoning" },
		]);
	});

	test("user messages ignore outputPad: body stays left-anchored after gutter", () => {
		initTheme("dark");

		// S1 gutter 布局：user 正文固定左锚于 gutter 后第 3 列，不随 outputPad 平移。
		for (const pad of [0, 1, 3]) {
			const component = new UserMessageComponent("hello", undefined, pad);
			const lines = component.render(40).map((line) => stripAnsi(line));
			expect(lines.some((line) => line.trimEnd() === "│ hello")).toBe(true);
		}
	});

	test("T2-1: assigns one entryId per merged thinking run, skipping empty blocks", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "thinking", thinking: "first thought" },
				{ type: "thinking", thinking: "" },
				{ type: "thinking", thinking: "second thought" },
				{ type: "text", text: "answer" },
			]),
			false,
			undefined,
			"Thinking...",
			1,
			[],
			"a1",
		);

		component.render(80);
		expect(component.getThinkingEntryIds()).toEqual(["a1:1"]);
	});

	test("T2-1: entryIds align with multiple thinking runs in run order", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "thinking", thinking: "run one" },
				{ type: "text", text: "body" },
				{ type: "thinking", thinking: "run two" },
			]),
			false,
			undefined,
			"Thinking...",
			1,
			[],
			"a3",
		);

		component.render(80);
		expect(component.getThinkingEntryIds()).toEqual(["a3:1", "a3:2"]);
	});

	test("T2-1: entryId is stable across updateContent frames (I7-1)", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(undefined, false, undefined, "Thinking...", 1, [], "a2");
		component.updateContent(createAssistantMessage([{ type: "thinking", thinking: "first" }]), true);
		expect(component.getThinkingEntryIds()).toEqual(["a2:1"]);

		// 相邻 thinking 块合并为一 run;追加正文后才出现第二 run,既有 entryId 不变。
		component.updateContent(
			createAssistantMessage([
				{ type: "thinking", thinking: "first" },
				{ type: "text", text: "interim" },
				{ type: "thinking", thinking: "second" },
			]),
			true,
		);
		expect(component.getThinkingEntryIds()).toEqual(["a2:1", "a2:2"]);

		// 同消息重复 update → 同一 id(帧间一致)。
		component.updateContent(
			createAssistantMessage([
				{ type: "thinking", thinking: "first" },
				{ type: "text", text: "interim" },
				{ type: "thinking", thinking: "second" },
			]),
			true,
		);
		expect(component.getThinkingEntryIds()).toEqual(["a2:1", "a2:2"]);
	});

	test("T2-1: fold map defaults collapsed and persists across rebuild", () => {
		initTheme("dark");

		const fold = new Map<string, ThinkingFoldState>();
		const entryId = "a1:1";
		expect(getThinkingFoldState(fold, entryId)).toBe("collapsed");

		setThinkingFoldState(fold, entryId, "preview");

		// 重建 = 以同一 messageKey 新建组件(同源同序 → 同 entryId),fold 选择保持。
		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking: "reasoning" }]),
			false,
			undefined,
			"Thinking...",
			1,
			[],
			"a1",
		);
		component.render(80);
		expect(component.getThinkingEntryIds()).toEqual([entryId]);
		expect(getThinkingFoldState(fold, entryId)).toBe("preview");
	});

	// ---- T2-2:三态渲染(默认 collapsed;provider 缺省回落 DEFAULT) ----

	test("T2-2: default (no provider) renders collapsed label", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking: "long private reasoning text" }]),
		);
		const rendered = stripAnsi(component.render(80).join("\n"));

		expect(rendered.match(/Thinking\.\.\./g)).toHaveLength(1);
		expect(rendered).not.toContain("long private reasoning text");
	});

	test("T2-2: provider returning full renders the complete thinking text", () => {
		initTheme("dark");
		const thinking = "full reasoning text that should be fully visible";

		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking }]),
			false,
			undefined,
			"Thinking...",
			1,
			[],
			"a1",
			() => "full",
		);
		const rendered = stripAnsi(component.render(80).join("\n"));

		expect(rendered).toContain(thinking);
		expect(rendered).not.toContain("Thinking...");
	});

	test("T2-2: provider returning preview renders a bounded head/tail summary", () => {
		initTheme("dark");
		const thinking = `${"A".repeat(200)}中间独有标记绝不会出现在摘要中。${"B".repeat(200)}结尾标记字样 TAIL_END_MARKER`;

		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking }]),
			false,
			undefined,
			"Thinking...",
			1,
			[],
			"a1",
			() => "preview",
		);
		const rendered = stripAnsi(component.render(80).join("\n"));

		// 有界:预览(去空白折叠后)短于全文。
		expect(rendered.length).toBeLessThan(thinking.length);
		// 含省略号与尾部内容;头部标记在省略号之前;中部独有内容不出现。
		expect(rendered).toContain("…");
		expect(rendered).toContain("TAIL_END_MARKER");
		expect(rendered.indexOf("…")).toBeLessThan(rendered.indexOf("TAIL_END_MARKER"));
		expect(rendered).not.toContain("中间独有标记");
	});

	test("T2-2: hideThinkingBlock=true keeps the compat label path (takes precedence over fold state)", () => {
		initTheme("dark");

		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking: "secret reasoning" }]),
			true,
			undefined,
			"Thinking...",
			1,
			[],
			"a1",
			// 即使 provider 返回 full,兼容路径优先 → 仍只出标签。
			() => "full",
		);
		const rendered = stripAnsi(component.render(80).join("\n"));

		expect(rendered.match(/Thinking\.\.\./g)).toHaveLength(1);
		expect(rendered).not.toContain("secret reasoning");
	});

	test("T2-2: three states are frame-stable across updateContent re-renders", () => {
		initTheme("dark");
		const message = createAssistantMessage([
			{ type: "thinking", thinking: "frame stable reasoning content ".repeat(8) },
		]);

		for (const state of ["collapsed", "preview", "full"] as const) {
			const component = new AssistantMessageComponent(
				message,
				false,
				undefined,
				"Thinking...",
				1,
				[],
				"a1",
				() => state,
			);
			const first = stripAnsi(component.render(80).join("\n"));
			// 同 provider 同 message 重复 update(流式帧重建)→ 输出逐字节一致(I7-1)。
			component.updateContent(message, true);
			const second = stripAnsi(component.render(80).join("\n"));
			expect(second).toBe(first);
			expect(component.getThinkingEntryIds()).toEqual(["a1:1"]);
		}
	});
});
