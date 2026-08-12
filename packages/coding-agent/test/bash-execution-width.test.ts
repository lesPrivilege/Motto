/**
 * Test that BashExecutionComponent's collapsed output respects the render-time width,
 * not a stale captured width. Regression test for #2569.
 */
import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import { BashExecutionComponent } from "../src/modes/interactive/components/bash-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

/** Minimal TUI stub that only exposes terminal.columns */
function createTuiStub(columns: number): { columns: number; stub: any } {
	const state = { columns };
	const stub = {
		terminal: {
			get columns() {
				return state.columns;
			},
			get rows() {
				return 24;
			},
		},
		// Loader calls ui.addInterval / ui.removeInterval
		addInterval: (_cb: () => void, _ms: number) => ({ dispose: () => {} }),
		removeInterval: () => {},
		requestRender: () => {},
	};
	return { columns: state.columns, stub };
}

describe("BashExecutionComponent width handling (#2569)", () => {
	beforeAll(() => {
		initTheme(undefined, false);
	});

	it("collapsed preview lines respect render-time width, not construction-time width", () => {
		const wideWidth = 200;
		const narrowWidth = 80;

		const { stub } = createTuiStub(wideWidth);
		const component = new BashExecutionComponent("pwd", stub);

		// Add output with long lines that will wrap differently at different widths
		const longLine = "x".repeat(150);
		component.appendOutput(`${longLine}\n${longLine}\n`);

		// Complete the command so it enters collapsed mode
		component.setComplete(0, false);

		// Render at the narrow width (simulating a resize or split pane)
		const lines = component.render(narrowWidth);

		// Every rendered line must fit within the narrow width
		for (let i = 0; i < lines.length; i++) {
			const w = visibleWidth(lines[i]);
			expect(w, `Line ${i} visibleWidth=${w} > ${narrowWidth}`).toBeLessThanOrEqual(narrowWidth);
		}
	});

	it("re-computes lines when width changes between renders", () => {
		const { stub } = createTuiStub(200);
		const component = new BashExecutionComponent("echo hello", stub);

		const longLine = "abcdefghij".repeat(20); // 200 chars
		component.appendOutput(`${longLine}\n`);
		component.setComplete(0, false);

		// First render at width 200
		const lines200 = component.render(200);
		for (const line of lines200) {
			expect(visibleWidth(line)).toBeLessThanOrEqual(200);
		}

		// Second render at width 60 (split pane scenario)
		const lines60 = component.render(60);
		for (let i = 0; i < lines60.length; i++) {
			const w = visibleWidth(lines60[i]);
			expect(w, `Line ${i} visibleWidth=${w} > 60`).toBeLessThanOrEqual(60);
		}
	});

	// review-flow A1:未展开时输出只露有界尾部预览(3–5 行 tail,借鉴 Codex 5 行 / Reasonix tail),
	// 不全量铺屏;展开态(Ctrl+O / app.tools.expand)看全量。`!!` 属用户主动操作,不收敛为 index 行。
	it("keeps a bounded tail preview of 5 lines when not expanded", () => {
		const { stub } = createTuiStub(80);
		const component = new BashExecutionComponent("git status --short", stub, true);
		const lines = Array.from({ length: 30 }, (_, i) => `output-${i + 1}`);
		component.appendOutput(lines.join("\n"));
		component.setComplete(0, false);

		const out = stripAnsi(component.render(80).join("\n"));
		expect(out).toContain("output-26");
		expect(out).toContain("output-30");
		expect(out).not.toContain("output-25");
		expect(out).not.toContain("output-1");
		expect(out).toContain("25 more lines");
	});

	it("shows a bounded tail preview while streaming (running)", () => {
		const { stub } = createTuiStub(80);
		const component = new BashExecutionComponent("git status --short", stub, true);
		const lines = Array.from({ length: 30 }, (_, i) => `output-${i + 1}`);
		component.appendOutput(lines.join("\n"));

		const out = stripAnsi(component.render(80).join("\n"));
		expect(out).toContain("output-30");
		expect(out).not.toContain("output-1");
		expect(out).not.toContain("output-25");
	});

	it("expanded view shows the full output", () => {
		const { stub } = createTuiStub(80);
		const component = new BashExecutionComponent("git status --short", stub, true);
		const lines = Array.from({ length: 30 }, (_, i) => `output-${i + 1}`);
		component.appendOutput(lines.join("\n"));
		component.setComplete(0, false);
		component.setExpanded(true);

		const out = stripAnsi(component.render(80).join("\n"));
		expect(out).toContain("output-1");
		expect(out).toContain("output-30");
	});
});
