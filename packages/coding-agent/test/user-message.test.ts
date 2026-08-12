import { describe, expect, test } from "vitest";
import { GUTTER } from "../src/modes/interactive/components/motto-layout.ts";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

describe("UserMessageComponent", () => {
	test("renders first-line muted gutter with hanging body and OSC markers", () => {
		initTheme("dark");

		const component = new UserMessageComponent("hello world, this is a longer user message to force wrapping");
		const lines = component.render(20);

		expect(lines).toHaveLength(4);
		// OSC 起始标记在首行行首；gutter 只落首行。
		expect(lines[0].startsWith(OSC133_ZONE_START)).toBe(true);
		// 正文在 gutter 后可用宽度（width − 2）内折行，续行以两空格悬挂缩进同列对齐。
		expect(stripAnsi(lines[0]).trimEnd()).toBe(`${GUTTER}hello world, this`);
		expect(stripAnsi(lines[1]).trimEnd()).toBe(`  is a longer user`);
		expect(stripAnsi(lines[2]).trimEnd()).toBe(`  message to force`);
		expect(stripAnsi(lines[3]).trimEnd()).toBe(`  wrapping`);
		// 末行以 OSC 结束标记收尾。
		expect(lines[lines.length - 1].endsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
		// 首行 gutter 使用 muted 槽（中灰），与正文不同色。
		expect(lines[0]).toContain(theme.fg("muted", GUTTER));
	});

	test("single short message keeps one line with gutter and OSC markers", () => {
		initTheme("dark");

		const component = new UserMessageComponent("hello");
		const lines = component.render(20);

		expect(lines).toHaveLength(1);
		expect(lines[0].startsWith(OSC133_ZONE_START + theme.fg("muted", GUTTER))).toBe(true);
		expect(stripAnsi(lines[0]).trimEnd()).toBe(`${GUTTER}hello`);
		expect(lines[0].endsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
	});

	test("chains Markdown transformers with user message context", () => {
		initTheme("dark");
		const calls: string[] = [];
		const component = new UserMessageComponent("The input is $x^2$.", undefined, 1, [
			(markdown, context) => {
				calls.push("formula");
				expect(context).toEqual({ messageType: "user", isStreaming: false, availableWidth: 78 });
				return markdown.replace("$x^2$", "x²");
			},
			(markdown) => {
				calls.push("suffix");
				return `${markdown} Done.`;
			},
		]);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("The input is x². Done.");
		expect(calls).toEqual(["formula", "suffix"]);
	});

	test("reapplies Markdown transformers when invalidated", () => {
		initTheme("dark");
		let suffix = "before";
		const component = new UserMessageComponent("Message", undefined, 1, [(markdown) => `${markdown} ${suffix}`]);

		expect(stripAnsi(component.render(80).join("\n"))).toContain("Message before");

		suffix = "after";
		component.invalidate();

		expect(stripAnsi(component.render(80).join("\n"))).toContain("Message after");
	});
});
