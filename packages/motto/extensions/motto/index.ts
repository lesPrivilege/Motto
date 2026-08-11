// motto —— TUI 品牌层(index.ts 薄:pi 集成接线;纯逻辑见 core.ts)。
// 牌记(splash)/ footer(含 TPS)/ 终端标题守护 / 提示词品牌化。
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { projectDeepHeadings } from "./headings.ts";
import {
	buildFooterLine,
	buildSplash,
	collectFacts,
	createTpsTracker,
	injectBrandIdentity,
	injectProjectDoc,
	localIsoDate,
	makeColor,
	modelId,
	readProjectDoc,
	readMotto,
	reassertMottoTitle,
	renderLine,
	startTitleWatchdog,
} from "./core.ts";

let stopTitleWatchdog: (() => void) | undefined;
/** 项目本地正文截断提醒:每会话只 notify 一次(会话内重复触发不再弹)。 */
let projectDocTruncationNotified = false;

export default function motto(pi: ExtensionAPI): void {
	const tps = createTpsTracker();

	// 多级标题展示投影:display-only,把 H3–H6 投影为 H2 文本 `## › 原标题`,三层视觉
	// (H1/H2/H3–H6 统一 `› 标题`,不显示标题井号)。只改 TUI 渲染输入(pi 的 markdown
	// transformer 仅作用于 interactive 组件的 Markdown 投影,session / 模型上下文 /
	// print / json 输出均不经过)。纯逻辑见 headings.ts。
	pi.registerMarkdownTransformer(projectDeepHeadings);

	// TPS 事件接线:assistant 回答窗口的流式/结算。
	pi.on("message_start", (event) => {
		if (event.message?.role === "assistant") tps.onMessageStart();
	});
	pi.on("message_update", (event) => {
		// message_update 仅由 assistant 流触发(agent-loop 的响应流内),message 字段流式期为
		// 空对象、无 role —— 直接按 assistantMessageEvent 取 delta,不做 role 过滤。
		const ev = event.assistantMessageEvent as
			| { type?: string; delta?: unknown }
			| undefined;
		const delta =
			ev && (ev.type === "text_delta" || ev.type === "thinking_delta") && typeof ev.delta === "string"
				? ev.delta.length
				: 0;
		tps.onMessageUpdate(delta);
	});
	pi.on("message_end", (event) => {
		if (event.message?.role !== "assistant") return;
		const usage = (event.message as { usage?: { output?: number } }).usage?.output;
		tps.onMessageEnd(usage);
	});

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		// 新会话:重置项目本地正文截断提醒(每会话一次)。
		projectDocTruncationNotified = false;
		const inscription = readMotto();
		const openingModel = modelId(ctx.model);
		const openingDate = localIsoDate();
		const facts = collectFacts(ctx.cwd);

		if (typeof ctx.ui.setHeader === "function") ctx.ui.setHeader((tui, theme) => {
			if (typeof tui.terminal?.clearScreen === "function") tui.terminal.clearScreen();
			const color = makeColor(theme);
			return {
				invalidate() {},
				render(width: number): string[] {
					return buildSplash(inscription, openingModel, openingDate, facts, width)
						.map((line) => renderLine(line, color));
				},
			};
		});
		if (typeof ctx.ui.setFooter === "function") {
			ctx.ui.setFooter((_tui, theme, footerData) => {
				const color = makeColor(theme);
				return {
					invalidate() {},
					dispose() {},
					render(width: number): string[] {
						try {
							const tpsText = tps.snapshot()?.text;
							const line = buildFooterLine(color, ctx, footerData, width, tpsText);
							// 宽度兜底:构造已保证 ≤ width,此处仅为防未来回归;异常则空行,不抛错不崩 TUI。
							return [visibleWidth(line) <= width ? line : ""];
						} catch {
							return [""];
						}
					},
				};
			});
		}
		// 标题:启动期 pi 会多次写 "π - ...",退避重设覆盖之;随后周期守护兜底。
		for (const delay of [0, 300, 800, 1500, 3000]) reassertMottoTitle(ctx, delay);
		stopTitleWatchdog?.();
		stopTitleWatchdog = startTitleWatchdog(ctx);
	});

	pi.on("session_info_changed", (_event, ctx) => {
		reassertMottoTitle(ctx);
	});

	pi.on("session_shutdown", () => {
		stopTitleWatchdog?.();
		stopTitleWatchdog = undefined;
	});

	pi.on("before_agent_start", (event, ctx) => {
		// 品牌只做加法:身份段拼接于提示词末尾,上游原文零改写(功能语不可侵,
		// 见 docs/MOTTO.md 总纲五.5)。曾用全文正则把独立 "pi" 替换为 "Motto",
		// 越界改写 `.pi`/`/pi` 路径导致 skill 读取 ENOENT,已废弃替换路径。
		// 项目本地域:cwd/.motto/agent.md 存在则作为独立段追加在身份段之后
		// (同法纯加法、项目原文逐字节保留、段标明来源);缺失静默跳过,不建目录不写文件。
		// 超限截断并 notify 一次(见 core.ts PROJECT_DOC_LIMIT_BYTES)。
		let systemPrompt = injectBrandIdentity(event.systemPrompt);
		const doc = readProjectDoc(ctx.cwd);
		if (doc) {
			systemPrompt = injectProjectDoc(systemPrompt, doc);
			if (doc.truncated && !projectDocTruncationNotified) {
				projectDocTruncationNotified = true;
				try {
					ctx.ui.notify("motto: .motto/agent.md 超过 32KB 上限,已截断注入(每会话提醒一次)", "warning");
				} catch {
					// 非交互模式 notify 可能缺失,忽略。
				}
			}
		}
		return {
			systemPrompt,
		};
	});
}
