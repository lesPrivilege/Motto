# CONTRIBUTING.md

加入或更新一个扩展（pack）的流程。

## 加入一个新 pack

1. 在 `extensions/` 下建 `extensions/<pack-name>/`，结构遵循 README 体例：
   `index.ts`（薄）+ `<core>.ts`（厚）+ 依赖客户端 + `README.md` + `test/` + `checksums/`。
2. 固定版本依赖：把官方 release 的 `checksums.txt` 放入 `checksums/`，写 fetch 脚本（可参考 `motto-computer-use/checksums/`），二进制不入库。
3. 写测试（参考 `motto-computer-use/test/`）：
   - 无权限 smoke（握手 / 版本 / 白名单 / fail-closed）
   - 边界 + 退化（白名单强制、权限 preflight）
   - 网络（无 TCP/UDP 出站）、进程树、生命周期
   - 动态 live（需真实权限时），覆盖：观察 / 真实内容回传 / 后台行为 / 坐标契约 / 动作闭环 / stale 拒绝
   - 真实模型闭环（`pi -e` 驱动）
4. 在本机验证全部测试通过，把结果写入 `reports/` 验收报告（用 `docs/templates/ACCEPTANCE.md` 模板）。
5. 更新 `extensions/REGISTRY.md`：登记 pack、状态、契约、报告路径。
6. 开始 dogfooding：把首个真实使用记录写入 `docs/usage-log/`。

## 更新一个既有 pack

1. 最小修复；改代码后跑该 pack 全量测试。
2. 行为有变化 → 更新 `README.md` 与验收报告，注明原因与行为变化。
3. 有 dogfooding 记录支撑 → 在 `docs/usage-log/` 留痕。
4. 不引入兼容层；删除废弃路径。

## 升级固定版本依赖（例：Peekaboo）

1. 审阅上游 changelog / release notes（`docs/MAINTENANCE.md` 第 3 层）。
2. 从官方 release 拉新 `checksums.txt`，替换 `checksums/` 并更新 `VERSION`。
3. 全量回归 + 更新验收报告。
4. 只有全部通过才能升级；否则维持固定版本并记录原因。

## 提交约定

- 提交信息：`<pack>: <动词> <对象>`，如 `motto-computer-use: fix coordinate_context meta plumbing`。
- 一个提交 = 一个可验收变更；报告与测试与代码同提交，保持可追溯。
