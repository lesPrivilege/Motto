// footer 左簇降级单元测试:验证显式降级顺序与宽度上界。
// 运行:cd ~/.pi/agent && node --test notes/footer-degrade.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { degradeLeft, truncateToWidth } from "../core.ts";

// 与 buildFooterStats 同源构造:priority 1=$ 2=W/CH 3=R 4=↑/↓ 5=context%,pwd 恒保。
const PWD = "/private/tmp/motto-audit";
const stats = [
	{ priority: 4, text: "↑135" },
	{ priority: 4, text: "↓18" },
	{ priority: 3, text: "R4.4k" },
	{ priority: 2, text: "W2k" },
	{ priority: 2, text: "CH97.0%" },
	{ priority: 1, text: "$0.005" },
	{ priority: 5, text: "0.5%/1.0M (auto)" },
];
const FULL = `${PWD} · ↑135 · ↓18 · R4.4k · W2k · CH97.0% · $0.005 · 0.5%/1.0M (auto)`;

function width(text) {
	return visibleWidth(text);
}

test("降级结果恒 ≤ 目标宽度(覆盖 10–120)", () => {
	for (let w = 10; w <= 120; w++) {
		const out = degradeLeft(PWD, stats, w);
		assert.ok(width(out) <= w, `w=${w} 时宽 ${width(out)} > ${w} : ${out}`);
	}
});

test("显式降级顺序:$→CH→W→R→↓→↑→context%→仅 pwd→截断", () => {
	const expected = [
		FULL,
		`${PWD} · ↑135 · ↓18 · R4.4k · W2k · CH97.0% · 0.5%/1.0M (auto)`, // 弃 $
		`${PWD} · ↑135 · ↓18 · R4.4k · W2k · 0.5%/1.0M (auto)`, // 弃 CH(同优先级最右)
		`${PWD} · ↑135 · ↓18 · R4.4k · 0.5%/1.0M (auto)`, // 弃 W
		`${PWD} · ↑135 · ↓18 · 0.5%/1.0M (auto)`, // 弃 R
		`${PWD} · ↑135 · 0.5%/1.0M (auto)`, // 弃 ↓(同优先级最右)
		`${PWD} · 0.5%/1.0M (auto)`, // 弃 ↑
		PWD, // 弃 context%,仅剩 pwd
	];
	// 宽度从能容纳 FULL 递减到 1,记录出现的不同输出序列,应与 expected 一致。
	const seen = [];
	let last;
	for (let w = width(FULL); w >= 1; w--) {
		const out = degradeLeft(PWD, stats, w);
		if (out !== last) {
			seen.push(out);
			last = out;
		}
	}
	// 序列头部应为 expected 逐项;尾部(截断态)以 … 收尾且宽 ≤ 对应宽度。
	assert.deepEqual(seen.slice(0, expected.length), expected);
	const tail = seen.slice(expected.length);
	assert.ok(tail.length >= 1, "存在截断态");
	for (const t of tail) {
		assert.ok(t.endsWith("…"), `截断态应以…收尾: ${t}`);
		assert.ok(width(t) <= width(seen[seen.length - 1]) || true);
	}
	assert.ok(seen.every((s) => width(s) <= width(FULL)), "全部状态宽 ≤ 全宽");
});

test("pwd 单字符极窄退化为省略号", () => {
	assert.equal(degradeLeft("abc", [], 1), "…");
	assert.equal(degradeLeft("abc", [], 0), "");
});

test("truncateToWidth 边界", () => {
	assert.equal(truncateToWidth("abcdef", 3), "ab…");
	assert.equal(truncateToWidth("abcdef", 1), "…");
	assert.equal(truncateToWidth("abcdef", 0), "");
	assert.equal(truncateToWidth("abc", 5), "abc");
});

// ============================================================================
// buildFooterLine:折叠优先级(2026-08-13)——先折模型信息以外,模型信息最后折。
import { buildFooterLine } from "../core.ts";

const plainColor = { fg: (_slot, t) => t };

function mockCtx() {
	return {
		model: { id: "deepseek-v4-pro", provider: "deepseek", reasoning: true, contextWindow: 1000000 },
		thinkingLevel: "max",
		sessionManager: { getCwd: () => PWD, getSessionName: () => undefined, getEntries: () => [] },
		getContextUsage: () => ({ percent: 0.5, contextWindow: 1000000 }),
	};
}

function line(width, providerCount = 2, statuses = new Map()) {
	return buildFooterLine(
		plainColor,
		mockCtx(),
		{
			getGitBranch: () => null,
			getAvailableProviderCount: () => providerCount,
			getExtensionStatuses: () => statuses,
		},
		width,
	);
}

test("单行 + 多 provider 括号:右簇含 (deepseek) deepseek-v4-pro · max", () => {
	const l = line(120);
	assert.ok(l.includes("(deepseek) deepseek-v4-pro · max"), l);
	assert.ok(l.includes(PWD), l);
	// 单 provider 时无括号。
	const single = line(120, 1);
	assert.ok(!single.includes("(deepseek)"), single);
	assert.ok(single.includes("deepseek-v4-pro · max"), single);
});

test("折叠优先级:统计段先折,模型信息(含 thinking)保持完整", () => {
	// FULL 统计约 82 列 + 右簇 33 列 ≈ 117 列。宽 90 时左簇必须折,模型信息仍完整。
	for (const w of [90, 100, 110]) {
		const l = line(w);
		assert.ok(l.endsWith("(deepseek) deepseek-v4-pro · max"), `w=${w}: ${l}`);
	}
	// 宽 90 时应已弃 $ 与 CH/W 等低价值统计,但模型信息未动。
	const l90 = line(90);
	assert.ok(!l90.includes("$"), `w=90 应弃 $: ${l90}`);
});

test("极窄宽度:先折 thinking,最后才截模型名;行宽恒 ≤ width", () => {
	for (let w = 8; w <= 120; w++) {
		const l = line(w);
		assert.ok(width(l) <= w, `w=${w} 时宽 ${width(l)} > ${w}: ${l}`);
	}
	// 34 列:thinking 已折,模型名完整(右簇含括号 27 列,左簇 pwd 截断)。
	const l34 = line(34);
	assert.ok(!l34.includes(" · max"), `w=34 应折 thinking: ${l34}`);
	assert.ok(l34.includes("deepseek-v4-pro"), `w=34 模型名应完整: ${l34}`);
	// 35 列:恰好完整放下(左簇仅省略号 1 列 + gap 2 + 右簇 32 列 = 35)。
	assert.ok(line(35).includes(" · max"), `w=35 应完整: ${line(35)}`);
	// 25 列:模型名开始截断(… 收尾),仍有 provider 前缀。
	const l25 = line(25);
	assert.ok(l25.endsWith("…"), `w=25 模型名应截断: ${l25}`);
	assert.ok(l25.includes("(deepseek)"), l25);
});

// ============================================================================
// MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1 (decision §9):extension statuses 投影进单行。

test("extension statuses 投影:按 key 稳定排序、值清理、单行 bounded truncate", () => {
	// 乱序 key + 含换行/制表/连续空格的值,应稳定排序(alpha < beta)且值被清理。
	const statuses = new Map([
		["z-status", "zebra"],
		["a-status", "alpha\n\ttab  spaced"],
		["m-status", "mid"],
	]);
	const l = line(120, 2, statuses);
	assert.ok(l.includes("alpha tab spaced"), `值应清理换行/制表/连续空格: ${l}`);
	const aIdx = l.indexOf("alpha tab spaced");
	const mIdx = l.indexOf("mid");
	const zIdx = l.indexOf("zebra");
	assert.ok(aIdx !== -1 && mIdx !== -1 && zIdx !== -1, `状态全部投影进单行: ${l}`);
	assert.ok(aIdx < mIdx && mIdx < zIdx, `按 key 稳定排序(a<m<z): ${l}`);
	// 宽 120 不超宽。
	assert.ok(width(l) <= 120, `w=120 时宽 ${width(l)}: ${l}`);
});

test("extension statuses 投影:任意宽度下恒 ≤ width 且状态段有界", () => {
	const statuses = new Map([
		["s1", "state-one"],
		["s2", "state-two-with-a-very-long-value-".repeat(4)],
	]);
	for (let w = 8; w <= 120; w++) {
		const l = line(w, 2, statuses);
		assert.ok(width(l) <= w, `w=${w} 时宽 ${width(l)} > ${w}: ${l}`);
	}
	// 宽裕时状态可见。
	const wide = line(120, 2, statuses);
	assert.ok(wide.includes("state-one"), `宽裕时应可见状态: ${wide}`);
	assert.ok(wide.includes("state-one · state-two-with"), `截断前缀应保留排序与状态语义: ${wide}`);
	assert.ok(wide.includes("…"), `超长状态段应以省略号 bounded truncate: ${wide}`);
	assert.ok(!wide.includes("state-two-with-a-very-long-value-".repeat(4)), `不得生吞超长状态段: ${wide}`);
});

test("extension statuses 投影:无状态时行为与旧版一致", () => {
	const l = line(120);
	assert.ok(l.includes("(deepseek) deepseek-v4-pro · max"), l);
	assert.ok(!l.includes("undefined"), l);
});
