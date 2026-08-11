import {
  copyToClipboard,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";
import {
  clipboardStats,
  findLastAssistantText,
  findLastFencedCode,
} from "./policy.mjs";

type CopyKind = "answer" | "code";

function getCanonicalAnswer(ctx: ExtensionContext): string | undefined {
  return findLastAssistantText(ctx.sessionManager.getBranch());
}

function getCanonicalCode(ctx: ExtensionContext): string | undefined {
  const answer = getCanonicalAnswer(ctx);
  return answer ? findLastFencedCode(answer) : undefined;
}

async function copyCanonical(
  ctx: ExtensionContext,
  kind: CopyKind,
): Promise<void> {
  const text = kind === "answer" ? getCanonicalAnswer(ctx) : getCanonicalCode(ctx);
  const label = kind === "answer" ? "answer" : "code block";

  if (!text) {
    if (ctx.hasUI) ctx.ui.notify(`No canonical ${label} found`, "warning");
    return;
  }

  try {
    await copyToClipboard(text);
    if (ctx.hasUI) {
      const stats = clipboardStats(text);
      ctx.ui.notify(
        `Copied canonical ${label} · ${stats.lines} ${stats.lines === 1 ? "line" : "lines"} · ${stats.characters} chars`,
        "info",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ctx.hasUI) ctx.ui.notify(`Clipboard copy failed: ${message}`, "error");
  }
}

function registerOptionalShortcut(
  pi: ExtensionAPI,
  envName: string,
  description: string,
  handler: (ctx: ExtensionContext) => Promise<void>,
): string | undefined {
  const configured = process.env[envName]?.trim();
  if (!configured) return undefined;
  pi.registerShortcut(configured as KeyId, { description, handler });
  return configured;
}

/**
 * legacy 按键解析(ESC+单字符)下无法可靠触发的组合:含 shift 或 super 的修饰键,
 * 需 Kitty 键盘协议或 modifyOtherKeys 终端(如 Ghostty)才能解析。
 */
function isLegacyUnparseableShortcut(keyId: string): boolean {
  return /\b(shift|super)\b/.test(keyId);
}

export default function mottoCanonicalCopy(pi: ExtensionAPI): void {
  pi.registerCommand("copy-answer", {
    description: "Copy the latest assistant answer from canonical session data",
    handler: async (_args, ctx) => copyCanonical(ctx, "answer"),
  });

  pi.registerCommand("copy-code", {
    description: "Copy the last fenced code block from the latest assistant answer",
    handler: async (_args, ctx) => copyCanonical(ctx, "code"),
  });

  // No default shortcut is claimed: terminal and editor keymaps differ widely.
  // Opt in without modifying source, for example:
  // MOTTO_COPY_ANSWER_SHORTCUT=alt+c
  const configured: string[] = [];
  const answerShortcut = registerOptionalShortcut(
    pi,
    "MOTTO_COPY_ANSWER_SHORTCUT",
    "Copy latest canonical assistant answer",
    (ctx) => copyCanonical(ctx, "answer"),
  );
  const codeShortcut = registerOptionalShortcut(
    pi,
    "MOTTO_COPY_CODE_SHORTCUT",
    "Copy latest canonical fenced code block",
    (ctx) => copyCanonical(ctx, "code"),
  );
  if (answerShortcut) configured.push(answerShortcut);
  if (codeShortcut) configured.push(codeShortcut);

  // 对含 shift/super 的配置组合,启动时一次性提醒(仅 TUI,不抛错、不影响加载其余扩展)。
  // 措辞为「可能不触发」:在支持 Kitty 键盘协议的终端(如 Ghostty)下该类组合可正常解析。
  const unparseable = configured.filter(isLegacyUnparseableShortcut);
  if (unparseable.length > 0) {
    pi.on("session_start", (_event, ctx) => {
      if (!ctx.hasUI) return;
      ctx.ui.notify(
        `Copy shortcut(s) ${unparseable.join(" / ")} may not trigger in terminals without ` +
          "Kitty keyboard protocol or modifyOtherKeys (e.g. Ghostty). " +
          "Prefer legacy-parseable combos like alt+c / alt+k.",
        "warning",
      );
    });
  }
}
