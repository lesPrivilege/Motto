// motto-review-flow —— 对话流 turn 级 recap(index.ts 薄:pi 事件接线;纯策略与版式见 core.ts)。
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import { ENTRY_TYPE, buildTurnLines, makeColor, makeToolReview, type Slot, type ThemeLike, type TurnReviewData } from "./core.ts";

class ReviewLines implements Component {
	private readonly data: TurnReviewData;
	private readonly expanded: boolean;
	private readonly color: (slot: Slot, text: string) => string;

	constructor(data: TurnReviewData, expanded: boolean, color: (slot: Slot, text: string) => string) {
		this.data = data;
		this.expanded = expanded;
		this.color = color;
	}

	invalidate(): void {
		// 无内部缓存;布局系统按宽度缓存 render 输出。
	}

	render(width: number): string[] {
		return buildTurnLines(this.data, this.expanded, Math.max(1, Math.floor(width))).map((line) =>
			line.map((u) => (u.slot ? this.color(u.slot, u.text) : u.text)).join(""),
		);
	}
}

function isTurnReviewData(value: unknown): value is TurnReviewData {
	if (!value || typeof value !== "object") return false;
	const data = value as Partial<TurnReviewData>;
	return data.version === 1 && typeof data.durationMs === "number" && Array.isArray(data.tools);
}

// ============================================================================
// 事件采集:turn → tools(仅内存)→ 投影(落 session,custom entry)
// ============================================================================

interface ActiveTool {
	name: string;
	args: unknown;
	startedAt: number;
	endedAt?: number;
	result?: unknown;
	isError?: boolean;
}

interface ActiveTurn {
	startedAt: number;
	tools: Map<string, ActiveTool>;
}

export default function mottoReviewFlow(pi: ExtensionAPI): void {
	// fail-closed:旧版 pi 缺 custom entry API 时静默失活,不做任何展示降级、不抛错。
	// 失活升级为启动时一次性警告(仅 TUI),避免 0.85+ 改名后本件无声消失。
	if (typeof pi.appendEntry !== "function" || typeof pi.registerEntryRenderer !== "function") {
		pi.on("session_start", (_event, ctx) => {
			if (ctx.hasUI) {
				ctx.ui.notify(
					"motto-review-flow: pi lacks appendEntry/registerEntryRenderer — the turn recap line is inactive. " +
						"Check dist exports before upgrading pi.",
					"warning",
				);
			}
		});
		return;
	}

	let activeTurn: ActiveTurn | undefined;

	pi.registerEntryRenderer<TurnReviewData>(ENTRY_TYPE, (entry, options, theme) => {
		if (!isTurnReviewData(entry.data)) {
			return new Text("(invalid entry)", 0, 0);
		}
		return new ReviewLines(entry.data, options.expanded, makeColor(theme as unknown as ThemeLike));
	});

	pi.on("turn_start", (event) => {
		activeTurn = { startedAt: event.timestamp, tools: new Map() };
	});

	pi.on("tool_execution_start", (event) => {
		if (!activeTurn) activeTurn = { startedAt: Date.now(), tools: new Map() };
		activeTurn.tools.set(event.toolCallId, {
			name: event.toolName,
			args: event.args,
			startedAt: Date.now(),
		});
	});

	pi.on("tool_execution_end", (event) => {
		if (!activeTurn) activeTurn = { startedAt: Date.now(), tools: new Map() };
		const endedAt = Date.now();
		const tool = activeTurn.tools.get(event.toolCallId);
		if (tool) {
			tool.result = event.result;
			tool.isError = event.isError;
			tool.endedAt = endedAt;
		} else {
			activeTurn.tools.set(event.toolCallId, {
				name: event.toolName,
				args: {},
				startedAt: endedAt,
				endedAt,
				result: event.result,
				isError: event.isError,
			});
		}
	});

	pi.on("turn_end", (event) => {
		const turn = activeTurn;
		activeTurn = undefined;
		if (!turn || turn.tools.size === 0) return;

		const endedAt = Date.now();
		const tools = Array.from(turn.tools.values()).map((tool) =>
			makeToolReview({
				name: tool.name,
				args: tool.args,
				result: tool.result,
				isError: tool.isError ?? false,
				startedAt: tool.startedAt,
				endedAt: tool.endedAt,
			}),
		);

		// 展示专用投影:经 appendEntry 落 custom entry,不入模型上下文。
		pi.appendEntry<TurnReviewData>(ENTRY_TYPE, {
			version: 1,
			turnIndex: event.turnIndex,
			durationMs: Math.max(0, endedAt - turn.startedAt),
			tools,
		});
	});
}
