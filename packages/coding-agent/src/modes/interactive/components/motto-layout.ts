import { visibleWidth } from "@earendil-works/pi-tui";

// motto-layout.ts — Motto transcript 视觉构成（TUI-1）共享布局常量。
//
// 布局文法（MOTTO_TUI_CORE）：user 消息首行为左上方短横衬线 `───`（脚注分隔线
// 风格，tui-1-s1-r1 叠改，替代原首行竖界栏 `│ `），衬线独立成行、左锚、muted；
// 正文续行以 GUTTER_WIDTH 空格悬挂缩进对齐正文列；assistant / tool index /
// review recap 对齐同一正文列。
// 标识符与文案使用现代 CS 用语（不引入仿古词）。
//
// 用色槽位：衬线 = muted（Motto 主题映射 mid 中灰；默认主题映射 gray）。
// I6-4 就地界定：衬线为显示投影，会随拖选进入剪贴板，侧车落地前不宣称保真。

/** 悬挂缩进宽度（显示列）：正文列自第 3 列起。 */
export const GUTTER_WIDTH = 2;

/** user 消息左上方短横衬线（显示投影，非语义源）：3 × U+2500。 */
export const GUTTER_RULE = "───";

/** 正文列缩进（= gutter 宽度），user / assistant / tool / recap 对齐点。 */
export const BODY_INDENT = GUTTER_WIDTH;

/** 按显示宽度截断（超出以 `…` 收尾），CJK 双列计宽，ANSI 不计宽。 */
export function truncateVisible(text: string, width: number): string {
	if (width <= 0) return "";
	let result = "";
	for (const ch of text) {
		if (visibleWidth(result + ch) > width) break;
		result += ch;
	}
	return result.length < text.length ? `${result}…` : result;
}
