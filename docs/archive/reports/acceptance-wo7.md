# WO-7 Acceptance — TUI-2 NO_SESSION_POLLUTION 断言 + recordThinkingFoldStates 幂等回归

- Verifier: 独立验收 agent（写者与验收者分离）
- Commit under review: `025406274` (pi fork, branch `motto/main`)
- Date: 2026-08-12

## VERDICT: ACCEPTED

Per-gate evaluation below. No vacuity or discrepancy found in the WO's own scope.
One observation noted (pre-existing flaky test, unrelated).

---

## 1. Test file — `/Users/lesprivilege/Projects/pi/packages/coding-agent/test/thinking-fold-no-pollution.test.ts` (228 lines) — PASS

### Harness (real, matches claim)
- Confirmed `Object.create(InteractiveMode.prototype)` prototype-level harness, same pattern
  as `test/interactive-tui.test.ts:98` (`Object.assign(Object.create(InteractiveMode.prototype), …)`).
- `foldPrototype = InteractiveMode.prototype as unknown as FoldPrototype` — the test invokes the REAL
  prototype methods, verified present in `src/modes/interactive/interactive-mode.ts`:
  `recordThinkingFoldStates` (line 3607), `getThinkingEntryFoldState` (3621),
  `handleThinkingFocus` (4141), `handleThinkingFold` (4155). TS `private` is compile-time only.
- Fake session manager with real `vi.fn` spies for `getEntries` / `appendCustomEntry` /
  `appendCustomMessageEntry` / `sendMessage`. All four methods called in the handlers only touch
  `thinkingFoldState` / `thinkingEntryOrder` / `thinkingFocusIndex` / `showStatus` / `ui.requestRender`
  — zero session-manager access in the implementation, so the spies would fire if a regression added one.

### Assertions (all 7, real & non-vacuous)
- (a) **Zero write-path**: spy asserts `appendCustomEntry` / `appendCustomMessageEntry` /
  `sendMessage` never called across `recordThinkingFoldStates` + 3 focus/fold cycles. Non-vacuous:
  spies record any call.
- (b) **Zero read-path**: `getEntries` never called — fold is pure UI state, not in context. Strongest
  form of the guarantee at this level (fold never even sees the session).
- (c) **Fixture entries byte-identical** after 6 focus/fold cycles: length + `JSON.stringify` equality
  with pre-cycle snapshot (resume/export-style proxy). Non-vacuous.
- (d) **Serialization leak check is meaningful**: test first advances the map to a genuine non-default
  state — `handleThinkingFold`×2 + `handleThinkingFocus` → asserts `map.get("a1:2") === "full"` BEFORE
  serializing — then asserts serialized JSON contains no entryId (`a1:1`/`a1:2`/`a2:1`) and no state word
  (`preview`/`full`/`collapsed`). Verified falsifiable: fixture thinking text
  ("need to check the session schema first") contains none of those tokens, so the assertion can fail.
- (e) **`getThinkingEntryFoldState` read-only**: known id → its state; unknown id →
  `DEFAULT_THINKING_FOLD_STATE` (collapsed) with `map.has(id) === false` (no write side-effect);
  zero session read/write.

### Idempotency regression (T2-3 gap) — PASS
- Overlapping/duplicate registrations (`["a1:1","a1:2"]` → `["a1:1","a1:2","a1:3"]` →
  `["a1:2","a1:3"]` → `["a1:1","a1:1","a1:3","a1:3"]`): `thinkingEntryOrder` stays first-seen order,
  no duplicates, `Set` size == length, map size == 3, all default collapsed. Matches implementation
  (only first-seen ids pushed).
- Re-registering the same batch after folding preserves existing state (`a1:1` stays `preview`) and order.

### Stated limitation — honestly documented
Header comment explicitly states: prototype-level harness, does NOT instantiate `InteractiveMode` and
does NOT exercise a real `SessionManager` on-disk; fixture comment notes `sessionManager` is present
only for the zero-touch assertion. The in-memory fixture is a resume/export *proxy*, not an on-disk
resume. This is a truthful scoping statement, not an over-claim — so the limitation is documented
and the verdict does not need downgrade to "WITH LIMITATIONS".

## 2. Tests — PASS
- Targeted: `vitest run test/thinking-fold-no-pollution.test.ts test/interactive-tui.test.ts
  test/thinking-fold.test.ts test/assistant-message.test.ts test/user-message.test.ts`
  → **55 passed / 0 failed** (5 files). Matches expected.
- Full suite: **1941 passed / 49 skipped / 0 failed** (217 passed files / 6 skipped). Matches expected.
- Observation (pre-existing, unrelated): one run produced 1940 passed / 1 failed in
  `test/footer-data-provider.test.ts` ("debounces rapid reftable updates…" — timing-sensitive 650ms
  wait). It passes in isolation and on immediate full re-run (1941/49/0). A test-only WO adding a new
  file cannot affect that timing; this is a known-flaky suite, not a regression from commit `025406274`.

## 3. No-rendering change — PASS
`Motto: node --experimental-strip-types fixtures/tui/render-baseline.mjs --check` →
`BASELINE_CHECK_PASS: 与已提交基线逐字节一致,逐宽度零超宽` (overflow 0 across themes/widths). Unchanged.

## 4. Test-only commit — PASS
`git show 025406274` → exactly one file:
`packages/coding-agent/test/thinking-fold-no-pollution.test.ts` (228 insertions, 0 deletions).
No `src/` change. No PATCHES.json entry added: pi repo has no PATCHES.json at all; Motto's
`docs/maintenance/PATCHES.json` contains no `025406274`/`thinking-fold-no-pollution` entry
(test+doc only — correctly excluded from the patch ledger).

## 5. Work-order marking — PASS (truthful)
`Motto/docs/decisions/2026-08-11-motto-tui-2.md` §6:
- `BASELINE_GREEN ✅ 已实现(commit 025406274…)` — evidence matches: render-baseline `--check` PASS;
  note "本 commit 为 test-only 增量不触碰基线" matches the single-file diff.
- `NO_SESSION_POLLUTION ✅ 已实现(commit 025406274…)` — evidence notes describe exactly the seven
  assertions + idempotency regression I verified; no over-statement.
- `DOGFOOD_EVIDENCE ⏳ usage-log 条目` — remains unmarked. GHOSTTY is the merge-gate precondition
  (referenced to the TUI-1 table, §0 line 41 / §3 line 60), not a §6 row — consistent.
- WO not marked ACCEPTED: doc status is `REGISTERED → 待执行者认领`; every §6 row ends
  "终态 ACCEPTED 待用户验收(写者与验收者分离)". Correct.

## 6. Repo state — PASS
- pi: branch `motto/main`, HEAD `025406274`, working tree clean, HEAD == `origin/motto/main`.
- Motto: branch `main`, HEAD `71011ec`, working tree clean, HEAD == `origin/main`.

---

## Discrepancies / concerns
1. Pre-existing flaky test `footer-data-provider.test.ts` (timing-sensitive) — observed 1 failure on a
   full-suite run, passes on re-run; NOT attributable to this WO (test-only). Suite owner may want to
   harden the 650ms debounce wait.
2. No other discrepancies. All gate claims in §6 of the work order are accurate as of review.
