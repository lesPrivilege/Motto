import assert from "node:assert/strict";
import test from "node:test";
import {
  clipboardStats,
  findLastAssistantText,
  findLastFencedCode,
  normalizeCanonicalText,
  trailingAssistantText,
} from "../policy.mjs";

test("normalizes transport newlines without wrapping source lines", () => {
  const source = "one very long logical line that must remain one line\r\nsecond";
  assert.equal(
    normalizeCanonicalText(source),
    "one very long logical line that must remain one line\nsecond",
  );
});

test("takes the final contiguous assistant text run after a tool call", () => {
  const message = {
    role: "assistant",
    content: [
      { type: "text", text: "I will inspect it." },
      { type: "toolCall", name: "read" },
      { type: "text", text: "Final " },
      { type: "text", text: "answer\nwith a hard newline." },
    ],
  };
  assert.equal(trailingAssistantText(message), "Final answer\nwith a hard newline.");
});

test("finds the latest assistant answer on the active branch", () => {
  const entries = [
    { type: "message", message: { role: "user", content: [{ type: "text", text: "q" }] } },
    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "old" }] } },
    { type: "custom", data: {} },
    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "latest" }] } },
  ];
  assert.equal(findLastAssistantText(entries), "latest");
});

test("skips assistant messages that end in a tool call and have no final text", () => {
  const entries = [
    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "usable" }] } },
    {
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "working" },
          { type: "toolCall", name: "bash" },
        ],
      },
    },
  ];
  assert.equal(findLastAssistantText(entries), "usable");
});

test("preserves the last fenced code block exactly", () => {
  const answer = [
    "first",
    "```ts",
    "const a = 1;",
    "```",
    "second",
    "~~~sh",
    "printf 'a  b\\n'",
    "  indented",
    "~~~",
  ].join("\n");
  assert.equal(findLastFencedCode(answer), "printf 'a  b\\n'\n  indented");
});

test("accepts a CommonMark closing fence longer than its opening fence", () => {
  const answer = ["```ts", "const value = 1;", "````"].join("\n");
  assert.equal(findLastFencedCode(answer), "const value = 1;");
});

test("does not invent a code block", () => {
  assert.equal(findLastFencedCode("plain text"), undefined);
});

test("reports unicode characters and hard source lines", () => {
  assert.deepEqual(clipboardStats("甲乙\nabc"), { characters: 6, lines: 2 });
});
