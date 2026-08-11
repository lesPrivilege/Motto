import { describe, expect, test } from "vitest";
import type { SessionEntry } from "../src/core/session-manager.ts";
import {
	countAssistantMessageEntries,
	DEFAULT_THINKING_FOLD_STATE,
	getThinkingFoldState,
	messageKeyForAssistantOrdinal,
	setThinkingFoldState,
	type ThinkingFoldState,
	thinkingEntryId,
} from "../src/modes/interactive/components/thinking-fold.ts";

// T2-1 纯 helper 单测:序数推导 / entryId 组合 / fold map 读写。不实例化
// interactive-mode,跑得快、无副作用(fold map 纯内存语义)。
function assistantEntry(id: string, parentId = "root"): SessionEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: "2026-08-11T00:00:00.000Z",
		message: {
			role: "assistant",
			content: [],
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
	};
}

function userEntry(id: string, parentId = "root"): SessionEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: "2026-08-11T00:00:00.000Z",
		message: {
			role: "user",
			content: [{ type: "text", text: "hi" }],
			timestamp: 0,
		},
	};
}

function customEntry(id: string): SessionEntry {
	return { type: "custom", id, parentId: "root", timestamp: "2026-08-11T00:00:00.000Z", customType: "test" };
}

describe("thinking-fold helpers (T2-1)", () => {
	test("countAssistantMessageEntries counts only assistant message entries in order", () => {
		const entries = [
			userEntry("e1"),
			assistantEntry("e2"),
			customEntry("e3"),
			assistantEntry("e4"),
			userEntry("e5"),
			assistantEntry("e6"),
		];
		expect(countAssistantMessageEntries(entries)).toBe(3);
		expect(countAssistantMessageEntries([])).toBe(0);
	});

	test("messageKeyForAssistantOrdinal prefixes the 1-based ordinal with 'a'", () => {
		expect(messageKeyForAssistantOrdinal(1)).toBe("a1");
		expect(messageKeyForAssistantOrdinal(7)).toBe("a7");
	});

	test("thinkingEntryId composes messageKey and runIndex", () => {
		expect(thinkingEntryId("a2", 3)).toBe("a2:3");
		expect(thinkingEntryId("a1", 1)).toBe("a1:1");
	});

	test("fold map defaults to collapsed for unknown entryIds and persists set state", () => {
		const fold = new Map<string, ThinkingFoldState>();
		expect(DEFAULT_THINKING_FOLD_STATE).toBe("collapsed");
		expect(getThinkingFoldState(fold, "a1:1")).toBe("collapsed");

		setThinkingFoldState(fold, "a1:1", "full");
		expect(getThinkingFoldState(fold, "a1:1")).toBe("full");
		// 未触碰的 entryId 仍回落缺省;同一 map 跨重建保持(重建不重建 map)。
		expect(getThinkingFoldState(fold, "a1:2")).toBe("collapsed");
		expect(fold.size).toBe(1);
	});
});
