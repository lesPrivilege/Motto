import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import type { Terminal as XtermTerminalType } from "@xterm/headless";
import { Chalk } from "chalk";
import { Markdown } from "../src/components/markdown.ts";
import { resetCapabilitiesCache, setCapabilities } from "../src/terminal-image.ts";
import type { Component, TUI } from "../src/tui.ts";
import { TuiMainScreen } from "../src/tui-main-screen.ts";
import { visibleWidth } from "../src/utils.ts";
import { defaultMarkdownTheme } from "./test-themes.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

// Force full color in CI so ANSI assertions are deterministic
const chalk = new Chalk({ level: 3 });

function getCellItalic(terminal: VirtualTerminal, row: number, col: number): number {
	const xterm = (terminal as unknown as { xterm: XtermTerminalType }).xterm;
	const buffer = xterm.buffer.active;
	const line = buffer.getLine(buffer.viewportY + row);
	assert.ok(line, `Missing buffer line at row ${row}`);
	const cell = line.getCell(col);
	assert.ok(cell, `Missing cell at row ${row} col ${col}`);
	return cell.isItalic();
}

function getCellUnderline(terminal: VirtualTerminal, row: number, col: number): number {
	const xterm = (terminal as unknown as { xterm: XtermTerminalType }).xterm;
	const buffer = xterm.buffer.active;
	const line = buffer.getLine(buffer.viewportY + row);
	assert.ok(line, `Missing buffer line at row ${row}`);
	const cell = line.getCell(col);
	assert.ok(cell, `Missing cell at row ${row} col ${col}`);
	return cell.isUnderline();
}

function stripAnsi(line: string): string {
	return line.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("Markdown component", () => {
	describe("Transforms", () => {
		it("caches transformed Markdown by source and available width", () => {
			const calls: Array<{ source: string; availableWidth: number }> = [];
			const markdown = new Markdown("source", 2, 0, defaultMarkdownTheme, undefined, {
				transform: (source, availableWidth) => {
					calls.push({ source, availableWidth });
					return `${source} ${availableWidth}`;
				},
			});

			assert.deepStrictEqual(
				markdown.render(80).map((line) => stripAnsi(line).trim()),
				["source 76"],
			);
			markdown.render(80);
			assert.deepStrictEqual(
				markdown.render(60).map((line) => stripAnsi(line).trim()),
				["source 56"],
			);
			assert.deepStrictEqual(calls, [
				{ source: "source", availableWidth: 76 },
				{ source: "source", availableWidth: 56 },
			]);

			markdown.setText("updated");
			assert.deepStrictEqual(
				markdown.render(60).map((line) => stripAnsi(line).trim()),
				["updated 56"],
			);
			assert.deepStrictEqual(calls.at(-1), { source: "updated", availableWidth: 56 });

			markdown.invalidate();
			markdown.render(60);
			assert.deepStrictEqual(calls.at(-1), { source: "updated", availableWidth: 56 });
			assert.strictEqual(calls.length, 4);
		});
	});

	describe("Lists", () => {
		it("should render simple nested list", () => {
			const markdown = new Markdown(
				`- Item 1
  - Nested 1.1
  - Nested 1.2
- Item 2`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);

			// Check that we have content
			assert.ok(lines.length > 0);

			// Strip ANSI codes for checking
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check structure
			assert.ok(plainLines.some((line) => line.includes("- Item 1")));
			assert.ok(plainLines.some((line) => line.includes("    - Nested 1.1")));
			assert.ok(plainLines.some((line) => line.includes("    - Nested 1.2")));
			assert.ok(plainLines.some((line) => line.includes("- Item 2")));
		});

		it("should render deeply nested list", () => {
			const markdown = new Markdown(
				`- Level 1
  - Level 2
    - Level 3
      - Level 4`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check proper indentation
			assert.ok(plainLines.some((line) => line.includes("- Level 1")));
			assert.ok(plainLines.some((line) => line.includes("    - Level 2")));
			assert.ok(plainLines.some((line) => line.includes("        - Level 3")));
			assert.ok(plainLines.some((line) => line.includes("            - Level 4")));
		});

		it("should render ordered nested list", () => {
			const markdown = new Markdown(
				`1. First
   1. Nested first
   2. Nested second
2. Second`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			assert.ok(plainLines.some((line) => line.includes("1. First")));
			assert.ok(plainLines.some((line) => line.includes("    1. Nested first")));
			assert.ok(plainLines.some((line) => line.includes("    2. Nested second")));
			assert.ok(plainLines.some((line) => line.includes("2. Second")));
		});

		it("should normalize ordered list markers by default", () => {
			const markdown = new Markdown("1. alpha\n1. beta\n1. gamma", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["1. alpha", "2. beta", "3. gamma"]);
		});

		it("should preserve source list markers when configured", () => {
			const markdown = new Markdown(
				"  4. forth\n  3. third\n\n10) ten\n7) seven\n\n+ plus\n* star\n- minus\n+",
				0,
				0,
				defaultMarkdownTheme,
				undefined,
				{
					preserveOrderedListMarkers: true,
				},
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [
				"4. forth",
				"3. third",
				"",
				"10) ten",
				"7) seven",
				"",
				"+ plus",
				"* star",
				"- minus",
				"+",
			]);
		});

		it("should render mixed ordered and unordered nested lists", () => {
			const markdown = new Markdown(
				`1. Ordered item
   - Unordered nested
   - Another nested
2. Second ordered
   - More nested`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			assert.ok(plainLines.some((line) => line.includes("1. Ordered item")));
			assert.ok(plainLines.some((line) => line.includes("    - Unordered nested")));
			assert.ok(plainLines.some((line) => line.includes("2. Second ordered")));
		});

		it("should render blank lines between loose list items", () => {
			const markdown = new Markdown(
				`1. Lorem ipsum dolor sit amet.

   Ut enim ad minim veniam.

2. Duis aute irure dolor.

   Excepteur sint occaecat cupidatat.

3. Beep boop`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [
				"1. Lorem ipsum dolor sit amet.",
				"",
				"   Ut enim ad minim veniam.",
				"",
				"2. Duis aute irure dolor.",
				"",
				"   Excepteur sint occaecat cupidatat.",
				"",
				"3. Beep boop",
			]);
		});

		it("should render task list markers", () => {
			const markdown = new Markdown("- [ ] beep\n- [x] boop", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- [ ] beep", "- [x] boop"]);
		});

		it("should maintain numbering when code blocks are not indented (LLM output)", () => {
			// When code blocks aren't indented, marked parses each item as a separate list.
			// We use token.start to preserve the original numbering.
			const markdown = new Markdown(
				`1. First item

\`\`\`typescript
// code block
\`\`\`

2. Second item

\`\`\`typescript
// another code block
\`\`\`

3. Third item`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim());

			// Find all lines that start with a number and period
			const numberedLines = plainLines.filter((line) => /^\d+\./.test(line));

			// Should have 3 numbered items
			assert.strictEqual(numberedLines.length, 3, `Expected 3 numbered items, got: ${numberedLines.join(", ")}`);

			// Check the actual numbers
			assert.ok(numberedLines[0].startsWith("1."), `First item should be "1.", got: ${numberedLines[0]}`);
			assert.ok(numberedLines[1].startsWith("2."), `Second item should be "2.", got: ${numberedLines[1]}`);
			assert.ok(numberedLines[2].startsWith("3."), `Third item should be "3.", got: ${numberedLines[2]}`);
		});

		it("should indent wrapped unordered list lines", () => {
			const markdown = new Markdown("- alpha beta gamma delta epsilon", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(20).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- alpha beta gamma", "  delta epsilon"]);
		});

		it("should indent wrapped ordered list lines", () => {
			const markdown = new Markdown("1. alpha beta gamma delta epsilon", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(20).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["1. alpha beta gamma", "   delta epsilon"]);
		});

		it("should indent wrapped ordered list lines with multi-digit markers", () => {
			const markdown = new Markdown("10. alpha beta gamma delta epsilon", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(21).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["10. alpha beta gamma", "    delta epsilon"]);
		});

		it("should indent wrapped nested list lines", () => {
			const markdown = new Markdown(`- parent\n  - alpha beta gamma delta epsilon`, 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- parent", "    - alpha beta gamma", "      delta epsilon"]);
		});

		it("should indent wrapped nested list lines under ordered parents", () => {
			const markdown = new Markdown(`1. parent\n   - alpha beta gamma delta epsilon`, 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["1. parent", "    - alpha beta gamma", "      delta epsilon"]);
		});

		it("should render and wrap blockquotes inside list items", () => {
			const markdown = new Markdown("- > alpha beta gamma delta epsilon zeta", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- │ alpha beta gamma", "  │ delta epsilon zeta"]);
		});

		it("should render and wrap code blocks inside list items", () => {
			const markdown = new Markdown(
				"- ```ts\n  alpha beta gamma delta epsilon zeta\n  ```",
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- ```ts", "    alpha beta gamma", "  delta epsilon zeta", "  ```"]);
		});
	});

	describe("Tables", () => {
		it("should render simple table", () => {
			const markdown = new Markdown(
				`| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check table structure
			assert.ok(plainLines.some((line) => line.includes("Name")));
			assert.ok(plainLines.some((line) => line.includes("Age")));
			assert.ok(plainLines.some((line) => line.includes("Alice")));
			assert.ok(plainLines.some((line) => line.includes("Bob")));
			// Check for table borders
			assert.ok(plainLines.some((line) => line.includes("│")));
			assert.ok(plainLines.some((line) => line.includes("─")));
		});

		it("should render row dividers between data rows", () => {
			const markdown = new Markdown(
				`| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const dividerLines = plainLines.filter((line) => line.includes("┼"));

			assert.strictEqual(dividerLines.length, 2, "Expected header + row divider");
		});

		it("should keep column width at least the longest word", () => {
			const longestWord = "superlongword";
			const markdown = new Markdown(
				`| Column One | Column Two |
| --- | --- |
| ${longestWord} short | otherword |
| small | tiny |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(32);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const dataLine = plainLines.find((line) => line.includes(longestWord));
			assert.ok(dataLine, "Expected data row containing longest word");

			const segments = dataLine.split("│").slice(1, -1);
			const [firstSegment] = segments;
			assert.ok(firstSegment, "Expected first column segment");
			const firstColumnWidth = firstSegment.length - 2;

			assert.ok(
				firstColumnWidth >= longestWord.length,
				`Expected first column width >= ${longestWord.length}, got ${firstColumnWidth}`,
			);
		});

		it("should render table with alignment", () => {
			const markdown = new Markdown(
				`| Left | Center | Right |
| :--- | :---: | ---: |
| A | B | C |
| Long text | Middle | End |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check headers
			assert.ok(plainLines.some((line) => line.includes("Left")));
			assert.ok(plainLines.some((line) => line.includes("Center")));
			assert.ok(plainLines.some((line) => line.includes("Right")));
			// Check content
			assert.ok(plainLines.some((line) => line.includes("Long text")));
		});

		it("should handle tables with varying column widths", () => {
			const markdown = new Markdown(
				`| Short | Very long column header |
| --- | --- |
| A | This is a much longer cell content |
| B | Short |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);

			// Should render without errors
			assert.ok(lines.length > 0);

			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			assert.ok(plainLines.some((line) => line.includes("Very long column header")));
			assert.ok(plainLines.some((line) => line.includes("This is a much longer cell content")));
		});

		it("should wrap table cells when table exceeds available width", () => {
			const markdown = new Markdown(
				`| Command | Description | Example |
| --- | --- | --- |
| npm install | Install all dependencies | npm install |
| npm run build | Build the project | npm run build |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Render at narrow width that forces wrapping
			const lines = markdown.render(50);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// All lines should fit within width
			for (const line of plainLines) {
				assert.ok(line.length <= 50, `Line exceeds width 50: "${line}" (length: ${line.length})`);
			}

			// Content should still be present (possibly wrapped across lines)
			const allText = plainLines.join(" ");
			assert.ok(allText.includes("Command"), "Should contain 'Command'");
			assert.ok(allText.includes("Description"), "Should contain 'Description'");
			assert.ok(allText.includes("npm install"), "Should contain 'npm install'");
			assert.ok(allText.includes("Install"), "Should contain 'Install'");
		});

		it("should wrap long cell content to multiple lines", () => {
			const markdown = new Markdown(
				`| Header |
| --- |
| This is a very long cell content that should wrap |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Render at width that forces the cell to wrap
			const lines = markdown.render(25);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Should have multiple data rows due to wrapping
			const dataRows = plainLines.filter((line) => line.startsWith("│") && !line.includes("─"));
			assert.ok(dataRows.length > 2, `Expected wrapped rows, got ${dataRows.length} rows`);

			// All content should be preserved (may be split across lines)
			const allText = plainLines.join(" ");
			assert.ok(allText.includes("very long"), "Should preserve 'very long'");
			assert.ok(allText.includes("cell content"), "Should preserve 'cell content'");
			assert.ok(allText.includes("should wrap"), "Should preserve 'should wrap'");
		});

		it("should wrap long unbroken tokens inside table cells (not only at line start)", () => {
			// Pin to no-hyperlinks so width checks work on plain text without OSC 8 sequences.
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			const url = "https://example.com/this/is/a/very/long/url/that/should/wrap";
			const markdown = new Markdown(
				`| Value |
| --- |
| prefix ${url} |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const width = 30;
			const lines = markdown.render(width);
			resetCapabilitiesCache();
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			for (const line of plainLines) {
				assert.ok(line.length <= width, `Line exceeds width ${width}: "${line}" (length: ${line.length})`);
			}

			// Borders should stay intact (exactly 2 vertical borders for a 1-col table)
			const tableLines = plainLines.filter((line) => line.startsWith("│"));
			assert.ok(tableLines.length > 0, "Expected table rows to render");
			for (const line of tableLines) {
				const borderCount = line.split("│").length - 1;
				assert.strictEqual(borderCount, 2, `Expected 2 borders, got ${borderCount}: "${line}"`);
			}

			// Strip box drawing characters + whitespace so we can assert the URL is preserved
			// even if it was split across multiple wrapped lines.
			const extracted = plainLines.join("").replace(/[│├┤─\s]/g, "");
			assert.ok(extracted.includes("prefix"), "Should preserve 'prefix'");
			assert.ok(extracted.includes(url), "Should preserve URL");
		});

		it("should wrap styled inline code inside table cells without breaking borders", () => {
			const markdown = new Markdown(
				`| Code |
| --- |
| \`averyveryveryverylongidentifier\` |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const width = 20;
			const lines = markdown.render(width);
			const joinedOutput = lines.join("\n");
			assert.ok(joinedOutput.includes("\x1b[33m"), "Inline code should be styled (yellow)");

			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());
			for (const line of plainLines) {
				assert.ok(line.length <= width, `Line exceeds width ${width}: "${line}" (length: ${line.length})`);
			}

			const tableLines = plainLines.filter((line) => line.startsWith("│"));
			for (const line of tableLines) {
				const borderCount = line.split("│").length - 1;
				assert.strictEqual(borderCount, 2, `Expected 2 borders, got ${borderCount}: "${line}"`);
			}
		});

		it("should handle extremely narrow width gracefully", () => {
			const markdown = new Markdown(
				`| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Very narrow width
			const lines = markdown.render(15);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Should not crash and should produce output
			assert.ok(lines.length > 0, "Should produce output");

			// Lines should not exceed width
			for (const line of plainLines) {
				assert.ok(line.length <= 15, `Line exceeds width 15: "${line}" (length: ${line.length})`);
			}
		});

		it("should render table correctly when it fits naturally", () => {
			const markdown = new Markdown(
				`| A | B |
| --- | --- |
| 1 | 2 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Wide width where table fits naturally
			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Should have proper table structure
			const headerLine = plainLines.find((line) => line.includes("A") && line.includes("B"));
			assert.ok(headerLine, "Should have header row");
			assert.ok(headerLine?.includes("│"), "Header should have borders");

			const separatorLine = plainLines.find((line) => line.includes("├") && line.includes("┼"));
			assert.ok(separatorLine, "Should have separator row");

			const dataLine = plainLines.find((line) => line.includes("1") && line.includes("2"));
			assert.ok(dataLine, "Should have data row");
		});

		it("should respect paddingX when calculating table width", () => {
			const markdown = new Markdown(
				`| Column One | Column Two |
| --- | --- |
| Data 1 | Data 2 |`,
				2, // paddingX = 2
				0,
				defaultMarkdownTheme,
			);

			// Width 40 with paddingX=2 means contentWidth=36
			const lines = markdown.render(40);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// All lines should respect width
			for (const line of plainLines) {
				assert.ok(line.length <= 40, `Line exceeds width 40: "${line}" (length: ${line.length})`);
			}

			// Table rows should have left padding
			const tableRow = plainLines.find((line) => line.includes("│"));
			assert.ok(tableRow?.startsWith("  "), "Table should have left padding");
		});

		it("should not add a trailing blank line when table is the last rendered block", () => {
			const markdown = new Markdown(
				`| Name |
| --- |
| Alice |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected table to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Card top-right embedded tag (motto-card:tag-top-right)", () => {
		// 渲染工具:marker + 单列表格 → 行数组(剥 ANSI 与去尾空白)。
		function renderCard(header: string, rows: string[], width: number): string[] {
			const table =
				`<!--motto-card:tag-top-right-->\n| ${header} |\n|---|` +
				rows.map((r) => (r === "" ? "\n|  |" : `\n| ${r} |`)).join("");
			return new Markdown(table, 0, 0, defaultMarkdownTheme).render(width).map((l) => l.trimEnd());
		}
		const strip = (l: string) => l.replace(/\x1b\[[0-9;]*m/g, "");
		const cardLines = (width: number) => renderCard("text", ["alpha", "beta", "", "gamma"], width).map(strip);

		it("renders exactly one top border with [text] embedded (no standalone [text] line)", () => {
			const lines = cardLines(80);
			const topBorders = lines.filter((l) => l.startsWith("┌") && l.endsWith("┐"));
			assert.strictEqual(topBorders.length, 1, `exactly one top border: ${JSON.stringify(lines)}`);
			assert.ok(topBorders[0].includes("[text]"), "top border embeds [text]");
			assert.ok(!lines.some((l) => l.trim() === "[text]"), "no standalone [text] line");
			// 只有一条 top border,body 行用 │,bottom 用 └
			assert.ok(
				lines.some((l) => l.startsWith("└") && l.endsWith("┘")),
				"bottom border",
			);
		});

		it("places [text] right-anchored with >=1 dash on each side and keeps corners", () => {
			// 长内容 → 标签右锚:标签后恰 1 格 ─,左侧多余框线
			const long = renderCard("text", ["this is a longer content line"], 60).map(strip);
			const top = long[0];
			const tagIdx = top.indexOf("[text]");
			assert.ok(top.startsWith("┌") && top.endsWith("┐"), "corners kept");
			assert.ok(tagIdx > 1, `at least 1 dash before tag: ${top}`);
			assert.strictEqual(top.length - 1 - (tagIdx + 6), 1, `exactly 1 dash after tag: ${top}`);
		});

		it("styles the tag with cardLabel and borders with cardBorder (fallback identity when absent)", () => {
			const raw = renderCard("text", ["alpha"], 40);
			const topRaw = raw.find((l) => l.includes("┌"))!;
			// defaultMarkdownTheme:cardBorder=red,cardLabel=red → 标签与边框均红(槽位由独立测试用可区分主题验证)
			assert.ok(topRaw.includes("\x1b[31m[text]\x1b[39m"), `tag uses cardLabel: ${JSON.stringify(topRaw)}`);
			assert.ok(topRaw.includes("\x1b[2m┌"), "border uses cardBorder slot (dim)");
			// 无 cardBorder 的主题回落默认边框(identity),不崩溃
			const noBorderTheme = { ...defaultMarkdownTheme, cardBorder: undefined };
			const fallback = new Markdown(
				"<!--motto-card:tag-top-right-->\n| text |\n|---|\n| alpha |",
				0,
				0,
				noBorderTheme,
			).render(40);
			const fallbackTop = fallback.find((l) => l.includes("┌"))!;
			assert.ok(fallbackTop.includes("┌") && fallbackTop.includes("[text]"), "fallback still renders");
			assert.strictEqual(visibleWidth(fallbackTop), 40, "fallback still full width");
		});

		it("keeps top/body/bottom visible width identical", () => {
			for (const width of [40, 60, 80]) {
				const lines = cardLines(width);
				const widths = [...new Set(lines.map((l) => visibleWidth(l)))];
				assert.strictEqual(widths.length, 1, `width ${width} identical: ${widths}`);
			}
		});

		it("R2 full-width: every frame line visibleWidth === availableWidth at 40/60/80/120/200", () => {
			for (const width of [40, 60, 80, 120, 200]) {
				const lines = cardLines(width);
				const frame = lines.filter((l) => /^[┌│└]/.test(l));
				assert.ok(frame.length > 0, `width ${width}: card present`);
				for (const l of frame) {
					// 严格相等(非 ≤):top/body/bottom 逐列 = availableWidth
					assert.strictEqual(visibleWidth(l), width, `width ${width}: ${JSON.stringify(l)}`);
				}
				// [text] 右锚:标签后恰 1 格 ─,左右角保留
				const top = frame[0];
				const tagIdx = top.indexOf("[text]");
				assert.ok(top.startsWith("┌") && top.endsWith("┐"), "corners kept");
				assert.strictEqual(visibleWidth(top) - 1 - (tagIdx + 6), 1, `exactly 1 dash after tag: ${top}`);
			}
		});

		it("R2 full-width: short content 'a' stretches to 200 (not a natural-width small box)", () => {
			const lines = renderCard("text", ["a"], 200).map(strip);
			const top = lines[0];
			assert.strictEqual([...top].length, 200, `short content stretches to 200: ${top}`);
			assert.notStrictEqual(top, "┌─[text]─┐", "not the natural-width small box");
			assert.ok(top.startsWith("┌") && top.endsWith("─┐"), "right-anchored tag kept");
			// 内容按全宽 body 列宽正常折行
			const long = renderCard("text", ["this line is definitely longer than forty columns for sure"], 40).map(strip);
			const bodyRows = long.filter((l) => l.startsWith("│"));
			assert.ok(bodyRows.length >= 2, `long content wraps to multiple body rows: ${bodyRows.length}`);
			for (const l of bodyRows) {
				assert.strictEqual([...l].length, 40, "wrapped body rows still full width");
			}
		});

		it("R2 cardBorder: distinguishable theme — borders BORDER, tag LABEL, body plain, natural table untouched", () => {
			// cardLabel=red(\x1b[31m),cardBorder=dim(\x1b[2m),正文不包装 → 可区分槽位
			const theme = {
				...defaultMarkdownTheme,
				cardLabel: (t: string) => chalk.red(t),
				cardBorder: (t: string) => chalk.dim(t),
			};
			const raw = new Markdown("<!--motto-card:tag-top-right-->\n| text |\n|---|\n| alpha |", 0, 0, theme).render(
				40,
			);
			const top = raw[0];
			const body = raw[1];
			const bottom = raw[2];
			// top border:角与 ─ 为 BORDER(dim),标签为 LABEL(red)
			assert.ok(top.includes("\x1b[2m┌"), "top 角为 BORDER");
			assert.ok(top.includes("\x1b[2m─┐"), "top 右角为 BORDER");
			assert.ok(top.includes("\x1b[31m[text]\x1b[39m"), "标签为 LABEL");
			// body:左右 │ 为 BORDER,正文(alpha)不染色
			assert.ok(body.includes("\x1b[2m│ \x1b[22m"), "body 左 │ 为 BORDER");
			assert.ok(body.includes("\x1b[2m │\x1b[22m"), "body 右 │ 为 BORDER");
			const alphaSegment = body.split("\x1b[2m │")[0].split("\x1b[22m").at(-1) ?? "";
			assert.ok(alphaSegment.includes("alpha"), "body 文本存在");
			assert.ok(!body.includes("\x1b[31m"), "body 无 LABEL 染色");
			// bottom 为 BORDER
			assert.ok(bottom.includes("\x1b[2m└"), "bottom 为 BORDER");
			// ANSI 包装后 visibleWidth 仍等于 availableWidth
			assert.strictEqual(visibleWidth(top), 40);
			assert.strictEqual(visibleWidth(body), 40);
			assert.strictEqual(visibleWidth(bottom), 40);
			// 自然表格完全不消费 cardBorder
			const natRaw = new Markdown("| a | b |\n|---|---|\n| 1 | 2 |", 0, 0, theme).render(40);
			for (const l of natRaw) {
				assert.ok(!l.includes("\x1b[2m"), `natural table no cardBorder: ${JSON.stringify(l)}`);
			}
		});

		it("truncates long/CJK labels by visible width without breaking the frame", () => {
			const longTag = "超长标注".repeat(5); // 20 字 → 显示宽 40
			const lines = renderCard(longTag, ["a"], 40).map(strip);
			const top = lines[0];
			assert.ok(top.startsWith("┌") && top.endsWith("┐"), "corners kept after truncation");
			assert.ok(top.includes("…]"), "truncated with ellipsis before closing bracket");
			assert.ok(visibleWidth(top) <= 40, `no overflow: ${top} (${visibleWidth(top)})`);
			// 截断后 top/body/bottom 仍同宽
			const widths = [...new Set(lines.map((l) => visibleWidth(l)))];
			assert.strictEqual(widths.length, 1, `identical width after truncation: ${widths}`);
		});

		it("does not leak the marker comment into rendered output", () => {
			const lines = cardLines(80);
			assert.ok(!lines.some((l) => l.includes("motto-card")), "marker not rendered");
		});

		it("R2 block spacing: exactly one blank visual line around the card (paragraph/start/end/consecutive)", () => {
			const blankCount = (ls: string[], from: number, to: number) =>
				ls.slice(from, to).filter((l) => l.trimEnd() === "").length;
			// 1. paragraph → card → paragraph(带源空行):前后各恰一空行
			let lines = new Markdown(
				"正文段落\n\n<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 内容 |\n\n后续正文",
				0,
				0,
				defaultMarkdownTheme,
			)
				.render(60)
				.map(strip)
				.map((l) => l.trimEnd());
			let topIdx = lines.findIndex((l) => l.startsWith("┌"));
			assert.strictEqual(blankCount(lines, 0, topIdx), 1, "card leading blank");
			assert.strictEqual(blankCount(lines, topIdx + 3, lines.length), 1, "card trailing blank");
			// 2. 无显式空行邻接:渲染层(段落尾随空行)仍提供恰一空行
			lines = new Markdown(
				"正文段落\n<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 内容 |\n后续正文",
				0,
				0,
				defaultMarkdownTheme,
			)
				.render(60)
				.map(strip)
				.map((l) => l.trimEnd());
			topIdx = lines.findIndex((l) => l.startsWith("┌"));
			assert.strictEqual(blankCount(lines, 0, topIdx), 1, "no-blank leading");
			// 3. 多个源空行:marked 折叠为单空行,无 double gap
			lines = new Markdown(
				"正文段落\n\n\n<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 内容 |\n\n\n后续正文",
				0,
				0,
				defaultMarkdownTheme,
			)
				.render(60)
				.map(strip)
				.map((l) => l.trimEnd());
			topIdx = lines.findIndex((l) => l.startsWith("┌"));
			assert.strictEqual(blankCount(lines, 0, topIdx), 1, "multi source blank: leading single");
			assert.strictEqual(blankCount(lines, topIdx + 3, lines.length), 1, "multi source blank: trailing single");
			// 4. 卡在消息开头/结尾:无 leading/trailing blank
			lines = new Markdown(
				"<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 内容 |\n\n后续正文",
				0,
				0,
				defaultMarkdownTheme,
			)
				.render(60)
				.map(strip);
			assert.notStrictEqual(lines[0].trimEnd(), "", "no leading blank at message start");
			lines = new Markdown(
				"正文段落\n\n<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 内容 |",
				0,
				0,
				defaultMarkdownTheme,
			)
				.render(60)
				.map(strip);
			assert.notStrictEqual(lines.at(-1)?.trimEnd(), "", "no trailing blank at message end");
			// 5. 连续双卡(0/1 个源空行):块间恰一空行
			for (const sep of ["\n", "\n\n"]) {
				lines = new Markdown(
					`<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 甲 |${sep}<!--motto-card:tag-top-right-->\n| text |\n|---|\n| 乙 |`,
					0,
					0,
					defaultMarkdownTheme,
				)
					.render(60)
					.map(strip)
					.map((l) => l.trimEnd());
				topIdx = lines.findIndex((l) => l.startsWith("┌"));
				const secondTop = lines.findIndex((l, i) => i > topIdx && l.startsWith("┌"));
				assert.strictEqual(
					blankCount(lines, topIdx + 3, secondTop),
					1,
					`consecutive cards single gap (sep=${JSON.stringify(sep)})`,
				);
			}
		});

		it("keeps box-outside tag mode for motto-card:tag (bash) unchanged", () => {
			const src = "<!--motto-card:tag-->\n| bash |\n|---|\n| cd ~ |";
			const lines = new Markdown(src, 0, 0, defaultMarkdownTheme).render(80).map((l) => l.trimEnd());
			const plain = lines.map(strip);
			// 盒外独立 [bash] 行 + 上边框
			assert.ok(
				plain.some((l) => l.trim() === "[bash]"),
				"box-outside [bash] label kept",
			);
			assert.ok(
				plain.some((l) => l.startsWith("┌─") && l.endsWith("─┐")),
				"top border separate",
			);
		});

		it("keeps bare-card and natural-table rendering unchanged", () => {
			const bare = new Markdown("<!--motto-card-->\n| 标题 |\n|---|\n| 内容 |", 0, 0, defaultMarkdownTheme)
				.render(80)
				.map((l) => l.trimEnd())
				.map(strip);
			assert.ok(
				bare.some((l) => l.includes("│ 标题")),
				"bare card header inside box",
			);
			assert.ok(!bare.some((l) => l.trim() === "[标题]"), "bare card has no box-outside label");

			const natural = new Markdown("| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |", 0, 0, defaultMarkdownTheme)
				.render(80)
				.map((l) => l.trimEnd())
				.map(strip);
			const separators = natural.filter((l) => l.includes("├─"));
			assert.ok(separators.length >= 2, `natural table keeps separators: ${separators.length}`);
		});
	});

	describe("Combined features", () => {
		it("should render lists and tables together", () => {
			const markdown = new Markdown(
				`# Test Document

- Item 1
  - Nested item
- Item 2

| Col1 | Col2 |
| --- | --- |
| A | B |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check heading
			assert.ok(plainLines.some((line) => line.includes("Test Document")));
			// Check list
			assert.ok(plainLines.some((line) => line.includes("- Item 1")));
			assert.ok(plainLines.some((line) => line.includes("    - Nested item")));
			// Check table
			assert.ok(plainLines.some((line) => line.includes("Col1")));
			assert.ok(plainLines.some((line) => line.includes("│")));
		});
	});

	describe("LaTeX math", () => {
		it("renders inline dollar and parenthesis delimiters", () => {
			const markdown = new Markdown(
				String.raw`A map $\mathbb{C}^3 \to \mathbb{C}^3$, $xy$, $x-y$, $-x$, $\frac{1}{2}$, and \(s \to \infty\).`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["A map ℂ³ → ℂ³, xy, x-y, -x, 1/2, and s → ∞."]);
		});

		it("renders display dollar delimiters without Markdown escape corruption", () => {
			const markdown = new Markdown(
				String.raw`Before

$$\{3x+2y,\; x \in \{0, \pm 1\}\}$$

after`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["Before", "", "{3x+2y, x ∈ {0, ± 1}}", "", "after"]);
		});

		it("renders display bracket delimiters", () => {
			const markdown = new Markdown(
				String.raw`Before

\[
E \approx \frac{0.1\ \text{lux}}{100\ \text{lm/W}}
\]

after`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["Before", "", "    0.1 lux", "E ≈ ────────", "    100 lm/W", "", "after"]);
		});

		it("aligns matrix rows with the opening delimiter", () => {
			const markdown = new Markdown(
				String.raw`Consider the matrix

\[
A=
\begin{pmatrix}
\pi & 0\\
0 & \frac{1}{\pi}
\end{pmatrix}.
\]`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["Consider the matrix", "", "A = ⎛ π │ 0   ⎞", "    ⎝ 0 │ 1/π ⎠."]);
		});

		it("renders lower limits beneath display operators", () => {
			const markdown = new Markdown(
				String.raw`\[
\lim_{x\to 0}\frac{\frac{\sin x}{x}-1}{\frac{e^x-1}{x}-1}=0
\]`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["     (sin x)/x-1", "lim  ─────────── = 0", "x→0  (eˣ-1)/x-1"]);
		});

		it("renders math inside lists and tables", () => {
			const markdown = new Markdown(
				String.raw`- Formula: $F_1 = u^2$

| Value |
| --- |
| $\mathbb{C}^3$ |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());
			const output = lines.join("\n");

			assert.ok(output.includes("- Formula: F₁ = u²"));
			assert.ok(output.includes("│ ℂ³"));
		});

		it("does not treat currency, shell variables, or code spans as math", () => {
			const source = "Costs $5 and $10 or $8k–$12k; use `$x$`, $HOME, and $" + "{PATH}.";
			const markdown = new Markdown(source, 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["Costs $5 and $10 or $8k–$12k; use $x$, $HOME, and $" + "{PATH}."]);

			const shellVariables = "Paths: $HOME/$USER and $XDG_CONFIG_HOME/$APP_CONFIG";
			const shellLines = new Markdown(shellVariables, 0, 0, defaultMarkdownTheme)
				.render(80)
				.map((line) => stripAnsi(line).trimEnd());
			assert.deepStrictEqual(shellLines, [shellVariables]);
		});

		it("preserves unsupported and incomplete LaTeX exactly", () => {
			const cases = [String.raw`Unknown $x + \unknown{y}$ after`, String.raw`Streaming $\mathbb{C}^3`];

			for (const source of cases) {
				const markdown = new Markdown(source, 0, 0, defaultMarkdownTheme);
				const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());
				assert.deepStrictEqual(lines, [source]);
			}
		});

		it("preserves incomplete backslash delimiters while streaming", () => {
			const inline = new Markdown(String.raw`Map \(\mathbb{C}^3`, 0, 0, defaultMarkdownTheme);
			assert.deepStrictEqual(
				inline.render(80).map((line) => stripAnsi(line).trimEnd()),
				[String.raw`Map \(\mathbb{C}^3`],
			);

			const display = new Markdown("\\[\nx^2", 0, 0, defaultMarkdownTheme);
			assert.deepStrictEqual(
				display.render(80).map((line) => stripAnsi(line).trimEnd()),
				["\\[", "x^2"],
			);
		});

		it("does not render LaTeX inside escaped delimiters or code fences", () => {
			const source = [String.raw`Escaped \$x-y\$.`, "", "```text", String.raw`$\mathbb{C}^3$`, "```"].join("\n");
			const markdown = new Markdown(source, 0, 0, defaultMarkdownTheme);
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["Escaped $x-y$.", "", "```text", "  $\\mathbb{C}^3$", "```"]);
		});

		it("allows LaTeX rendering to be disabled", () => {
			const markdown = new Markdown(
				String.raw`Map $\mathbb{C}^3 \to \mathbb{C}^3$`,
				0,
				0,
				defaultMarkdownTheme,
				undefined,
				{
					renderLatex: false,
				},
			);

			assert.deepStrictEqual(
				markdown.render(80).map((line) => stripAnsi(line).trimEnd()),
				[String.raw`Map $\mathbb{C}^3 \to \mathbb{C}^3$`],
			);
		});

		it("switches from raw to rendered math when a streamed delimiter closes", () => {
			const markdown = new Markdown(String.raw`Map $\mathbb{C}^3`, 0, 0, defaultMarkdownTheme);
			assert.deepStrictEqual(
				markdown.render(80).map((line) => stripAnsi(line).trimEnd()),
				[String.raw`Map $\mathbb{C}^3`],
			);

			markdown.setText(String.raw`Map $\mathbb{C}^3$`);

			assert.deepStrictEqual(
				markdown.render(80).map((line) => stripAnsi(line).trimEnd()),
				["Map ℂ³"],
			);
		});
	});

	describe("Backslash escapes", () => {
		it("should normalize escaped punctuation by default", () => {
			const markdown = new Markdown(String.raw`"\"`, 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [`""`]);
		});

		it("should preserve source backslash escapes when configured", () => {
			const markdown = new Markdown(String.raw`"\"`, 0, 0, defaultMarkdownTheme, undefined, {
				preserveBackslashEscapes: true,
			});

			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [String.raw`"\"`]);
		});
	});

	describe("Pre-styled text (thinking traces)", () => {
		it("should preserve gray italic styling after inline code", () => {
			// This replicates how thinking content is rendered in assistant-message.ts
			const markdown = new Markdown(
				"This is thinking with `inline code` and more text after",
				1,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.gray(text),
					italic: true,
				},
			);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");

			// Should contain the inline code block
			assert.ok(joinedOutput.includes("inline code"));

			// The output should have ANSI codes for gray (90) and italic (3)
			assert.ok(joinedOutput.includes("\x1b[90m"), "Should have gray color code");
			assert.ok(joinedOutput.includes("\x1b[3m"), "Should have italic code");

			// Verify that inline code is styled (theme uses yellow)
			const hasCodeColor = joinedOutput.includes("\x1b[33m");
			assert.ok(hasCodeColor, "Should style inline code");
		});

		it("should preserve gray italic styling after bold text", () => {
			const markdown = new Markdown(
				"This is thinking with **bold text** and more after",
				1,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.gray(text),
					italic: true,
				},
			);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");

			// Should contain bold text
			assert.ok(joinedOutput.includes("bold text"));

			// The output should have ANSI codes for gray (90) and italic (3)
			assert.ok(joinedOutput.includes("\x1b[90m"), "Should have gray color code");
			assert.ok(joinedOutput.includes("\x1b[3m"), "Should have italic code");

			// Should have bold codes (1 or 22 for bold on/off)
			assert.ok(joinedOutput.includes("\x1b[1m"), "Should have bold code");
		});

		it("should not leak styles into following lines when rendered in TUI", async () => {
			class MarkdownWithInput implements Component {
				public markdownLineCount = 0;
				private readonly markdown: Markdown;

				constructor(markdown: Markdown) {
					this.markdown = markdown;
				}

				render(width: number): string[] {
					const lines = this.markdown.render(width);
					this.markdownLineCount = lines.length;
					return [...lines, "INPUT"];
				}

				invalidate(): void {
					this.markdown.invalidate();
				}
			}

			const markdown = new Markdown("This is thinking with `inline code`", 1, 0, defaultMarkdownTheme, {
				color: (text) => chalk.gray(text),
				italic: true,
			});

			const terminal = new VirtualTerminal(80, 6);
			const tui: TUI = new TuiMainScreen(terminal);
			const component = new MarkdownWithInput(markdown);
			tui.addChild(component);
			tui.start();
			await terminal.waitForRender();

			assert.ok(component.markdownLineCount > 0);
			const inputRow = component.markdownLineCount;
			assert.strictEqual(getCellItalic(terminal, inputRow, 0), 0);
			tui.stop();
		});
	});

	describe("Spacing after code blocks", () => {
		it("should have only one blank line between code block and following paragraph", () => {
			const markdown = new Markdown(
				`hello world

\`\`\`js
const hello = "world";
\`\`\`

again, hello world`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			const closingBackticksIndex = plainLines.indexOf("```");
			assert.ok(closingBackticksIndex !== -1, "Should have closing backticks");

			const afterBackticks = plainLines.slice(closingBackticksIndex + 1);
			const emptyLineCount = afterBackticks.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after code block, but found ${emptyLineCount}. Lines after backticks: ${JSON.stringify(afterBackticks.slice(0, 5))}`,
			);
		});

		it("should normalize paragraph and code block spacing to one blank line", () => {
			const cases = [
				`hello this is text
\`\`\`
code block
\`\`\`
more text`,
				`hello this is text

\`\`\`
code block
\`\`\`

more text`,
			];
			const expectedLines = ["hello this is text", "", "```", "  code block", "```", "", "more text"];

			for (const text of cases) {
				const markdown = new Markdown(text, 0, 0, defaultMarkdownTheme);
				const lines = markdown.render(80);
				const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

				assert.deepStrictEqual(
					plainLines,
					expectedLines,
					`Unexpected spacing for markdown: ${JSON.stringify(text)}`,
				);
			}
		});

		it("should not add a trailing blank line when code block is the last rendered block", () => {
			const cases = ["```js\nconst hello = 'world';\n```", "hello world\n\n```js\nconst hello = 'world';\n```"];

			for (const text of cases) {
				const markdown = new Markdown(text, 0, 0, defaultMarkdownTheme);
				const lines = markdown.render(80);
				const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

				assert.notStrictEqual(
					plainLines.at(-1),
					"",
					`Expected code block to end without a blank line: ${JSON.stringify(plainLines)}`,
				);
			}
		});
	});

	describe("Spacing after dividers", () => {
		it("should have only one blank line between divider and following paragraph", () => {
			const markdown = new Markdown(
				`hello world

---

again, hello world`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			const dividerIndex = plainLines.findIndex((line) => line.includes("─"));
			assert.ok(dividerIndex !== -1, "Should have divider");

			const afterDivider = plainLines.slice(dividerIndex + 1);
			const emptyLineCount = afterDivider.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after divider, but found ${emptyLineCount}. Lines after divider: ${JSON.stringify(afterDivider.slice(0, 5))}`,
			);
		});

		it("should not add a trailing blank line when divider is the last rendered block", () => {
			const markdown = new Markdown("---", 0, 0, defaultMarkdownTheme);
			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected divider to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Spacing after headings", () => {
		it("should have only one blank line between heading and following paragraph", () => {
			const markdown = new Markdown(
				`# Hello

This is a paragraph`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			const headingIndex = plainLines.findIndex((line) => line.includes("Hello"));
			assert.ok(headingIndex !== -1, "Should have heading");

			const afterHeading = plainLines.slice(headingIndex + 1);
			const emptyLineCount = afterHeading.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after heading, but found ${emptyLineCount}. Lines after heading: ${JSON.stringify(afterHeading.slice(0, 5))}`,
			);
		});

		it("should not add a trailing blank line when heading is the last rendered block", () => {
			const markdown = new Markdown("# Hello", 0, 0, defaultMarkdownTheme);
			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected heading to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Spacing after blockquotes", () => {
		it("should have only one blank line between blockquote and following paragraph", () => {
			const markdown = new Markdown(
				`hello world

> This is a quote

again, hello world`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			const quoteIndex = plainLines.findIndex((line) => line.includes("This is a quote"));
			assert.ok(quoteIndex !== -1, "Should have blockquote");

			const afterQuote = plainLines.slice(quoteIndex + 1);
			const emptyLineCount = afterQuote.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after blockquote, but found ${emptyLineCount}. Lines after quote: ${JSON.stringify(afterQuote.slice(0, 5))}`,
			);
		});

		it("should not add a trailing blank line when blockquote is the last rendered block", () => {
			const markdown = new Markdown("> This is a quote", 0, 0, defaultMarkdownTheme);
			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected blockquote to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Blockquotes with multiline content", () => {
		it("should apply consistent styling to all lines in lazy continuation blockquote", () => {
			// Markdown "lazy continuation" - second line without > is still part of the quote
			const markdown = new Markdown(
				`>Foo
bar`,
				0,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.magenta(text), // This should NOT be applied to blockquotes
				},
			);

			const lines = markdown.render(80);

			// Both lines should have the quote border
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const quotedLines = plainLines.filter((line) => line.startsWith("│ "));
			assert.strictEqual(quotedLines.length, 2, `Expected 2 quoted lines, got: ${JSON.stringify(plainLines)}`);

			// Both lines should have italic (from theme.quote styling)
			const fooLine = lines.find((line) => line.includes("Foo"));
			const barLine = lines.find((line) => line.includes("bar"));
			assert.ok(fooLine, "Should have Foo line");
			assert.ok(barLine, "Should have bar line");

			// Check that both have italic (\x1b[3m) - blockquotes use theme styling, not default message color
			assert.ok(fooLine?.includes("\x1b[3m"), `Foo line should have italic: ${fooLine}`);
			assert.ok(barLine?.includes("\x1b[3m"), `bar line should have italic: ${barLine}`);

			// Blockquotes should NOT have the default message color (magenta)
			assert.ok(!fooLine?.includes("\x1b[35m"), `Foo line should NOT have magenta color: ${fooLine}`);
			assert.ok(!barLine?.includes("\x1b[35m"), `bar line should NOT have magenta color: ${barLine}`);
		});

		it("should apply consistent styling to explicit multiline blockquote", () => {
			const markdown = new Markdown(
				`>Foo
>bar`,
				0,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.cyan(text), // This should NOT be applied to blockquotes
				},
			);

			const lines = markdown.render(80);

			// Both lines should have the quote border
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const quotedLines = plainLines.filter((line) => line.startsWith("│ "));
			assert.strictEqual(quotedLines.length, 2, `Expected 2 quoted lines, got: ${JSON.stringify(plainLines)}`);

			// Both lines should have italic (from theme.quote styling)
			const fooLine = lines.find((line) => line.includes("Foo"));
			const barLine = lines.find((line) => line.includes("bar"));
			assert.ok(fooLine?.includes("\x1b[3m"), `Foo line should have italic: ${fooLine}`);
			assert.ok(barLine?.includes("\x1b[3m"), `bar line should have italic: ${barLine}`);

			// Blockquotes should NOT have the default message color (cyan)
			assert.ok(!fooLine?.includes("\x1b[36m"), `Foo line should NOT have cyan color: ${fooLine}`);
			assert.ok(!barLine?.includes("\x1b[36m"), `bar line should NOT have cyan color: ${barLine}`);
		});

		it("should render list content inside blockquotes", () => {
			const markdown = new Markdown(
				`> 1. bla bla
> - nested bullet`,
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const quotedLines = plainLines.filter((line) => line.startsWith("│ "));

			assert.ok(
				quotedLines.some((line) => line.includes("1. bla bla")),
				`Missing ordered list item: ${JSON.stringify(quotedLines)}`,
			);
			assert.ok(
				quotedLines.some((line) => line.includes("- nested bullet")),
				`Missing unordered list item: ${JSON.stringify(quotedLines)}`,
			);
		});

		it("should wrap long blockquote lines and add border to each wrapped line", () => {
			const longText = "This is a very long blockquote line that should wrap to multiple lines when rendered";
			const markdown = new Markdown(`> ${longText}`, 0, 0, defaultMarkdownTheme);

			// Render at narrow width to force wrapping
			const lines = markdown.render(30);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Filter to non-empty lines (exclude trailing blank line after blockquote)
			const contentLines = plainLines.filter((line) => line.length > 0);

			// Should have multiple lines due to wrapping
			assert.ok(contentLines.length > 1, `Expected multiple wrapped lines, got: ${JSON.stringify(contentLines)}`);

			// Every content line should start with the quote border
			for (const line of contentLines) {
				assert.ok(line.startsWith("│ "), `Wrapped line should have quote border: "${line}"`);
			}

			// All content should be preserved
			const allText = contentLines.join(" ");
			assert.ok(allText.includes("very long"), "Should preserve 'very long'");
			assert.ok(allText.includes("blockquote"), "Should preserve 'blockquote'");
			assert.ok(allText.includes("multiple"), "Should preserve 'multiple'");
		});

		it("should properly indent wrapped blockquote lines with styling", () => {
			const markdown = new Markdown(
				"> This is styled text that is long enough to wrap",
				0,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.yellow(text), // This should NOT be applied to blockquotes
					italic: true,
				},
			);

			const lines = markdown.render(25);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Filter to non-empty lines
			const contentLines = plainLines.filter((line) => line.length > 0);

			// All lines should have the quote border
			for (const line of contentLines) {
				assert.ok(line.startsWith("│ "), `Line should have quote border: "${line}"`);
			}

			// Check that italic is applied (from theme.quote)
			const allOutput = lines.join("\n");
			assert.ok(allOutput.includes("\x1b[3m"), "Should have italic");

			// Blockquotes should NOT have the default message color (yellow)
			assert.ok(!allOutput.includes("\x1b[33m"), "Should NOT have yellow color from default style");
		});

		it("should render inline formatting inside blockquotes and reapply quote styling after", () => {
			const markdown = new Markdown("> Quote with **bold** and `code`", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Should have the quote border
			assert.ok(
				plainLines.some((line) => line.startsWith("│ ")),
				"Should have quote border",
			);

			// Content should be preserved
			const allPlain = plainLines.join(" ");
			assert.ok(allPlain.includes("Quote with"), "Should preserve 'Quote with'");
			assert.ok(allPlain.includes("bold"), "Should preserve 'bold'");
			assert.ok(allPlain.includes("code"), "Should preserve 'code'");

			const allOutput = lines.join("\n");

			// Should have bold styling (\x1b[1m)
			assert.ok(allOutput.includes("\x1b[1m"), "Should have bold styling");

			// Should have code styling (yellow = \x1b[33m from defaultMarkdownTheme)
			assert.ok(allOutput.includes("\x1b[33m"), "Should have code styling (yellow)");

			// Should have italic from quote styling (\x1b[3m)
			assert.ok(allOutput.includes("\x1b[3m"), "Should have italic from quote styling");
		});
	});

	describe("Heading with inline code", () => {
		it("should preserve heading styling after inline code", () => {
			const markdown = new Markdown("### Why `sourceInfo` should not be optional", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");

			// The heading theme is bold+cyan. After the yellow inline code, the heading
			// styling (bold+cyan) must be restored so subsequent text is styled correctly.
			// bold = \x1b[1m, cyan = \x1b[36m, yellow = \x1b[33m
			assert.ok(joinedOutput.includes("\x1b[33m"), "Should have yellow for inline code");

			// Find the position of "should not be optional" in the raw output.
			// It must be preceded by heading style codes (bold+cyan), not appear unstyled.
			const afterCodeIndex = joinedOutput.indexOf("should not be optional");
			assert.ok(afterCodeIndex > 0, "Should contain text after inline code");

			// Look at the ANSI codes between the code span end and "should not be optional".
			// There should be bold (\x1b[1m) and cyan (\x1b[36m) re-applied.
			const precedingChunk = joinedOutput.slice(Math.max(0, afterCodeIndex - 40), afterCodeIndex);
			assert.ok(
				precedingChunk.includes("\x1b[1m"),
				`Should re-apply bold before text after code: ${precedingChunk}`,
			);
			assert.ok(
				precedingChunk.includes("\x1b[36m"),
				`Should re-apply cyan before text after code: ${precedingChunk}`,
			);
		});

		it("should preserve heading styling after inline code for h1", () => {
			const markdown = new Markdown("# Title with `code` inside", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");

			const afterCodeIndex = joinedOutput.indexOf("inside");
			assert.ok(afterCodeIndex > 0, "Should contain text after inline code");

			const precedingChunk = joinedOutput.slice(Math.max(0, afterCodeIndex - 40), afterCodeIndex);
			// H1 uses heading + bold + underline
			assert.ok(precedingChunk.includes("\x1b[1m"), `Should re-apply bold for h1: ${precedingChunk}`);
			assert.ok(precedingChunk.includes("\x1b[36m"), `Should re-apply cyan for h1: ${precedingChunk}`);
			assert.ok(precedingChunk.includes("\x1b[4m"), `Should re-apply underline for h1: ${precedingChunk}`);
		});

		it("should not leak h1 underline into padding when inline code is the last token", async () => {
			const markdown = new Markdown("# Important distinction from `open()`", 0, 0, defaultMarkdownTheme);
			const terminal = new VirtualTerminal(80, 4);
			const tui: TUI = new TuiMainScreen(terminal);
			tui.addChild(markdown);
			tui.start();
			await terminal.waitForRender();

			const renderedLine = markdown.render(80)[0];
			assert.ok(renderedLine, "Should render heading line");
			const contentWidth = renderedLine.replace(/\x1b\[[0-9;]*m/g, "").trimEnd().length;
			assert.ok(contentWidth > 0, "Should have visible heading content");

			for (let col = contentWidth; col < 80; col++) {
				assert.strictEqual(getCellUnderline(terminal, 0, col), 0, `Expected no underline in padding at col ${col}`);
			}

			tui.stop();
		});

		it("should preserve heading styling after bold text", () => {
			const markdown = new Markdown("## Heading with **bold** and more", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");

			const afterBoldIndex = joinedOutput.indexOf("and more");
			assert.ok(afterBoldIndex > 0, "Should contain text after bold");

			const precedingChunk = joinedOutput.slice(Math.max(0, afterBoldIndex - 40), afterBoldIndex);
			assert.ok(precedingChunk.includes("\x1b[1m"), `Should re-apply bold for h2: ${precedingChunk}`);
			assert.ok(precedingChunk.includes("\x1b[36m"), `Should re-apply cyan for h2: ${precedingChunk}`);
		});
	});

	describe("Strikethrough syntax", () => {
		it("should render ~~text~~ as strikethrough", () => {
			const markdown = new Markdown("Use ~~strikethrough~~ here", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");
			const joinedPlain = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "")).join(" ");

			assert.ok(joinedOutput.includes("\x1b[9m"), "Should apply strikethrough styling");
			assert.ok(joinedPlain.includes("strikethrough"), "Should include struck text content");
			assert.ok(!joinedPlain.includes("~~strikethrough~~"), "Should not render delimiters as text");
		});

		it("should keep ~text~ as plain text", () => {
			const markdown = new Markdown("Use ~strikethrough~ literally", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joinedOutput = lines.join("\n");
			const joinedPlain = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "")).join(" ");

			assert.ok(joinedPlain.includes("~strikethrough~"), "Single-tilde delimiters should remain visible");
			assert.ok(!joinedOutput.includes("\x1b[9m"), "Single-tilde text should not use strikethrough styling");
		});
	});

	describe("Links", () => {
		afterEach(() => {
			resetCapabilitiesCache();
		});

		it("should not duplicate URL for autolinked emails", () => {
			// Hyperlinks capability does not affect the mailto: display check.
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			const markdown = new Markdown("Contact user@example.com for help", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const joinedPlain = plainLines.join(" ");

			// Should contain the email once, not duplicated with mailto:
			assert.ok(joinedPlain.includes("user@example.com"), "Should contain email");
			assert.ok(!joinedPlain.includes("mailto:"), "Should not show mailto: prefix for autolinked emails");
		});

		it("should not duplicate URL for bare URLs", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			const markdown = new Markdown("Visit https://example.com for more", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const joinedPlain = plainLines.join(" ");

			// URL should appear only once
			const urlCount = (joinedPlain.match(/https:\/\/example\.com/g) || []).length;
			assert.strictEqual(urlCount, 1, "URL should appear exactly once");
		});

		it("should show URL in parentheses when hyperlinks are not supported", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			const markdown = new Markdown("[click here](https://example.com)", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const joinedPlain = plainLines.join(" ");

			assert.ok(joinedPlain.includes("click here"), "Should contain link text");
			assert.ok(joinedPlain.includes("(https://example.com)"), "Should show URL in parentheses");
		});

		it("should show mailto URL in parentheses when hyperlinks are not supported", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			const markdown = new Markdown("[Email me](mailto:test@example.com)", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const joinedPlain = plainLines.join(" ");

			assert.ok(joinedPlain.includes("Email me"), "Should contain link text");
			assert.ok(joinedPlain.includes("(mailto:test@example.com)"), "Should show mailto URL in parentheses");
		});

		it("should emit OSC 8 hyperlink sequence when terminal supports hyperlinks", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: true });
			const markdown = new Markdown("[click here](https://example.com)", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joined = lines.join("");

			// OSC 8 open: ESC ] 8 ; ; <url> ESC \
			assert.ok(joined.includes("\x1b]8;;https://example.com\x1b\\"), "Should contain OSC 8 open sequence");
			// OSC 8 close: ESC ] 8 ; ; ESC \
			assert.ok(joined.includes("\x1b]8;;\x1b\\"), "Should contain OSC 8 close sequence");
			// Visible text is present
			const plainLines = lines.map((line) => line.replace(/\x1b[^a-zA-Z]*[a-zA-Z]|\x1b\].*?\x1b\\/g, ""));
			assert.ok(plainLines.join("").includes("click here"), "Should contain link text");
			// URL is NOT printed inline as plain text
			const rawPlain = lines.map((line) =>
				line.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, ""),
			);
			assert.ok(!rawPlain.join("").includes("(https://example.com)"), "URL should not appear inline in parentheses");
		});

		it("should use OSC 8 for mailto links when terminal supports hyperlinks", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: true });
			const markdown = new Markdown("[Email me](mailto:test@example.com)", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joined = lines.join("");

			assert.ok(
				joined.includes("\x1b]8;;mailto:test@example.com\x1b\\"),
				"Should contain OSC 8 open with mailto URL",
			);
			assert.ok(joined.includes("\x1b]8;;\x1b\\"), "Should contain OSC 8 close sequence");
		});

		it("should use OSC 8 for bare URLs when terminal supports hyperlinks", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: true });
			const markdown = new Markdown("Visit https://example.com for more", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const joined = lines.join("");

			assert.ok(joined.includes("\x1b]8;;https://example.com\x1b\\"), "Should contain OSC 8 hyperlink");
			// URL should not also appear as raw parenthetical text
			const rawPlain = lines.map((line) =>
				line.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, ""),
			);
			assert.ok(!rawPlain.join("").includes("(https://example.com)"), "URL should not appear twice");
		});
	});

	describe("HTML-like tags in text", () => {
		it("should render content with HTML-like tags as text", () => {
			// When the model emits something like <thinking>content</thinking> in regular text,
			// marked might treat it as HTML and hide the content
			const markdown = new Markdown(
				"This is text with <thinking>hidden content</thinking> that should be visible",
				0,
				0,
				defaultMarkdownTheme,
			);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const joinedPlain = plainLines.join(" ");

			// The content inside the tags should be visible
			assert.ok(
				joinedPlain.includes("hidden content") || joinedPlain.includes("<thinking>"),
				"Should render HTML-like tags or their content as text, not hide them",
			);
		});

		it("should render HTML tags in code blocks correctly", () => {
			const markdown = new Markdown("```html\n<div>Some HTML</div>\n```", 0, 0, defaultMarkdownTheme);

			const lines = markdown.render(80);
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			const joinedPlain = plainLines.join("\n");

			// HTML in code blocks should be visible
			assert.ok(
				joinedPlain.includes("<div>") && joinedPlain.includes("</div>"),
				"Should render HTML in code blocks",
			);
		});
	});

	describe("Streaming code fences", () => {
		it("stabilizes partial closing fence rendering", () => {
			const cases = [
				{
					input: "```ts\nconst x = 1;\n``",
					expected: ["```ts", "  const x = 1;", "```"],
				},
				{
					input: "```md\nnot a closing fence:\n``\n```",
					expected: ["```md", "  not a closing fence:", "  ``", "```"],
				},
				{
					input: "```ts\n``",
					expected: ["```ts", "", "```"],
				},
				{
					input: "````\n```",
					expected: ["```", "", "```"],
				},
				{
					input: "~~~~~\n~~~~",
					expected: ["```", "", "```"],
				},
				{
					input: "```md\nnot a closing fence:\n``\n```\n\nafter",
					expected: ["```md", "  not a closing fence:", "  ``", "```", "", "after"],
				},
			];

			for (const { input, expected } of cases) {
				const markdown = new Markdown(input, 0, 0, defaultMarkdownTheme);
				const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

				assert.deepStrictEqual(lines, expected);
			}

			const partial = new Markdown("```ts\nconst x = 1;\n``", 0, 0, defaultMarkdownTheme);
			const complete = new Markdown("```ts\nconst x = 1;\n```", 0, 0, defaultMarkdownTheme);

			assert.strictEqual(partial.render(80).length, complete.render(80).length);
		});
	});
});
