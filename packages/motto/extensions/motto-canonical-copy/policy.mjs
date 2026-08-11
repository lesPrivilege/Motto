/**
 * Pure clipboard projection policy.
 *
 * These helpers operate on canonical session data, never on rendered terminal
 * rows. That is the key invariant: visual wrapping must not become source
 * newlines in clipboard content.
 */

function isRecord(value) {
  return value !== null && typeof value === "object";
}

export function normalizeCanonicalText(text) {
  return String(text).replace(/\r\n?/g, "\n").replaceAll("\u0000", "");
}

/**
 * Return the final contiguous text run in one assistant message.
 *
 * Pi assistant messages may contain text, thinking, and tool-call blocks. The
 * trailing text run is the closest representation of the final answer after
 * the last tool call. Adjacent text blocks are concatenated byte-for-byte,
 * apart from newline normalization.
 */
export function trailingAssistantText(message) {
  if (!isRecord(message)) return undefined;
  const content = message.content;

  if (typeof content === "string") {
    const text = normalizeCanonicalText(content);
    return text.length > 0 ? text : undefined;
  }

  if (!Array.isArray(content)) return undefined;

  const lastPart = content.at(-1);
  if (!isRecord(lastPart) || lastPart.type !== "text" || typeof lastPart.text !== "string") {
    return undefined;
  }

  const chunks = [];
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const part = content[index];
    const isTextPart = isRecord(part) && part.type === "text" && typeof part.text === "string";

    if (!isTextPart) break;
    chunks.push(normalizeCanonicalText(part.text));
  }

  if (chunks.length === 0) return undefined;
  const text = chunks.reverse().join("");
  return text.length > 0 ? text : undefined;
}

/** Find the most recent assistant entry with a non-empty trailing text run. */
export function findLastAssistantText(entries) {
  if (!Array.isArray(entries)) return undefined;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.type !== "message" || !isRecord(entry.message)) continue;
    if (entry.message.role !== "assistant") continue;

    const text = trailingAssistantText(entry.message);
    if (text) return text;
  }

  return undefined;
}

/**
 * Extract the last fenced code block without changing its internal whitespace.
 * Supports backtick and tilde fences. The returned text excludes the fence and
 * optional language/info string.
 */
export function findLastFencedCode(text) {
  const source = normalizeCanonicalText(text ?? "");
  const blocks = [];
  const openingFence = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gm;
  let opening;
  while ((opening = openingFence.exec(source)) !== null) {
    const marker = opening[1][0];
    const closingFence = new RegExp(`^ {0,3}\\${marker}{${opening[1].length},}[ \\t]*$`, "gm");
    closingFence.lastIndex = openingFence.lastIndex + 1;
    const closing = closingFence.exec(source);
    if (!closing) continue;
    const bodyStart = openingFence.lastIndex + 1;
    const bodyEnd = closing.index > bodyStart && source[closing.index - 1] === "\n" ? closing.index - 1 : closing.index;
    blocks.push(source.slice(bodyStart, bodyEnd));
    openingFence.lastIndex = closingFence.lastIndex;
  }
  return blocks.at(-1);
}

export function clipboardStats(text) {
  const normalized = normalizeCanonicalText(text);
  return {
    characters: [...normalized].length,
    lines: normalized.length === 0 ? 0 : normalized.split("\n").length,
  };
}
