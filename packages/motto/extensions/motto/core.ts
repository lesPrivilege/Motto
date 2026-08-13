// motto core —— splash / footer(含 TPS)/ 终端标题守护 的纯逻辑层。
// 只做版式、取色、宽度、统计与 TPS 状态机;pi 集成接线在 index.ts。
// 与 ~/.pi/agent 仓源文本逐字对应(源 commit f6f93ca 前的 a9bbba6 + TPS)。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ExtensionContext, ReadonlyFooterDataProvider, SessionEntry } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

// ============================================================================
// 品牌注入:只做加法,不做改写。
// 身份段拼接在提示词末尾;上游提示词原文逐字节不动——路径/命令/包名/API 名等
// 功能性 token 零触碰(「设计语不外泄」的对偶条款:「功能语不可侵」,规范见
// docs/MOTTO.md 总纲五.5)。曾用全文正则把独立 "pi" 替换为 "Motto",越界改写
// `.pi`/`/pi` 路径导致 skill 读取 ENOENT,已废弃替换路径。
// ============================================================================

const MOTTO_IDENTITY = `

## Motto identity

This coding agent is locally presented as Motto. Motto keeps a concise,
tool-oriented coding philosophy while using a shorter, more sonorous name. Use
"Motto" when referring to the agent in user-facing text. Keep technical package,
command, path, and API names unchanged when they are part of the actual runtime.
`;

/** 品牌注入:上游提示词原文 + 身份段。只追加,零改写。 */
export function injectBrandIdentity(systemPrompt: string): string {
	return systemPrompt.concat(MOTTO_IDENTITY);
}

// ============================================================================
// 项目本地域:注入 cwd/.motto/agent.md 为独立段。
// 立域是用户动作(项目内自建 .motto/agent.md),扩展只消费:
//   - 文件缺失/为空/读取失败 → 静默跳过,不建目录、不写文件(零副作用);
//   - 存在 → 作为独立段追加(与身份段同法:纯加法、上游提示词与项目原文零改写,
//     段有明确标题标明来源 `.motto/agent.md`);
//   - 超过上限 → 截断并在截断点注明,UI 通知一次(防项目文件失控变成 context 税)。
// 与 pi 自有 context 机制零干涉:pi 注入什么照旧,本扩展只加自己这一段;与全局
// AGENTS.md 的重复由项目作者自理,扩展不去重。
// ============================================================================

/** 项目本地正文上限(字节),超限截断并标注。 */
export const PROJECT_DOC_LIMIT_BYTES = 32 * 1024;

/** 截断标注(置于截断点之后,说明上限与截断事实,不虚构正文)。 */
const PROJECT_DOC_TRUNCATION_NOTICE =
	`\n\n> motto: \`.motto/agent.md\` 超过 ${PROJECT_DOC_LIMIT_BYTES / 1024}KB 上限,已截断至 ${PROJECT_DOC_LIMIT_BYTES / 1024}KB;请精简项目正文,避免 context 税。`;

/** 项目本地正文读取结果。 */
export interface ProjectDoc {
	/** 注入用独立段全文(含标题与来源标注;截断时含截断标注)。 */
	section: string;
	/** 是否发生截断。 */
	truncated: boolean;
	/** 原始正文字节数(截断前)。 */
	bytes: number;
}

/** 读取 cwd/.motto/agent.md 为独立注入段;缺失/为空/读取失败 → undefined(零副作用)。 */
export function readProjectDoc(cwd: string): ProjectDoc | undefined {
	let raw: string;
	try {
		raw = readFileSync(join(cwd, ".motto", "agent.md"), "utf8");
	} catch {
		return undefined;
	}
	if (raw.length === 0) return undefined;
	const truncated = raw.length > PROJECT_DOC_LIMIT_BYTES;
	const body = truncated ? raw.slice(0, PROJECT_DOC_LIMIT_BYTES) : raw;
	return {
		section:
			`\n\n## Project context (.motto/agent.md)\n\n${body}` +
			(truncated ? PROJECT_DOC_TRUNCATION_NOTICE : ""),
		truncated,
		bytes: raw.length,
	};
}

/** 把项目本地段追加到提示词末尾(纯加法,项目原文逐字节保留)。 */
export function injectProjectDoc(systemPrompt: string, doc: ProjectDoc): string {
	return systemPrompt.concat(doc.section);
}

// ============================================================================
// 版式常量 —— splash 版式。theme 只定义颜色,此处只定义版式。
// ============================================================================
const LAYOUT = {
	/** splash 块上方留 2 空行 */
	topBlank: 2,
	/** 标题行:"motto" 顶格 */
	titleIndent: 0,
	/** motto 与格言之间的空格数 */
	titleGap: 2,
	/** 刊记行(model · date)缩进 */
	colophonIndent: 3,
	/** 标签列缩进 */
	labelIndent: 3,
	/** 标签列固定列宽(最长标签 extensions=10 + 2),不动态计算 */
	labelWidth: 12,
	/** 内容列起始列 = labelIndent + labelWidth */
	contentCol: 15,
	/** 语义块之间的空行数(块内不空) */
	blockGap: 1,
	/** 列表项间隔符(一律 · ,不用逗号) */
	itemSep: " · ",
	/** 刊记行间隔符 */
	colophonSep: " · ",
} as const;

/** opt-in 实验项:DECDHL 倍高渲染格言行(默认关闭,不做终端能力检测,由用户自行开关;与疏排叠加)。 */
const MOTTO_DOUBLE_HEIGHT = false;

/** 语义槽:theme json 中定义,extension 一律通过 theme.fg 取色,不出现 hex。 */
type Slot = "text" | "accent" | "dim" | "dimmer" | "mid";

interface Segment {
	text: string;
	slot?: Slot;
	bold?: boolean;
}

interface SplashLine {
	segments: Segment[];
}

interface ThemeLike {
	fg(slot: string, text: string): string;
	bold(text: string): string;
}

// ============================================================================
// 取色:theme.fg(<语义槽>)。版式常量见 LAYOUT。
//
// dimmer / mid 为 motto 主题私有槽,内置主题(如 pi 自带 dark/light)没有;
// pi 的 theme.fg 对未知槽抛错,故与 review-flow 同宗做法:探测后按链降级,
// 非 motto 主题下静默降级到 dim,绝不崩 splash/footer。
// ============================================================================

type Color = (slot: string, text: string) => string;

type ColorKit = { fg: Color; bold: (text: string) => string };

function createColorKit(theme: ThemeLike): ColorKit {
	const probe = (slot: string): boolean => {
		try {
			theme.fg(slot, "");
			return true;
		} catch {
			return false;
		}
	};
	const has: Record<string, boolean> = {
		text: probe("text"),
		dim: probe("dim"),
		dimmer: probe("dimmer"),
		mid: probe("mid"),
		accent: probe("accent"),
	};
	const chain: Record<string, Slot[]> = {
		text: ["text"],
		dim: ["dim", "text"],
		dimmer: ["dimmer", "dim", "text"],
		mid: ["mid", "dim", "text"],
		accent: ["accent", "text"],
	};
	return {
		fg: (slot, text) => {
			for (const candidate of chain[slot]) {
				if (has[candidate]) return theme.fg(candidate, text);
			}
			return text;
		},
		bold: (text) => theme.bold(text),
	};
}

export function makeColor(theme: ThemeLike): ColorKit {
	return createColorKit(theme);
}

export function readMotto(): string | undefined {
	const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	try {
		const raw = readFileSync(join(agentDir, "motto"), "utf8");
		const line = raw.split(/\r?\n/, 1)[0];
		return line.length > 0 ? line : undefined;
	} catch {
		return undefined;
	}
}

export function modelId(model: { id?: unknown } | undefined): string | undefined {
	const id = typeof model?.id === "string" ? model.id.trim() : "";
	return id && id !== "unknown" && id !== "no-model" ? id : undefined;
}

export function localIsoDate(date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

type MottoTitleContext = Pick<ExtensionContext, "mode" | "ui">;

// ============================================================================
// 终端标题:固定 "Motto"。pi 原生在启动(init / resetExtensionUI)与
// session_info_changed 时写 "π - ...",我们用「事件后延迟覆盖 + 周期守护」保证稳定。
// 退出行为:pi 在 session_shutdown 之后还会经 resetExtensionUI 再写一次 "π - ...",
// 且 ghostty 1.3.1 不实现标题栈(stream_handler.zig 中 CSI 22/23t 为空操作),
// 因此退出后标题无法恢复为终端默认,保持 pi 最后一次写入("π - ...")。
// ============================================================================
const TERMINAL_TITLE = "Motto";
const TITLE_REASSERT_INTERVAL_MS = 1000;
/** 标题周期守护的存活期:仅覆盖启动期(pi 在启动/重绑时多次写 "π - ..."),到期自停。 */
const TITLE_WATCHDOG_TTL_MS = 5000;

/** delayMs 毫秒后把标题重设为 "Motto"(让 pi 的同步标题写入先落盘,我们再覆盖)。 */
export function reassertMottoTitle(ctx: MottoTitleContext, delayMs = 0): void {
	setTimeout(() => {
		try {
			if (ctx.mode === "tui") ctx.ui.setTitle(TERMINAL_TITLE);
		} catch {
			// 会话切换/退出后 ctx 失效,忽略。
		}
	}, delayMs);
}

/** 周期重设标题,仅兜底启动期(5 秒后自停);此后依赖事件钩子重设。返回停止函数。 */
export function startTitleWatchdog(ctx: MottoTitleContext): () => void {
	const timer = setInterval(() => {
		try {
			if (ctx.mode === "tui") ctx.ui.setTitle(TERMINAL_TITLE);
		} catch {
			clearInterval(timer);
		}
	}, TITLE_REASSERT_INTERVAL_MS);
	const ttl = setTimeout(() => clearInterval(timer), TITLE_WATCHDOG_TTL_MS);
	return () => {
		clearInterval(timer);
		clearTimeout(ttl);
	};
}

// ============================================================================
// facts 采集:context / skills / extensions / themes
// ============================================================================

interface SplashFacts {
	context: string[];
	skills: string[];
	extensions: string[];
	themes: string[];
}

function agentDir(): string {
	return process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
}

/** settings.json 中 packages 数组(npm 包,按声明顺序)。 */
function readSettingsPackages(): string[] {
	try {
		const raw = readFileSync(join(agentDir(), "settings.json"), "utf8");
		const parsed = JSON.parse(raw) as { packages?: unknown };
		if (!Array.isArray(parsed.packages)) return [];
		return parsed.packages.filter((p): p is string => typeof p === "string");
	} catch {
		return [];
	}
}

/** 末段短名:"npm:@narumitw/pi-lsp:src" → "pi-lsp"。 */
function shortName(name: string): string {
	let value = name.startsWith("npm:") ? name.slice(4) : name;
	if (value.startsWith("@")) {
		const slash = value.indexOf("/");
		if (slash !== -1) value = value.slice(slash + 1);
	}
	const colon = value.indexOf(":");
	if (colon !== -1) value = value.slice(0, colon);
	return value;
}

function listSkillDirs(): string[] {
	try {
		const dir = join(agentDir(), "skills");
		return readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md")))
			.map((entry) => entry.name)
			.sort();
	} catch {
		return [];
	}
}

function listExtensionNames(): string[] {
	try {
		const dir = join(agentDir(), "extensions");
		const names = new Set<string>();
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isFile() && entry.name.endsWith(".ts")) names.add(entry.name.slice(0, -3));
			else if (entry.isDirectory() && existsSync(join(dir, entry.name, "index.ts"))) names.add(entry.name);
		}
		return [...names].sort();
	} catch {
		return [];
	}
}

function listThemeNames(): string[] {
	try {
		return readdirSync(join(agentDir(), "themes"))
			.filter((file) => file.endsWith(".json"))
			.map((file) => basename(file, ".json"))
			.sort();
	} catch {
		return [];
	}
}

/** context 文件:agent 目录 AGENTS.md 优先(显示 basename,home 页收敛到 motto 身份),否则 cwd 下 AGENTS.md;相对 cwd 显示。 */
function contextFilePath(cwd: string): string | undefined {
	const agentFile = join(agentDir(), "AGENTS.md");
	if (existsSync(agentFile)) return basename(agentFile);
	const cwdFile = join(cwd, "AGENTS.md");
	return existsSync(cwdFile) ? relative(cwd, cwdFile) : undefined;
}

export function collectFacts(cwd: string): SplashFacts {
	const context: string[] = [];
	const contextFile = contextFilePath(cwd);
	if (contextFile) context.push(contextFile);
	// 项目本地域:`.motto/agent.md` 存在时并入 context 行(与 AGENTS.md 并列),本地域可见。
	if (existsSync(join(cwd, ".motto", "agent.md"))) context.push(".motto/agent.md");
	return {
		context,
		skills: listSkillDirs(),
		extensions: [...readSettingsPackages().map(shortName), ...listExtensionNames()],
		themes: listThemeNames(),
	};
}

// ============================================================================
// 格言疏排:仅相邻两个 CJK 字素之间插空格;拉丁词/数字内部不拆。
// ============================================================================

const CJK_SCRIPT_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** 共享字素切分器(标准 Intl API,无新依赖)。 */
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function isCjk(ch: string): boolean {
	return CJK_SCRIPT_RE.test(ch);
}

function spacedInscription(text: string): string {
	const chars = Array.from(GRAPHEME_SEGMENTER.segment(text), (s) => s.segment);
	let out = "";
	for (let i = 0; i < chars.length; i++) {
		out += chars[i];
		if (i + 1 < chars.length && isCjk(chars[i]) && isCjk(chars[i + 1])) out += " ";
	}
	return out;
}

// ============================================================================
// 折行与宽度:一律用显示宽度(pi-tui visibleWidth,CJK 每字 2 列)。
// ============================================================================

/** 硬折行,优先在空格处断;每段显示宽度 ≤ width。 */
function hardWrap(text: string, width: number): string[] {
	if (width <= 0) return [text];
	const chunks: string[] = [];
	let rest = text;
	while (rest.length > 0) {
		if (visibleWidth(rest) <= width) {
			chunks.push(rest);
			break;
		}
		let used = 0;
		let offset = 0;
		let lastSpace = -1; // 最后一个可断空格之后的字符偏移
		for (const ch of rest) {
			const chWidth = visibleWidth(ch);
			if (used + chWidth > width) break;
			used += chWidth;
			offset += ch.length;
			if (ch === " ") lastSpace = offset;
		}
		if (offset === 0) {
			// 单字符已超宽(极窄窗口),取一个字符避免死循环
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
	return chunks;
}

/** 条目按 itemSep 连接折行:断点优先在 · 处,续行由调用方悬挂到内容列。 */
function wrapContent(items: string[], availableWidth: number): string[] {
	if (items.length === 0) return [];
	if (availableWidth <= 0) return [items.join(LAYOUT.itemSep)];
	const sepWidth = visibleWidth(LAYOUT.itemSep);
	const lines: string[] = [];
	let current = "";
	let currentWidth = 0;
	for (const item of items) {
		const itemWidth = visibleWidth(item);
		if (current === "") {
			current = item;
			currentWidth = itemWidth;
		} else if (currentWidth + sepWidth + itemWidth <= availableWidth) {
			current += LAYOUT.itemSep + item;
			currentWidth += sepWidth + itemWidth;
		} else {
			lines.push(current);
			current = item;
			currentWidth = itemWidth;
		}
	}
	if (current !== "") lines.push(current);
	const out: string[] = [];
	for (const line of lines) {
		if (visibleWidth(line) <= availableWidth) {
			out.push(line);
		} else {
			out.push(...hardWrap(line, availableWidth));
		}
	}
	return out;
}

// ============================================================================
// splash 版式装配
// ============================================================================

function blankLine(): SplashLine {
	return { segments: [] };
}

function seg(text: string, slot?: Slot, bold = false): Segment {
	return { text, slot, bold };
}

/** DECDHL 倍高:每行输出为 \x1b#3(上)+ \x1b#4(下)两行,同内容。 */
function doubleHeight(lines: SplashLine[]): SplashLine[] {
	const out: SplashLine[] = [];
	for (const line of lines) {
		out.push({ segments: [{ text: "\x1b#3" }, ...line.segments] });
		out.push({ segments: [{ text: "\x1b#4" }, ...line.segments] });
	}
	return out;
}

export function buildSplash(
	inscription: string | undefined,
	model: string | undefined,
	date: string | undefined,
	facts: SplashFacts,
	width: number,
): SplashLine[] {
	const blocks: SplashLine[][] = [];

	// 1. 标题行:motto 顶格 accent bold,两空格后格言 text bold,格言逐字疏排(仅 CJK 间插空格);
	//    超宽则格言折行悬挂;MOTTO_DOUBLE_HEIGHT 开启时以 DECDHL 倍高渲染(上下两行同内容)。
	if (inscription) {
		const titleStart = visibleWidth("motto") + LAYOUT.titleGap;
		const titleAvailable = Math.max(0, width - titleStart);
		const displayInscription = spacedInscription(inscription);
		const fullTitle = `motto${" ".repeat(LAYOUT.titleGap)}${displayInscription}`;
		const titleLines: SplashLine[] = [{
			segments: [
				seg("motto", "accent", true),
				seg(" ".repeat(LAYOUT.titleGap)),
				seg(displayInscription, "text", true),
			],
		}];
		if (visibleWidth(fullTitle) > width) {
			const chunks = hardWrap(displayInscription, titleAvailable);
			titleLines[0] = {
				segments: [
					seg("motto", "accent", true),
					seg(" ".repeat(LAYOUT.titleGap)),
					seg(chunks[0] ?? "", "text", true),
				],
			};
			for (const chunk of chunks.slice(1)) {
				titleLines.push({
					segments: [
						seg(" ".repeat(titleStart)),
						seg(chunk, "text", true),
					],
				});
			}
		}
		blocks.push(MOTTO_DOUBLE_HEIGHT ? doubleHeight(titleLines) : titleLines);
	}

	// 2. 刊记行:model · date,mid 色,缩进 3。
	const colophon = [model, date].filter((v): v is string => Boolean(v)).join(LAYOUT.colophonSep);
	if (colophon) {
		blocks.push([{
			segments: [
				seg(" ".repeat(LAYOUT.colophonIndent)),
				seg(colophon, "mid"),
			],
		}]);
	}

	// 3. facts 明细:标签列 dimmer(固定 12 列),内容列 dim(第 15 列起)。
	const factEntries: Array<{ label: string; items: string[] }> = [];
	if (facts.context.length > 0) factEntries.push({ label: "context", items: facts.context });
	if (facts.skills.length > 0) factEntries.push({ label: "skills", items: facts.skills });
	if (facts.extensions.length > 0) factEntries.push({ label: "extensions", items: facts.extensions });
	if (facts.themes.length > 0) factEntries.push({ label: "themes", items: facts.themes });
	if (factEntries.length > 0) {
		const availableWidth = Math.max(0, width - LAYOUT.contentCol);
		const factLines: SplashLine[] = [];
		for (const entry of factEntries) {
			const contentLines = wrapContent(entry.items, availableWidth);
			const label = entry.label.padEnd(LAYOUT.labelWidth);
			factLines.push({
				segments: [
					seg(" ".repeat(LAYOUT.labelIndent)),
					seg(label, "dimmer"),
					seg(contentLines[0] ?? "", "dim"),
				],
			});
			for (const content of contentLines.slice(1)) {
				factLines.push({
					segments: [
						seg(" ".repeat(LAYOUT.contentCol)),
						seg(content, "dim"),
					],
				});
			}
		}
		blocks.push(factLines);
	}

	if (blocks.length === 0) return [];

	// 顶部空行 + 块间空行(块内不空);splash 块与后续内容之间保留 1 空行。
	const lines: SplashLine[] = [];
	for (let i = 0; i < LAYOUT.topBlank; i++) lines.push(blankLine());
	for (const block of blocks) {
		if (lines.length > LAYOUT.topBlank) {
			for (let i = 0; i < LAYOUT.blockGap; i++) lines.push(blankLine());
		}
		lines.push(...block);
	}
	for (let i = 0; i < LAYOUT.blockGap; i++) lines.push(blankLine());
	return lines;
}

export function renderLine(line: SplashLine, color: ColorKit): string {
	return line.segments
		.map((s) => {
			let text = s.text;
			if (s.bold) text = color.bold(text);
			if (s.slot) text = color.fg(s.slot, text);
			return text;
		})
		.join("");
}

// ============================================================================
// Footer 单行:左簇(cwd · stats)+ 右簇(model · thinking),右对齐。
// 数据与 pi 原生 footer 同一来源(会话 entries + getContextUsage),渲染时实时计算,
// 沿用原生刷新时机,不新增定时器;原生 • 一律替换为 ·。
// ============================================================================

/** 与原生 footer 完全一致的 token 紧凑格式。 */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/** 与原生 footer 完全一致的 cwd 缩略(home → ~)。 */
function formatCwdForFooter(cwd: string, home: string | undefined): string {
	if (!home) return cwd;
	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const relativeToHome = relative(resolvedHome, resolvedCwd);
	const isInsideHome =
		relativeToHome === "" ||
		(relativeToHome !== ".." && !relativeToHome.startsWith(`..${sep}`) && !isAbsolute(relativeToHome));
	if (!isInsideHome) return cwd;
	return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

/** 会话用量累计 + 最新 cache 命中率(原生 footer 同款循环,取自同一会话 entries)。 */
function computeUsageTotals(entries: readonly SessionEntry[]): {
	totals: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number };
	latestCacheHitRate: number | undefined;
} {
	const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
	let latestCacheHitRate: number | undefined;
	const add = (usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: { total: number } }) => {
		totals.input += usage.input;
		totals.output += usage.output;
		totals.cacheRead += usage.cacheRead;
		totals.cacheWrite += usage.cacheWrite;
		totals.cost += usage.cost.total;
	};
	for (const entry of entries) {
		if (entry.type === "message" && entry.message.role === "assistant") {
			const usage = entry.message.usage;
			add(usage);
			const latestPromptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
			latestCacheHitRate = latestPromptTokens > 0 ? (usage.cacheRead / latestPromptTokens) * 100 : undefined;
		} else if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.usage) {
			add(entry.message.usage);
		} else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
			add(entry.usage);
		}
	}
	return { totals, latestCacheHitRate };
}

/** auto-compact 状态:settings.json compaction.enabled,缺省 true(与 SettingsManager 同缺省)。 */
function autoCompactEnabled(): boolean {
	try {
		const parsed = JSON.parse(readFileSync(join(agentDir(), "settings.json"), "utf8")) as {
			compaction?: { enabled?: boolean };
		};
		return parsed.compaction?.enabled ?? true;
	} catch {
		return true;
	}
}

/** 左簇统计段。priority 为显式降级优先级(值越大越晚丢弃)。 */
export interface FooterStat {
	priority: number;
	text: string;
}

/** 按显示宽度截断,省略号(…)收尾,保证可见宽 ≤ width;已适配则原样返回。width ≤ 省略号宽时退化为省略号。 */
export function truncateToWidth(text: string, width: number): string {
	const ELLIPSIS = "…";
	const ellipsisWidth = visibleWidth(ELLIPSIS);
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	if (width <= ellipsisWidth) return ELLIPSIS;
	const budget = width - ellipsisWidth;
	let out = "";
	let used = 0;
	for (const ch of text) {
		const w = visibleWidth(ch);
		if (used + w > budget) break;
		out += ch;
		used += w;
	}
	return out + ELLIPSIS;
}

/**
 * 左簇降级(显式规则,不依赖偶然的字符串长度):
 *   统计段按信息价值排序,低者先弃:
 *     $cost(记账,价值最低)→ CH/W(缓存细节)→ TPS/R(缓存读取)→ ↑/↓(吞吐)→ context%(操作最关键的指标,最后保);
 *   pwd 永不主动弃;仅剩 pwd 仍超宽时截断(… 收尾)兜底。
 * 同优先级弃更靠右者,保持信息段左聚。返回串可见宽 ≤ width。
 */
export function degradeLeft(pwd: string, stats: readonly FooterStat[], width: number): string {
	const items: Array<{ text: string; priority: number }> = [
		{ text: pwd, priority: Number.POSITIVE_INFINITY },
		...stats,
	];
	const join = () => items.map((s) => s.text).join(LAYOUT.itemSep);
	let text = join();
	while (visibleWidth(text) > width && items.length > 1) {
		let dropIndex = -1;
		let dropPriority = Number.POSITIVE_INFINITY;
		for (let i = 1; i < items.length; i++) {
			const p = items[i].priority;
			if (p < dropPriority) {
				dropPriority = p;
				dropIndex = i;
			} else if (p === dropPriority && i > dropIndex) {
				dropIndex = i;
			}
		}
		if (dropIndex <= 0) break;
		items.splice(dropIndex, 1);
		text = join();
	}
	if (visibleWidth(text) > width) {
		text = truncateToWidth(text, width);
	}
	return text;
}

function buildFooterStats(
	ctx: ExtensionContext,
	footerData: ReadonlyFooterDataProvider,
	tpsText: string | undefined,
	width: number,
): { pwd: string; stats: FooterStat[] } {
	let pwd = formatCwdForFooter(ctx.sessionManager.getCwd(), process.env.HOME || process.env.USERPROFILE);
	const branch = footerData.getGitBranch();
	if (branch) pwd = `${pwd} (${branch})`;
	const sessionName = ctx.sessionManager.getSessionName();
	if (sessionName) pwd = `${pwd} · ${sessionName}`;
	const { totals, latestCacheHitRate } = computeUsageTotals(ctx.sessionManager.getEntries());
	const stats: FooterStat[] = [];
	if (totals.input) stats.push({ priority: 4, text: `↑${formatTokens(totals.input)}` });
	if (totals.output) stats.push({ priority: 4, text: `↓${formatTokens(totals.output)}` });
	if (totals.cacheRead) stats.push({ priority: 3, text: `R${formatTokens(totals.cacheRead)}` });
	// TPS 瞬态指标:与 R 同级(priority 3),排其后 → 窄宽时先于 R 被弃。
	if (tpsText) stats.push({ priority: 3, text: tpsText });
	if (totals.cacheWrite) stats.push({ priority: 2, text: `W${formatTokens(totals.cacheWrite)}` });
	if ((totals.cacheRead > 0 || totals.cacheWrite > 0) && latestCacheHitRate !== undefined) {
		stats.push({ priority: 2, text: `CH${latestCacheHitRate.toFixed(1)}%` });
	}
	const usingSubscription = ctx.model?.provider === "kimi-coding" || false;
	if (totals.cost || usingSubscription) {
		stats.push({ priority: 1, text: `$${totals.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}` });
	}
	// MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1 (decision §9):extension statuses 投影进单行。
	// 按 key 稳定排序（localeCompare），值与原生 footer 同语义清理，itemSep 连接为一个段；
	// 段内先做 bounded truncate（上限 = max(8, width/3)，…收尾），再放在 TPS 后以同级
	// priority 3 参与 degradeLeft：同级先弃更靠右者，故普通 status 先于 TPS/R 降级；不恢复
	// 原生多行 footer。
	const extensionStatuses = footerData.getExtensionStatuses();
	if (extensionStatuses.size > 0) {
		const joined = Array.from(extensionStatuses.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, text]) => sanitizeStatusText(text))
			.join(LAYOUT.itemSep);
		stats.push({ priority: 3, text: truncateToWidth(joined, Math.max(8, Math.floor(width / 3))) });
	}
	const contextUsage = ctx.getContextUsage();
	const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	const contextPercentValue = contextUsage?.percent ?? 0;
	const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";
	const autoIndicator = autoCompactEnabled() ? " (auto)" : "";
	const contextPercentDisplay =
		contextPercent === "?" ? `?/${formatTokens(contextWindow)}${autoIndicator}` : `${contextPercent}%/${formatTokens(contextWindow)}${autoIndicator}`;
	stats.push({ priority: 5, text: contextPercentDisplay });
	return { pwd, stats };
}

export function buildFooterLine(
	color: ColorKit,
	ctx: ExtensionContext,
	footerData: ReadonlyFooterDataProvider,
	width: number,
	tpsText?: string,
): string {
	// 左簇:cwd(含 branch / session,•→·)+ " · " + stats。
	const { pwd, stats } = buildFooterStats(ctx, footerData, tpsText, width);

	// 右簇:(provider) model · thinking(多 provider 时加 provider 括号,同原生 footer 规则;
	// thinking 仅 reasoning 模型显示)。
	const modelName = ctx.model?.id || "no-model";
	const thinking = ctx.model?.reasoning ? ctx.thinkingLevel || "off" : undefined;
	const providerPrefix =
		footerData.getAvailableProviderCount() > 1 && ctx.model ? `(${ctx.model.provider}) ` : "";

	// 折叠优先级(2026-08-13 厘清):优先折叠模型信息以外的——左簇统计段按显式
	// 优先级降级(degradeLeft)→ pwd 截断;最后才折模型信息(去 thinking → 截模型名)。
	const minGap = 2;
	let rightText = providerPrefix + (thinking ? `${modelName} · ${thinking}` : modelName);
	let rightWidth = visibleWidth(rightText);
	let left = degradeLeft(pwd, stats, Math.max(1, width - minGap - rightWidth));
	let leftWidth = visibleWidth(left);
	if (leftWidth + minGap + rightWidth > width) {
		// 左簇降无可降仍放不下 → 折模型信息:去 thinking。
		rightText = providerPrefix + modelName;
		rightWidth = visibleWidth(rightText);
		left = degradeLeft(pwd, stats, Math.max(1, width - minGap - rightWidth));
		leftWidth = visibleWidth(left);
	}
	if (leftWidth + minGap + rightWidth > width) {
		// 最后防线:截模型名(… 收尾);预算为负则右簇整体省略。
		const rightBudget = width - minGap - leftWidth;
		if (rightBudget <= 0) {
			rightText = "";
			rightWidth = 0;
		} else {
			rightText = truncateToWidth(rightText, rightBudget);
			rightWidth = visibleWidth(rightText);
		}
	}
	const gap = rightText ? Math.max(minGap, width - leftWidth - rightWidth) : 0;

	// 整行 dim;右簇 model 名 mid 稍突出,其余 dim;不得使用 text / accent。
	const modelPart = rightText.startsWith(modelName) ? modelName : "";
	const rest = rightText.slice(modelPart.length);
	const leftColored = color.fg("dim", left);
	const rightColored = rightText ? color.fg("mid", modelPart) + (rest ? color.fg("dim", rest) : "") : "";
	return leftColored + " ".repeat(Math.max(0, gap)) + rightColored;
}

// ============================================================================
// TPS(输出 token 吞吐,单位 tokens/sec)—— footer 左簇新增指标。
//
// 窗口 = 一次 assistant 回答(message_start → message_end)。
// 流式期滚动速率 = produced / ((lastProducedAt − startAt)/1000):lastProducedAt 锚定最近一次
//   产出 token 的时刻,工具执行期无产出 → 分母自然冻结,速率停在最后值(「工具期分母不涨」)。
// 结算(message_end)转均值 = usage.output / 窗口时长;展示直到新窗口或 TTL 到期。
// 流式期以 ~ 前缀标注(按 delta 长度估算),结算后为 usage.output 精确均值。
// 除零/非有限值一律不显示(无 NaN/∞)。
// ============================================================================

/** 结算均值展示存活期:TTL 内展示,过后自然隐藏(避免永久残留过期速率)。 */
const TPS_SETTLED_TTL_MS = 60_000;

/** 与原生 footer 同语义：去换行/制表/回车、折叠连续空格（单行展示用）。 */
function sanitizeStatusText(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

export interface TpsSnapshot {
	/** 展示文本,如 "~42 t/s"(流式)或 "38 t/s"(已结算)。 */
	text: string;
	streaming: boolean;
}

export interface TpsTracker {
	onMessageStart(): void;
	onMessageUpdate(deltaTokens: number, usageOutput?: number): void;
	onMessageEnd(usageOutput?: number): void;
	snapshot(now?: number): TpsSnapshot | undefined;
	/** 测试用:清空窗口状态。 */
	_reset(): void;
}

/** 可注入时钟的 TPS 追踪器(测试用假时钟驱动流式/结算/工具期)。 */
export function createTpsTracker(now: () => number = Date.now): TpsTracker {
	let startAt = 0;
	let lastProducedAt = 0;
	let produced = 0;
	let streaming = false;
	let settled: { rate: number; at: number } | undefined;

	const ratePerSec = (tokens: number, start: number, end: number): number | undefined => {
		const elapsed = (end - start) / 1000;
		if (!Number.isFinite(elapsed) || elapsed <= 0) return undefined;
		const rate = tokens / elapsed;
		return Number.isFinite(rate) && rate >= 0 ? rate : undefined;
	};

	const formatRate = (rate: number): string => {
		if (rate < 10) return rate.toFixed(1);
		if (rate < 1000) return String(Math.round(rate));
		return formatTokens(Math.round(rate));
	};

	const open = () => {
		startAt = now();
		lastProducedAt = startAt;
		produced = 0;
		streaming = true;
		settled = undefined;
	};

	return {
		onMessageStart() {
			open();
		},
		onMessageUpdate(deltaTokens, usageOutput) {
			if (!streaming) open();
			const usage = Number(usageOutput);
			if (Number.isFinite(usage) && usage > produced) {
				produced = usage;
				lastProducedAt = now();
			}
			const delta = Number(deltaTokens);
			if (Number.isFinite(delta) && delta > 0) {
				produced += delta;
				lastProducedAt = now();
			}
			// 无实际产出(delta=0,如 tool-arg 流式)时不推进 lastProducedAt → 分母冻结。
		},
		onMessageEnd(usageOutput) {
			const usage = Number(usageOutput);
			if (Number.isFinite(usage) && usage > 0) produced = usage;
			const end = now();
			const rate = ratePerSec(produced, startAt, end);
			if (rate !== undefined) settled = { rate, at: end };
			streaming = false;
		},
		snapshot(at) {
			const t = at ?? now();
			if (streaming) {
				const rate = ratePerSec(produced, startAt, lastProducedAt);
				if (rate === undefined || produced <= 0) return undefined;
				return { text: `~${formatRate(rate)} t/s`, streaming: true };
			}
			if (settled) {
				if (t - settled.at > TPS_SETTLED_TTL_MS) return undefined;
				return { text: `${formatRate(settled.rate)} t/s`, streaming: false };
			}
			return undefined;
		},
		_reset() {
			startAt = 0;
			lastProducedAt = 0;
			produced = 0;
			streaming = false;
			settled = undefined;
		},
	};
}
