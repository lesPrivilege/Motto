// thinking-fold.ts — T2-1:thinking 块稳定身份 + UI 层 fold 状态(Motto 受控下游接缝)。
//
// 纯 UI 侧管道(I0/I10):entryId 由 assistant 消息序数 + thinking run 序数推导,
// 不写 session、不入模型上下文;fold 状态存于 interactive-mode 内存 Map,默认
// collapsed。T2-1 只建身份 + fold map 管道,三态渲染消费属 T2-2(渲染行为不变)。
import type { SessionEntry } from "../../../core/session-manager.ts";

/** 单条 thinking entry 的 fold 状态(T2-2 三态消费;T2-1 只建 map + 默认)。 */
export type ThinkingFoldState = "collapsed" | "preview" | "full";

/** 任何 thinking entry 的缺省 fold 状态(著录层纪律:thinking 归不著录之列)。 */
export const DEFAULT_THINKING_FOLD_STATE: ThinkingFoldState = "collapsed";

/**
 * 稳定 messageKey:`"a" + assistantMessageOrdinal`(1-based)。
 * 序数按 buildContextEntries() 顺序只数 `type:"message"` 且 `role:"assistant"`
 * 的 entry(与 sessionEntryToContextMessages 1:1);流式/恢复/重建同源同序推导。
 */
export function messageKeyForAssistantOrdinal(ordinal: number): string {
	return `a${ordinal}`;
}

/**
 * 稳定 per-run entryId:`${messageKey}:${runIndex}`。
 * runIndex 为该 message 内 thinking run 的 1-based 序数,与 assistant-message.ts
 * updateContent 的 run 合并逻辑对齐;messageKey 于 message_start 定死(I7-1),
 * run 序数逐帧推导一致 → entryId 跨帧不变。不用 contentIndex(漂移)或
 * thinkingSignature(provider 可选)。
 */
export function thinkingEntryId(messageKey: string, runIndex: number): string {
	return `${messageKey}:${runIndex}`;
}

/**
 * 数出 compaction-aware entry 列表中的 assistant message 条数。流式期用:
 * in-flight message 尚未持久化,其序数 = 已有条数 + 1(message_start 定死)。
 */
export function countAssistantMessageEntries(entries: readonly SessionEntry[]): number {
	let count = 0;
	for (const entry of entries) {
		if (entry.type === "message" && entry.message.role === "assistant") count++;
	}
	return count;
}

/** 读 entryId 的 fold 状态;未知 id 回落缺省 collapsed。 */
export function getThinkingFoldState(map: ReadonlyMap<string, ThinkingFoldState>, entryId: string): ThinkingFoldState {
	return map.get(entryId) ?? DEFAULT_THINKING_FOLD_STATE;
}

/** 写 entryId 的 fold 状态(纯内存,不落 session / 不入模型上下文)。 */
export function setThinkingFoldState(
	map: Map<string, ThinkingFoldState>,
	entryId: string,
	state: ThinkingFoldState,
): void {
	map.set(entryId, state);
}
