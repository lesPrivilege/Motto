# motto-themes — Motto 主题(三 JSON)

Motto 系列主题文件:`motto.json`(基准单宗,dark 基底)、`motto-dark.json`、`motto-light.json`(深浅双宗)。

体例正典见仓内 [`docs/MOTTO.md`](../../docs/MOTTO.md)「颜色」节与「主题」节。

## 文件

| 文件 | name | 角色 |
|---|---|---|
| `motto.json` | motto | 基准单宗(历史唯一主题,dark 基底,vars 驱动) |
| `motto-dark.json` | motto-dark | 深宗(双宗之一) |
| `motto-light.json` | motto-light | 浅宗(双宗之一) |

## 语义槽

- 五主槽:`bg` / `text` / `accent` / `dim` / `dimmer`;另有 `mid`(双宗同值)。
- `dimmer`/`mid` 为 motto 私有槽:内置 dark/light 无此二槽,扩展侧静默降级到 dim(见 `motto` pack)。
- 其余 theme 字段按同一灰阶逻辑就近映射(syntax/markdown/thinking 等),不引入新色相。
- 色值只出现在本 pack 的 JSON 内;扩展代码无 hex。

## 部署位(与扩展部署位分开)

扩展部署位 = pi 扩展目录 `~/.pi/agent/extensions/`;**主题部署位 = pi 主题目录 `~/.pi/agent/themes/`**。
本 pack 无 `index.ts`、无二进制依赖、无 `checksums/`;由 `scripts/deploy.sh` 把三个 JSON 拷贝到主题目录。

## 测试

主题为声明式 JSON,无单测;验收 = 两宗切换版式逐字符一致 + 扩展侧取色不崩(见 `motto` pack 测试与 `reports/`)。

## 启用

```jsonc
// ~/.pi/agent/settings.json
{ "theme": "motto-light/motto-dark" }   // 双宗 auto
```

## 边界与遗留

- ghostty 需 `window-theme` 自声明外观与底色一致;`command` 直启 pi 可能命中 syncAppearance 闪现窗
  (~1-2s)误载 light(已知边界,记录于正典)。
- Ghostty 目视终验(用户侧)未做。
