// thinking-fold-no-pollution.test.ts — T2 验收门:NO_SESSION_POLLUTION 显式断言。
//
// 工单 §3 语义:「fold 状态不写入 session 文件(appendCustomEntry 之外零新增写)、
// 不入模型上下文(对 fixture 会话做 resume/export 断言)」。
//
// 采用 test/interactive-tui.test.ts 同款原型级 harness:不实例化 InteractiveMode,
// 以 Object.create(InteractiveMode.prototype) 上下文直调私有 handler(TS private 仅
// 编译期;运行时为普通原型方法)。对假 session manager 上 spy 写路径与读路径,
// 再断言 fold 循环前后 fixture 会话逐字节不变 + 序列化无 fold 态/entryId 泄漏。
//
// 覆盖:
//   - handleThinkingFocus / handleThinkingFold 全程零 session 读/写;
//   - getThinkingEntryFoldState 只读纯内存 map(缺省 collapsed,零副作用);
//   - recordThinkingFoldStates 幂等回归(重叠/重复 entryIds 不重复入序、不腐蚀 map),
//     补 T2-3 验收原「inspection only」缺口。
import { describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../src/core/session-manager.ts";
import {
	DEFAULT_THINKING_FOLD_STATE,
	getThinkingFoldState,
	type ThinkingFoldState,
	thinkingEntryId,
} from "../src/modes/interactive/components/thinking-fold.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

// ---------------------------------------------------------------------------
// 原型级 harness(与 test/interactive-tui.test.ts 同款)
// ---------------------------------------------------------------------------

type FoldContext = {
	thinkingEntryOrder: string[];
	thinkingFocusIndex: number;
	thinkingFoldState: Map<string, ThinkingFoldState>;
	showStatus: (message: string) => void;
	ui: { requestRender: () => void };
	/** fold 机制只应持有 UI 态;sessionManager 仅用于断言其零触碰。 */
	sessionManager: FakeSessionManager;
};

type FoldPrototype = {
	handleThinkingFocus(this: FoldContext): void;
	handleThinkingFold(this: FoldContext): void;
	recordThinkingFoldStates(this: FoldContext, entryIds: readonly string[]): void;
	getThinkingEntryFoldState(this: FoldContext, entryId: string): ThinkingFoldState;
};

const foldPrototype = InteractiveMode.prototype as unknown as FoldPrototype;

// ---------------------------------------------------------------------------
// 假 session manager:spy 写路径 + 固定 entries(fixture 会话)
// ---------------------------------------------------------------------------

type FakeSessionManager = {
	entries: SessionEntry[];
	getEntries: ReturnType<typeof vi.fn<() => SessionEntry[]>>;
	appendCustomEntry: ReturnType<typeof vi.fn<() => string>>;
	appendCustomMessageEntry: ReturnType<typeof vi.fn<() => string>>;
	sendMessage: ReturnType<typeof vi.fn<() => unknown>>;
};

function createFakeSessionManager(entries: SessionEntry[]): FakeSessionManager {
	return {
		entries,
		getEntries: vi.fn<() => SessionEntry[]>(() => entries),
		appendCustomEntry: vi.fn<() => string>(() => "polluted-id"),
		appendCustomMessageEntry: vi.fn<() => string>(() => "polluted-id"),
		sendMessage: vi.fn<() => unknown>(() => undefined),
	};
}

// fixture 会话:user 提问 + assistant(含 thinking 块)+ custom 条。thinking 块内容
// 故意不含 fold 态字符串/entryId,使「序列化无泄漏」断言可证伪。
function fixtureEntries(): SessionEntry[] {
	return [
		{
			type: "message",
			id: "e1",
			parentId: "root",
			timestamp: "2026-08-11T00:00:00.000Z",
			message: { role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 },
		},
		{
			type: "message",
			id: "e2",
			parentId: "root",
			timestamp: "2026-08-11T00:00:00.000Z",
			message: {
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "need to check the session schema first" },
					{ type: "text", text: "done." },
				],
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
				stopReason: "stop",
				timestamp: 0,
			},
		},
		{ type: "custom", id: "e3", parentId: "root", timestamp: "2026-08-11T00:00:00.000Z", customType: "test" },
	];
}

function foldContext(overrides: Partial<FoldContext> = {}): FoldContext {
	return {
		thinkingEntryOrder: [],
		thinkingFocusIndex: 0,
		thinkingFoldState: new Map<string, ThinkingFoldState>(),
		showStatus: vi.fn(),
		ui: { requestRender: vi.fn() },
		sessionManager: createFakeSessionManager(fixtureEntries()),
		...overrides,
	};
}

describe("T2 NO_SESSION_POLLUTION — fold 状态零 session/上下文污染", () => {
	it("fold/focus 循环不触发任何 session 写路径(appendCustomEntry/appendCustomMessageEntry/sendMessage)", () => {
		const ctx = foldContext();
		// 模拟流式/恢复登记 + 若干轮 focus/fold 循环。
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:2"]);
		for (let i = 0; i < 3; i++) {
			foldPrototype.handleThinkingFocus.call(ctx);
			foldPrototype.handleThinkingFold.call(ctx);
		}

		expect(ctx.sessionManager.appendCustomEntry).not.toHaveBeenCalled();
		expect(ctx.sessionManager.appendCustomMessageEntry).not.toHaveBeenCalled();
		expect(ctx.sessionManager.sendMessage).not.toHaveBeenCalled();
	});

	it("fold 机制连 session 读路径都不触碰(纯 UI 态,不入上下文)", () => {
		const ctx = foldContext();
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1"]);
		foldPrototype.handleThinkingFold.call(ctx);

		expect(ctx.sessionManager.getEntries).not.toHaveBeenCalled();
	});

	it("fold 循环后 fixture 会话 entries 列表与序列化逐字节不变(resume/export 断言)", () => {
		const ctx = foldContext();
		const before = JSON.stringify(ctx.sessionManager.entries);

		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:2", "a2:1"]);
		for (let i = 0; i < 6; i++) {
			foldPrototype.handleThinkingFocus.call(ctx);
			foldPrototype.handleThinkingFold.call(ctx);
		}

		expect(ctx.sessionManager.entries).toHaveLength(fixtureEntries().length);
		expect(JSON.stringify(ctx.sessionManager.entries)).toBe(before);
	});

	it("fold map 从不持久化:序列化会话不含 fold 态/entryId 字符串", () => {
		const ctx = foldContext();
		const entryIds = [thinkingEntryId("a1", 1), thinkingEntryId("a1", 2), thinkingEntryId("a2", 1)];
		foldPrototype.recordThinkingFoldStates.call(ctx, entryIds);
		// 推进到 preview/full 等非缺省态。
		foldPrototype.handleThinkingFold.call(ctx); // a1:1 → preview
		foldPrototype.handleThinkingFocus.call(ctx); // → a1:2
		foldPrototype.handleThinkingFold.call(ctx); // a1:2 → preview
		foldPrototype.handleThinkingFold.call(ctx); // a1:2 → full

		// map 内确实存在非缺省态(断言前提成立)。
		expect(ctx.thinkingFoldState.get("a1:2")).toBe("full");

		const serialized = JSON.stringify(ctx.sessionManager.entries);
		for (const entryId of entryIds) {
			expect(serialized).not.toContain(entryId);
		}
		for (const state of ["preview", "full", "collapsed"] as const) {
			expect(serialized).not.toContain(state);
		}
	});

	it("getThinkingEntryFoldState 只读纯内存 map(缺省 collapsed),零 session 触碰", () => {
		const ctx = foldContext();
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1"]);
		foldPrototype.handleThinkingFold.call(ctx); // a1:1 → preview

		expect(foldPrototype.getThinkingEntryFoldState.call(ctx, "a1:1")).toBe("preview");
		expect(foldPrototype.getThinkingEntryFoldState.call(ctx, "a1:2")).toBe(DEFAULT_THINKING_FOLD_STATE);
		// 未知 id 回落缺省且不写入 map(只读)。
		expect(ctx.thinkingFoldState.has("a1:2")).toBe(false);

		expect(ctx.sessionManager.getEntries).not.toHaveBeenCalled();
		expect(ctx.sessionManager.appendCustomEntry).not.toHaveBeenCalled();
	});
});

describe("T2-3 recordThinkingFoldStates 幂等回归(原验收 inspection only)", () => {
	it("重叠/重复 entryIds 多次登记不重复入序、map 不被腐蚀", () => {
		const ctx = foldContext();
		const order = ctx.thinkingEntryOrder;

		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:2"]);
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:2", "a1:3"]); // 重叠
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:2", "a1:3"]); // 重复
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:1", "a1:3", "a1:3"]); // 同批重复

		expect(order).toEqual(["a1:1", "a1:2", "a1:3"]); // 首次见序,无重复
		expect(new Set(order).size).toBe(order.length);
		expect(ctx.thinkingFoldState.size).toBe(3);
		for (const entryId of ["a1:1", "a1:2", "a1:3"]) {
			expect(getThinkingFoldState(ctx.thinkingFoldState, entryId)).toBe(DEFAULT_THINKING_FOLD_STATE);
		}
	});

	it("重复登记保留既有 fold 态与顺序(不重置、不挪位)", () => {
		const ctx = foldContext();
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:2"]);
		foldPrototype.handleThinkingFold.call(ctx); // a1:1 → preview

		// 恢复/重建路径重复登记同一批 entryIds。
		foldPrototype.recordThinkingFoldStates.call(ctx, ["a1:1", "a1:2"]);

		expect(ctx.thinkingEntryOrder).toEqual(["a1:1", "a1:2"]);
		expect(ctx.thinkingFoldState.get("a1:1")).toBe("preview"); // 既有态不被重置
		expect(ctx.thinkingFoldState.get("a1:2")).toBe(DEFAULT_THINKING_FOLD_STATE);
	});
});
