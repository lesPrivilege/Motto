// motto-layout.ts — Motto transcript 视觉构成（TUI-1）共享布局常量。
//
// 布局文法（MOTTO_TUI_CORE）：界栏非装饰框——user 消息逐行左界栏 `│ `，
// 正文列左锚于界栏之后；assistant / tool 目行 / review recap 对齐同一正文列。
// 标识符与文案使用现代 CS 用语（不引入仿古词）。
//
// 用色槽位：界栏 = muted（Motto 主题映射 mid 中灰；默认主题映射 gray）。
// I6-4 就地界定：`│ ` 为显示投影，会随拖选进入剪贴板，侧车落地前不宣称保真。

/** 界栏宽度（显示列）：`│ ` = 1 界栏符 + 1 空格。 */
export const GUTTER_WIDTH = 2;

/** 界栏字符串（显示投影，非语义源）。 */
export const GUTTER = "│ ";

/** 正文列缩进（= 界栏宽度），user / assistant / tool / recap 对齐点。 */
export const BODY_INDENT = GUTTER_WIDTH;
