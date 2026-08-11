import { visibleWidth } from "@earendil-works/pi-tui";

// ============================================================================
// motto-review-flow —— 对话流 turn 级统计 + 逐工具行,纯展示层。
//
// 经 pi 原生 custom entry(appendEntry / registerEntryRenderer)落一条
// `motto-review-flow.turn.v1` 投影:不入模型上下文、不改工具/消息/session 语义。
// 与 motto 牌记同宗:两列悬挂、` · ` 间隔、灰阶三级 + accent,零框零竖线。
//
// 色槽:只取 text / dim / dimmer / accent 四槽(theme.fg 语义取色,extension 内无 hex)。
// dimmer 为 motto 主题私有槽,缺省时(非 motto 主题)静默降级到 dim。
//
// 全部文案为机械投影:tool 名、路径、计数、耗时、退出状态一律取自原生元数据,
// 错误提要 = stderr 尾部原文截取(≤5 行),无任何生成式摘要或改写。
//
// fail-closed:旧版 pi 缺 custom entry API 时静默失活,绝不降级注入模型上下文。
// ============================================================================

export const ENTRY_TYPE = "motto-review-flow.turn.v1";

/** 语义色槽(四槽)。全系统色相只有朱与墨;success/warning/error/toolTitle 一律不用。 */
export type Slot = "text" | "dim" | "dimmer" | "accent";

export interface ToolReview {
	name: string;
	category: "explore" | "change" | "execute" | "other";
	target: string;
	metric: string;
	status: "ok" | "error";
	durationMs?: number;
	/** 失败工具的错误提要:stderr 尾部原文 ≤5 行,每行裁剪。 */
	errorLines?: string[];
}

export interface TurnReviewData {
	version: 1;
	turnIndex: number;
	durationMs: number;
	tools: ToolReview[];
}

// ============================================================================
// 版式常量
// ============================================================================

/** 动词列与对象列之间的空格数。 */
const ITEM_GAP = 2;

/** 著录化缩进（TUI-1 S4）：对齐 transcript 正文列（与 S1 界栏 / S2 assistant 同列）。 */
export const RECAP_INDENT = 2;
/** 动词列显示宽度上限(超长自定义工具名裁剪)。 */
const MAX_VERB_WIDTH = 16;
/** 对象(路径/模式/命令)裁剪长度。 */
const MAX_OBJECT_LEN = 80;
/** 错误提要:最多行数与每行裁剪长度。 */
const MAX_ERROR_LINES = 5;
const MAX_ERROR_LINE_LEN = 100;
/** 列表项间隔符(一律 · ,不用逗号)。 */
const SEP = " · ";

// ============================================================================
// 纯策略(无渲染依赖,导出供测试)
// ============================================================================

export function normalizeWhitespace(value: unknown): string {
	return String(value ?? "")
		.replace(/\s+/gu, " ")
		.trim();
}

/** 按 Unicode 码点裁剪,超长补 …。 */
export function clip(value: unknown, max = 120): string {
	const text = normalizeWhitespace(value);
	const chars = Array.from(text);
	if (chars.length <= max) return text;
	return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

export function extractText(result: unknown): string {
	const content = (result as { content?: unknown } | null | undefined)?.content;
	if (!Array.isArray(content)) return "";
	return content
		.filter(
			(part): part is { type: string; text: string } =>
				Boolean(part) &&
				typeof part === "object" &&
				(part as { type?: unknown }).type === "text" &&
				typeof (part as { text?: unknown }).text === "string",
		)
		.map((part) => part.text)
		.join("\n");
}

export function countNonEmptyLines(value: unknown): number {
	const text = String(value ?? "");
	if (!text) return 0;
	return text.split(/\r?\n/u).filter((line) => line.trim().length > 0).length;
}

export function firstNonEmptyLine(value: unknown): string {
	return (
		String(value ?? "")
			.split(/\r?\n/u)
			.find((line) => line.trim().length > 0)
			?.trim() ?? ""
	);
}

export function diffStats(diff: unknown): { additions: number; deletions: number } {
	let additions = 0;
	let deletions = 0;
	for (const line of String(diff ?? "").split(/\r?\n/u)) {
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("+")) additions += 1;
		if (line.startsWith("-")) deletions += 1;
	}
	return { additions, deletions };
}

const SAFE_TARGET_KEYS = ["path", "file_path", "file", "directory", "cwd", "query", "pattern", "glob", "url", "name", "id"] as const;
const EXPLORE_TOOLS = new Set(["read", "grep", "find", "ls", "list", "search"]);
const CHANGE_TOOLS = new Set(["edit", "write", "patch", "apply_patch"]);
const EXECUTE_TOOLS = new Set(["bash", "shell", "exec", "run"]);

export function toolCategory(name: unknown): ToolReview["category"] {
	const normalized = String(name ?? "").toLowerCase();
	if (EXPLORE_TOOLS.has(normalized)) return "explore";
	if (CHANGE_TOOLS.has(normalized)) return "change";
	if (EXECUTE_TOOLS.has(normalized)) return "execute";
	return "other";
}

function stringArg(args: unknown, keys: readonly string[]): string {
	if (!args || typeof args !== "object") return "";
	for (const key of keys) {
		const value = (args as Record<string, unknown>)[key];
		if (typeof value === "string" && value.trim()) return value;
	}
	return "";
}

const CREDENTIAL_KEY = /(?:authorization|auth|bearer|token|secret|password|passwd|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|cookie|session)(?:\s|[:=_-])/iu;
const CREDENTIAL_TOKEN = /(?:^|[=:/?&])(?:sk-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]+|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)(?:$|[&#])/u;
const HIGH_ENTROPY_TOKEN = /^(?=[A-Za-z0-9_+/=-]{24,}$)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_+/=-]+$/u;

function isCredentialShaped(value: string): boolean {
	const token = value.trim();
	if (!token) return false;
	if (CREDENTIAL_KEY.test(token) || CREDENTIAL_TOKEN.test(token) || HIGH_ENTROPY_TOKEN.test(token)) return true;
	if (/^[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s@]+@/iu.test(token)) return true;
	return /[?&](?:access_token|auth|token|secret|password|api[-_]?key)=/iu.test(token);
}

/** 只解析首个 shell command 的少量词;遇操作符即停,不猜测 shell 展开。 */
function shellWords(value: unknown, limit = 4): string[] {
	const source = String(value ?? "");
	const words: string[] = [];
	let word = "";
	let quote: "'" | '"' | undefined;
	let escaped = false;
	const push = () => {
		if (!word) return;
		words.push(word);
		word = "";
	};

	for (const ch of source) {
		if (escaped) {
			word += ch;
			escaped = false;
			continue;
		}
		if (ch === "\\" && quote !== "'") {
			escaped = true;
			continue;
		}
		if (quote) {
			if (ch === quote) quote = undefined;
			else word += ch;
			continue;
		}
		if (ch === "'" || ch === '"') {
			quote = ch;
			continue;
		}
		if (/\s/u.test(ch)) {
			push();
			if (words.length >= limit) break;
			continue;
		}
		if (/[;&|<>]/u.test(ch)) {
			push();
			break;
		}
		word += ch;
	}
	if (words.length < limit) push();
	return words.slice(0, limit);
}

/** 命令投影:argv[0],至多附紧邻的首个非选项参数;任何凭据形状 fail-closed。 */
function commandTarget(value: unknown): string {
	const words = shellWords(value);
	let commandIndex = 0;
	while (commandIndex < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/u.test(words[commandIndex])) commandIndex += 1;
	const command = words[commandIndex] ?? "";
	if (!command || isCredentialShaped(command)) return "";

	const firstArg = words[commandIndex + 1];
	if (!firstArg || firstArg.startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/u.test(firstArg) || isCredentialShaped(firstArg)) {
		return clip(command, MAX_OBJECT_LEN);
	}
	return clip(`${command} ${firstArg}`, MAX_OBJECT_LEN);
}

/** 自定义工具:只取 review-safe 标量参数 `key=value`,不序列化内容/凭据/大负载。 */
function safeGenericTarget(args: unknown): string {
	if (!args || typeof args !== "object") return "";
	for (const key of SAFE_TARGET_KEYS) {
		const value = (args as Record<string, unknown>)[key];
		if (typeof value === "string" && value.trim()) return `${key}=${clip(value, 60)}`;
		if (typeof value === "number" || typeof value === "boolean") return `${key}=${String(value)}`;
	}
	return "";
}

/** 对象列:路径、模式、命令首段;一律 review-safe。 */
export function toolTarget(name: unknown, args: unknown): string {
	const normalized = String(name ?? "").toLowerCase();

	if (normalized === "read" || normalized === "edit" || normalized === "write") {
		return clip(stringArg(args, ["path", "file_path", "file"]), MAX_OBJECT_LEN);
	}
	if (normalized === "grep" || normalized === "search") {
		const pattern = clip(stringArg(args, ["pattern", "query"]), 50);
		const path = clip(stringArg(args, ["path", "directory", "cwd"]) || ".", 50);
		return pattern ? `/${pattern}/ in ${path}` : path;
	}
	if (normalized === "find") {
		const pattern = clip(stringArg(args, ["pattern", "glob", "query"]), 50);
		const path = clip(stringArg(args, ["path", "directory", "cwd"]) || ".", 50);
		return pattern ? `${pattern} in ${path}` : path;
	}
	if (normalized === "ls" || normalized === "list") {
		return clip(stringArg(args, ["path", "directory", "cwd"]) || ".", MAX_OBJECT_LEN);
	}
	if (normalized === "bash" || normalized === "shell" || normalized === "exec" || normalized === "run") {
		return commandTarget(stringArg(args, ["command", "cmd", "script"]));
	}
	return safeGenericTarget(args);
}

function mediaMetric(result: unknown): string {
	const content = (result as { content?: unknown } | null | undefined)?.content;
	if (!Array.isArray(content)) return "";
	const images = content.filter((part) => part && typeof part === "object" && (part as { type?: unknown }).type === "image").length;
	if (images === 1) return "1 image";
	if (images > 1) return `${images} images`;
	return "";
}

/** 度量列:行数/匹配数/改笔统计。run 成功不记输出度量。失败不记度量,由错误提要承载。 */
export function toolMetric(name: unknown, args: unknown, result: unknown, isError: boolean): string {
	const normalized = String(name ?? "").toLowerCase();
	if (isError) return "";

	const text = extractText(result);
	const lines = countNonEmptyLines(text);
	const media = mediaMetric(result);
	if (media) return media;

	if (normalized === "read") return lines === 1 ? "1 line" : `${lines} lines`;
	if (normalized === "grep" || normalized === "search") return lines === 1 ? "1 match" : `${lines} matches`;
	if (normalized === "find") return lines === 1 ? "1 file" : `${lines} files`;
	if (normalized === "ls" || normalized === "list") return lines === 1 ? "1 entry" : `${lines} entries`;
	if (normalized === "write") {
		const content = stringArg(args, ["content", "text"]);
		const written = content ? String(content).split(/\r?\n/u).length : 0;
		return written === 1 ? "1 line" : `${written} lines`;
	}
	if (normalized === "edit" || normalized === "patch" || normalized === "apply_patch") {
		const details = (result as { details?: unknown } | null | undefined)?.details;
		const diff =
			details && typeof details === "object"
				? typeof (details as { diff?: unknown }).diff === "string"
					? (details as { diff: string }).diff
					: typeof (details as { patch?: unknown }).patch === "string"
						? (details as { patch: string }).patch
						: ""
				: "";
		if (diff) {
			const { additions, deletions } = diffStats(diff);
			return `+${additions} −${deletions}`;
		}
		return "applied";
	}
	if (normalized === "bash" || normalized === "shell" || normalized === "exec" || normalized === "run") {
		return "";
	}
	const first = firstNonEmptyLine(text);
	return first ? clip(first, 60) : "";
}

const EXIT_STATUS_LINE = /^Command (?:exited with code (\d+)|timed out after ([0-9.]+) seconds|aborted)$/;

/** 退出状态:从 bash 工具原生结果尾部机械提取(非生成)。 */
export function toolExitStatus(result: unknown): string {
	const lines = String(extractText(result))
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean);
	const last = lines.at(-1) ?? "";
	const match = last.match(EXIT_STATUS_LINE);
	if (!match) return "";
	if (match[1] !== undefined) return `exit ${match[1]}`;
	if (match[2] !== undefined) return `timeout ${match[2]}s`;
	return "aborted";
}

/** 错误提要:stderr/结果尾部原文 ≤5 个非空行,每行裁剪;剔除已上行的退出状态行。 */
export function errorTail(result: unknown): string[] {
	const text = extractText(result);
	const lines = String(text)
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length > 0 && EXIT_STATUS_LINE.test(lines.at(-1) ?? "")) lines.pop();
	return lines.slice(-MAX_ERROR_LINES).map((line) => clip(line, MAX_ERROR_LINE_LEN));
}

export function formatDuration(durationMs: unknown): string {
	const value = Number(durationMs);
	if (!Number.isFinite(value) || value < 0) return "";
	if (value < 1000) return `${Math.round(value)}ms`;
	if (value < 10_000) return `${(value / 1000).toFixed(1)}s`;
	return `${Math.round(value / 1000)}s`;
}

export interface MakeToolReviewInput {
	name: unknown;
	args: unknown;
	result: unknown;
	isError?: boolean;
	startedAt: unknown;
	endedAt?: unknown;
}

export function makeToolReview({ name, args, result, isError = false, startedAt, endedAt }: MakeToolReviewInput): ToolReview {
	const start = Number(startedAt);
	const end = Number(endedAt);
	const durationMs =
		Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : undefined;
	const review: ToolReview = {
		name: String(name ?? "tool"),
		category: toolCategory(name),
		target: toolTarget(name, args),
		metric: toolMetric(name, args, result, isError),
		status: isError ? "error" : "ok",
	};
	if (durationMs !== undefined) review.durationMs = durationMs;
	if (isError) {
		if (toolCategory(name) === "execute") {
			const status = toolExitStatus(result);
			if (status) review.metric = status;
		}
		const tail = errorTail(result);
		if (tail.length > 0) review.errorLines = tail;
	}
	return review;
}

export function turnStats(tools: unknown): {
	total: number;
	explore: number;
	change: number;
	execute: number;
	other: number;
	failed: number;
} {
	const rows = Array.isArray(tools) ? (tools as Array<Partial<ToolReview>>) : [];
	return rows.reduce(
		(stats, tool) => {
			stats.total += 1;
			if (tool?.category === "explore") stats.explore += 1;
			else if (tool?.category === "change") stats.change += 1;
			else if (tool?.category === "execute") stats.execute += 1;
			else stats.other += 1;
			if (tool?.status === "error") stats.failed += 1;
			return stats;
		},
		{ total: 0, explore: 0, change: 0, execute: 0, other: 0, failed: 0 },
	);
}

export interface StatsPart {
	text: string;
	slot: Slot;
}

/** 汇总行内容段:`N tools · explore N · change N · run N [· other N] [· N failed] · <duration>`。 */
export function turnStatsParts(data: unknown): StatsPart[] {
	const tools = Array.isArray((data as { tools?: unknown } | null | undefined)?.tools)
		? ((data as { tools: ToolReview[] }).tools)
		: [];
	const stats = turnStats(tools);
	const parts: StatsPart[] = [];
	parts.push({ text: `${stats.total} ${stats.total === 1 ? "tool" : "tools"}`, slot: "dim" });
	if (stats.explore) parts.push({ text: `explore ${stats.explore}`, slot: "dim" });
	if (stats.change) parts.push({ text: `change ${stats.change}`, slot: "dim" });
	if (stats.execute) parts.push({ text: `run ${stats.execute}`, slot: "dim" });
	if (stats.other) parts.push({ text: `other ${stats.other}`, slot: "dim" });
	if (stats.failed) parts.push({ text: `${stats.failed} failed`, slot: "accent" });
	const duration = formatDuration((data as { durationMs?: unknown } | null | undefined)?.durationMs);
	if (duration) parts.push({ text: duration, slot: "dim" });
	return parts;
}

/** 汇总行纯文本(测试与调试用)。 */
export function turnStatsLine(data: unknown): string {
	return turnStatsParts(data)
		.map((part) => part.text)
		.join(SEP);
}

// ============================================================================
// 版式:两列悬挂 + 折行
// ============================================================================

export interface LineUnit {
	text: string;
	slot: Slot | null;
}

function joinText(units: readonly LineUnit[]): string {
	return units.map((u) => u.text).join("");
}

/** 硬折行:优先在空格处断,否则按字素;每段显示宽度 ≤ width。 */
function hardWrapText(text: string, width: number): string[] {
	if (width <= 0) return [text];
	if (visibleWidth(text) <= width) return [text];
	const chunks: string[] = [];
	let rest = text;
	while (rest.length > 0 && visibleWidth(rest) > width) {
		let used = 0;
		let offset = 0;
		let lastSpace = -1;
		for (const ch of rest) {
			const cw = visibleWidth(ch);
			if (used + cw > width) break;
			used += cw;
			offset += ch.length;
			if (ch === " ") lastSpace = offset;
		}
		if (offset === 0) {
			const first = Array.from(rest)[0];
			chunks.push(first);
			rest = rest.slice(first.length);
			continue;
		}
		if (lastSpace > 0) {
			chunks.push(rest.slice(0, lastSpace).trimEnd());
			rest = rest.slice(lastSpace).trimStart();
		} else {
			chunks.push(rest.slice(0, offset));
			rest = rest.slice(offset);
		}
	}
	if (rest) chunks.push(rest);
	return chunks;
}

/**
 * 两列悬挂折行:首行 = prefix + 内容;续行悬挂到 hang 列。
 * 断点优先在 ` · ` 处;超长单元(错误提要等)按空格/字素硬折,续行仍悬挂。
 */
export function wrapUnits(
	prefix: readonly LineUnit[],
	units: readonly LineUnit[],
	hang: number,
	width: number,
): LineUnit[][] {
	const contentWidth = width - hang;
	if (contentWidth <= 0) {
		const joined: LineUnit[] = [...prefix];
		for (const u of units) {
			if (joined.length > prefix.length) joined.push({ text: SEP, slot: null });
			joined.push(u);
		}
		return [joined];
	}
	const sepW = visibleWidth(SEP);
	const prefixW = visibleWidth(joinText(prefix));

	// 超长单元先按可用宽硬折成块,块间以 ` · ` 连接。
	const expanded: LineUnit[] = [];
	for (const u of units) {
		if (visibleWidth(u.text) > contentWidth) {
			for (const chunk of hardWrapText(u.text, contentWidth)) expanded.push({ text: chunk, slot: u.slot });
		} else {
			expanded.push(u);
		}
	}

	const lines: LineUnit[][] = [];
	let cur: LineUnit[] = [...prefix];
	let curW = prefixW;
	let needSep = false;

	for (const u of expanded) {
		const uW = visibleWidth(u.text);
		const sepCost = needSep ? sepW : 0;
		if (curW + sepCost + uW <= width) {
			if (needSep) cur.push({ text: SEP, slot: null });
			cur.push(u);
			curW += sepCost + uW;
			needSep = true;
		} else {
			lines.push(cur);
			cur = [{ text: " ".repeat(hang), slot: null }];
			curW = hang;
			cur.push(u);
			curW += uW;
			needSep = true;
		}
	}
	lines.push(cur);
	return lines;
}

function computeVerbWidth(tools: readonly ToolReview[]): number {
	let width = 0;
	for (const tool of tools) {
		const vw = Math.min(visibleWidth(tool.name), MAX_VERB_WIDTH);
		if (vw > width) width = vw;
	}
	return width;
}

function verbLabel(name: string, verbWidth: number): string {
	const clipped = visibleWidth(name) > MAX_VERB_WIDTH ? clip(name, MAX_VERB_WIDTH - 1) : name;
	return clipped + " ".repeat(Math.max(0, verbWidth - visibleWidth(clipped))) + " ".repeat(ITEM_GAP);
}

function toolLineUnits(tool: ToolReview): LineUnit[] {
	const failed = tool.status === "error";
	const units: LineUnit[] = [];
	if (tool.target) units.push({ text: tool.target, slot: failed ? "accent" : "dim" });
	if (tool.metric) {
		// 改笔(diff 统计)与失败一律 accent。
		units.push({ text: tool.metric, slot: failed || tool.category === "change" ? "accent" : "dimmer" });
	}
	const duration = formatDuration(tool.durationMs);
	if (duration) units.push({ text: duration, slot: failed ? "accent" : "dimmer" });
	return units;
}

/**
 * 组装全部行(未着色,供测试与渲染共用)。
 * collapsed 时失败工具强制展示;展开时展示全部工具。
 * S4 著录化:全块缩进 RECAP_INDENT 对齐正文列;失败仍 accent 强显,不随著录化降权。
 */
export function buildTurnLines(data: TurnReviewData, expanded: boolean, width: number): LineUnit[][] {
	const lines: LineUnit[][] = [];
	const indent: LineUnit = { text: " ".repeat(RECAP_INDENT), slot: null };
	// 汇总行:无标签,直接以计数起始,续行悬挂 RECAP_INDENT。
	lines.push(...wrapUnits([indent], turnStatsParts(data), RECAP_INDENT, width));

	const visible = expanded ? data.tools : data.tools.filter((t) => t.status === "error");
	const verbWidth = computeVerbWidth(data.tools);
	const itemHang = verbWidth + ITEM_GAP;
	const bodyHang = RECAP_INDENT + itemHang;

	for (const tool of visible) {
		lines.push(
			...wrapUnits(
				[indent, { text: verbLabel(tool.name, verbWidth), slot: tool.status === "error" ? "accent" : "text" }],
				toolLineUnits(tool),
				bodyHang,
				width,
			),
		);
		if (tool.status === "error" && tool.errorLines && tool.errorLines.length > 0) {
			for (const line of tool.errorLines) {
				lines.push(
					...wrapUnits(
						[indent, { text: " ".repeat(itemHang), slot: null }],
						[{ text: line, slot: "dim" }],
						bodyHang,
						width,
					),
				);
			}
		}
	}
	return lines;
}

// ============================================================================
// 取色:四槽语义,缺槽降级,失败安全
// ============================================================================

export interface ThemeLike {
	fg(slot: string, text: string): string;
}

export function makeColor(theme: ThemeLike): (slot: Slot, text: string) => string {
	const probe = (slot: string): boolean => {
		try {
			theme.fg(slot, "");
			return true;
		} catch {
			return false;
		}
	};
	const has: Record<Slot, boolean> = {
		text: probe("text"),
		dim: probe("dim"),
		dimmer: probe("dimmer"),
		accent: probe("accent"),
	};
	const chain: Record<Slot, Slot[]> = {
		text: ["text", "dim"],
		dim: ["dim", "text"],
		dimmer: ["dimmer", "dim", "text"],
		accent: ["accent", "text", "dim"],
	};
	return (slot, text) => {
		for (const candidate of chain[slot]) {
			if (has[candidate]) return theme.fg(candidate, text);
		}
		return text;
	};
}

// ============================================================================
// 渲染组件:render(width) 内按当前宽度重算折行,窗口缩放悬挂正确
// ============================================================================

