// TPS(footer 输出 token 吞吐)单元测试 —— 五专项判定:
//   流式滚动 / 结算转均值 / 工具期分母不涨 / 窄宽按序被弃 / 无 NaN·∞。
// 运行:cd ~/.pi/agent && node --test notes/tps.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTpsTracker, degradeLeft } from "../core.ts";

/** 手动时钟:精确驱动流式/结算/工具期的时间轴。 */
function makeClock() {
	let t = 0;
	return { now: () => t, advance: (ms) => { t += ms; } };
}

test("流式滚动:窗口内滚动速率随 token/时间推进", () => {
	const c = makeClock();
	const tps = createTpsTracker(c.now);
	tps.onMessageStart(); // t=0
	c.advance(500);
	tps.onMessageUpdate(25); // t=500, produced=25 → 25/0.5 = 50 t/s
	assert.equal(tps.snapshot(c.now())?.text, "~50 t/s");
	c.advance(500);
	tps.onMessageUpdate(25); // t=1000, produced=50 → 50/1.0 = 50 t/s
	assert.equal(tps.snapshot(c.now())?.text, "~50 t/s");
	c.advance(1000);
	tps.onMessageUpdate(100); // t=2000, produced=150 → 150/2.0 = 75 t/s
	assert.equal(tps.snapshot(c.now())?.text, "~75 t/s");
});

test("结算转均值:message_end 以 usage.output 精确均值替代流式估算", () => {
	const c = makeClock();
	const tps = createTpsTracker(c.now);
	tps.onMessageStart(); // t=0
	c.advance(1000);
	tps.onMessageUpdate(40); // 流式估算
	c.advance(1000);
	tps.onMessageUpdate(40); // 流式估算 80
	c.advance(1000);
	tps.onMessageEnd(120); // t=3000,精确 usage=120 → 120/3.0 = 40 t/s
	const s = tps.snapshot(c.now());
	assert.equal(s?.streaming, false);
	assert.equal(s?.text, "40 t/s");
	// 均值不含 ~ 前缀(已结算)。
	assert.ok(!s.text.startsWith("~"));
});

test("工具期分母不涨:无产出时速率冻结,不随墙钟漂移", () => {
	const c = makeClock();
	const tps = createTpsTracker(c.now);
	// 流式期:两次 token 之间跨过长时间(工具/静默期),lastProducedAt 不推进 → 速率不变。
	tps.onMessageStart(); // t=0
	c.advance(1000);
	tps.onMessageUpdate(50); // 50/1.0 = 50 t/s
	const before = tps.snapshot(c.now())?.text;
	c.advance(10_000); // 工具执行 10s,无产出
	assert.equal(tps.snapshot(c.now())?.text, before, "流式期工具期分母不涨");
	// 结算后:工具期展示的均值恒定(TTL 内)。
	tps.onMessageEnd(50);
	const settled = tps.snapshot(c.now())?.text;
	c.advance(5_000); // 工具执行 5s
	assert.equal(tps.snapshot(c.now())?.text, settled, "结算后工具期速率恒定");
	// TTL 过后自然隐藏,不残留过期速率。
	c.advance(70_000);
	assert.equal(tps.snapshot(c.now()), undefined, "TTL 到期后隐藏");
});

test("窄宽按序被弃:TPS 与 R 同级、先于 R 被弃,后于 CH", () => {
	const PWD = "/private/tmp/motto-audit";
	const stats = [
		{ priority: 4, text: "↑135" },
		{ priority: 4, text: "↓18" },
		{ priority: 3, text: "R4.4k" },
		{ priority: 3, text: "~120 t/s" },
		{ priority: 2, text: "W2k" },
		{ priority: 2, text: "CH97.0%" },
		{ priority: 1, text: "$0.005" },
		{ priority: 5, text: "0.5%/1.0M (auto)" },
	];
	const FULL = `${PWD} · ↑135 · ↓18 · R4.4k · ~120 t/s · W2k · CH97.0% · $0.005 · 0.5%/1.0M (auto)`;
	const width = (s) => {
		// ASCII 全单列;直接量长度。
		return s.length;
	};
	const seen = [];
	let last;
	for (let w = FULL.length; w >= 1; w--) {
		const out = degradeLeft(PWD, stats, w);
		if (out !== last) {
			seen.push(out);
			last = out;
		}
	}
	const expected = [
		FULL,
		`${PWD} · ↑135 · ↓18 · R4.4k · ~120 t/s · W2k · CH97.0% · 0.5%/1.0M (auto)`, // 弃 $
		`${PWD} · ↑135 · ↓18 · R4.4k · ~120 t/s · W2k · 0.5%/1.0M (auto)`, // 弃 CH
		`${PWD} · ↑135 · ↓18 · R4.4k · ~120 t/s · 0.5%/1.0M (auto)`, // 弃 W
		`${PWD} · ↑135 · ↓18 · R4.4k · 0.5%/1.0M (auto)`, // 弃 TPS(先于 R)
		`${PWD} · ↑135 · ↓18 · 0.5%/1.0M (auto)`, // 弃 R
		`${PWD} · ↑135 · 0.5%/1.0M (auto)`, // 弃 ↓
		`${PWD} · 0.5%/1.0M (auto)`, // 弃 ↑(context% 最后保)
		PWD, // 弃 context%,仅剩 pwd
	];
	assert.deepEqual(seen.slice(0, expected.length), expected);
});

test("无 NaN/∞:空窗口、零产出、非有限 usage 均不产生非法显示", () => {
	const c = makeClock();
	const tps = createTpsTracker(c.now);
	// 无窗口。
	assert.equal(tps.snapshot(c.now()), undefined);
	// 立即结算且零产出。
	tps.onMessageStart();
	tps.onMessageEnd(0);
	assert.equal(tps.snapshot(c.now()), undefined);
	// 流式但零产出。
	tps.onMessageStart();
	assert.equal(tps.snapshot(c.now()), undefined);
	// 非有限 usage 不进入、不炸;delta 兜底仍在。
	c.advance(1000);
	tps.onMessageUpdate(10, Number.NaN);
	c.advance(1000);
	tps.onMessageUpdate(10, Number.POSITIVE_INFINITY);
	const s = tps.snapshot(c.now());
	assert.ok(s, "delta 兜底仍出值");
	assert.ok(!s.text.includes("NaN") && !s.text.includes("∞") && !s.text.includes("Infinity"));
	// 结算用非有限 usage 时保留已产出,不产生 ∞。
	tps.onMessageEnd(Number.POSITIVE_INFINITY);
	const settled = tps.snapshot(c.now());
	assert.ok(settled && !settled.text.includes("∞") && !settled.text.includes("Infinity"), "结算不产生 ∞");
	// 负时间差不产生负速率。
	tps._reset();
	c.advance(-1);
	tps.onMessageStart();
	assert.equal(tps.snapshot(c.now()), undefined);
});

test("footer 集成:TPS 文本进入左簇统计且不破宽度上界", async () => {
	const { buildFooterLine, makeColor } = await import("../core.ts");
	const { visibleWidth } = await import("@earendil-works/pi-tui");
	const color = makeColor({ fg: (s, t) => t, bold: (t) => t });
	const ctx = {
		sessionManager: {
			getCwd: () => "/private/tmp/motto-audit",
			getSessionName: () => undefined,
			getEntries: () => [
				{ type: "message", message: { role: "assistant", usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } } } },
			],
		},
		model: { id: "deepseek-v4-flash", provider: "deepseek", reasoning: true, contextWindow: 1000000 },
		thinkingLevel: "max",
		getContextUsage: () => ({ contextWindow: 1000000, percent: 0.5 }),
	};
	const footerData = { getGitBranch: () => undefined };
	for (const width of [40, 60, 66, 80, 200]) {
		const line = buildFooterLine(color, ctx, footerData, width, "~42 t/s");
		assert.ok(visibleWidth(line) <= width, `w=${width} 超宽 ${visibleWidth(line)}`);
	}
	// 宽列下 TPS 段在左簇可见;窄列按序被弃(由上一用例覆盖)。
	for (const width of [80, 200]) {
		const line = buildFooterLine(color, ctx, footerData, width, "~42 t/s");
		assert.ok(line.includes("t/s"), `w=${width} 缺 TPS 段`);
	}
});
