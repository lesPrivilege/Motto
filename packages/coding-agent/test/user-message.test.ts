import { describe, expect, test } from "vitest";
import { GUTTER_RULE } from "../src/modes/interactive/components/motto-layout.ts";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

describe("UserMessageComponent", () => {
	test("renders first-line muted rule with hanging body and OSC markers", () => {
		initTheme("dark");

		const component = new UserMessageComponent("hello world, this is a longer user message to force wrapping");
		const lines = component.render(20);

		expect(lines).toHaveLength(5);
		// OSC 起始标记在首行（衬线行）行首；衬线独立成行、左锚。
		expect(lines[0].startsWith(OSC133_ZONE_START)).toBe(true);
		expect(stripAnsi(lines[0]).trimEnd()).toBe(GUTTER_RULE);
		// 正文在衬线下以 width − 2 折行，全部续行两空格悬挂缩进同列对齐。
		expect(stripAnsi(lines[1]).trimEnd()).toBe(`  hello world, this`);
		expect(stripAnsi(lines[2]).trimEnd()).toBe(`  is a longer user`);
		expect(stripAnsi(lines[3]).trimEnd()).toBe(`  message to force`);
		expect(stripAnsi(lines[4]).trimEnd()).toBe(`  wrapping`);
		// 末行以 OSC 结束标记收尾。
		expect(lines[lines.length - 1].endsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
		// 首行衬线使用 muted 槽（中灰），与正文不同色。
		expect(lines[0]).toContain(theme.fg("muted", GUTTER_RULE));
	});

	test("single short message keeps rule line and body line with OSC markers", () => {
		initTheme("dark");

		const component = new UserMessageComponent("hello");
		const lines = component.render(20);

		expect(lines).toHaveLength(2);
		expect(lines[0].startsWith(OSC133_ZONE_START + theme.fg("muted", GUTTER_RULE))).toBe(true);
		expect(stripAnsi(lines[0]).trimEnd()).toBe(GUTTER_RULE);
		expect(stripAnsi(lines[1]).trimEnd()).toBe(`  hello`);
		expect(lines[1].endsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
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
