# PACK-VISION-2 — provider-neutral observation contract

结论：**ACCEPTED WITH LIMITATIONS**

## Scope

视觉层仍是一个 Pi extension、一个公开工具 `motto_vision`、一张本地图像、
一次无状态 provider 调用。`contract.ts` 现在定义严格的
`ObservationRequest` / `ObservationResult` / `ObservationEvidence` /
`ObservationArtifact` / `ObservationProvenance` 类型与 runtime validation；
`GeminiAdapter` 是当前唯一 adapter，通过 `ObservationProvider` 窄接口注入。
没有 registry/router、隐式 fallback、第二次模型修复、自动扫描或上下文继承。

主模型 content 只收到 `projectObservationResult` 的确定性本地投影。合约结果
与 provenance 写入 `details`；provider 原始 JSON、base64、API key 不进入
content/details。`sourcePath` + `remote` 使本地图像与远程处理边界可追踪。

## Validation matrix

| 项 | 结果 | 证据 |
|---|---|---|
| complete / partial canonical result | PASS | `test/contract.test.mjs` |
| missing answer / malformed evidence fail closed | PASS | `validateObservationResult` + tests |
| bbox / page / timestamp range checks | PASS | normalized/pixel bbox、pageCount、durationSeconds tests |
| unknown-field policy | PASS | strict reject + explicit strip tests |
| deterministic projection | PASS | Conclusion/Evidence/Limitations exact-string test |
| provider A/B injection | PASS | fake providers through `runTool` without config |
| provider raw JSON / key / base64 isolation | PASS | canonical details/content assertions; sensitive-result guard |
| config/input/provider/quota/timeout/aborted/invalid_output kinds | PASS | typed `ObservationError`; existing HTTP/cancel/timeout matrix |
| existing pack tests | PASS | restricted shell first run was 66 PASS / 3 `EPERM`-blocked; after contract hardening, authorized local rerun `npm test` → **71/71 PASS** |
| TypeScript | PASS | `npm run typecheck` |

## Deployment state

`PACK-VISION-2` is **DEPLOYMENT_PENDING**. The repository implementation and
offline contract tests are accepted, but this revision was deliberately not
copied to the user-level Pi deployment. `regression.sh motto-gemini-vision`
passed its unit-test phase and then reported expected drift against the older
`PACK-VISION-1` deployment mirror. Therefore runtime loading, live-provider,
Pi dogfood, and deployed-regression evidence recorded for `PACK-VISION-1` is
historical evidence only; it does not constitute deployed-runtime verification
of this new contract.

## Manual visual projection check

Three programmatically generated, non-repository PNGs were viewed locally with
the agent's multimodal capability (no Gemini/DashScope call):

- `ui-state.png`: greyed Save button. Projection included a normalized bbox,
  explicit visible-state conclusion, and a limitation that hidden dirty-state
  cannot be inferred; a text-only agent can sensibly inspect app state next.
- `ocr-text.png`: release checklist. Projection preserved version/status/owner/
  command/note and a text-region locator; a text-only agent can review before
  running the command.
- `spatial-layout.png`: red left region, blue right region, rightward arrow.
  Projection included two bboxes plus the arrow relation; a text-only agent can
  act on the layout relationship.

Manual visual acceptance: **PASS**. Fixture files were temporary under
`/private/tmp/motto-vision-contract-fixtures/` and were not added to the repo.

The first restricted shell could not bind localhost or write a `~/` fixture;
those three cases were explicitly NOT TESTED there, then passed in the
authorized local rerun. No Gemini or other external multimodal API was called
for this contract change.

## Deliberate boundary

Gemini plain text is accepted as the provider's answer and wrapped as a
canonical result; structured evidence is only emitted when a provider supplies
validated evidence. If a task cannot be stably reduced to text (repeated video,
multi-image reasoning, or vision as the primary work), use a native multimodal
main model one-shot instead of repeated `motto_vision` calls.
