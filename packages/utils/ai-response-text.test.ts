import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RESPONSE_TEXT_FALLBACK,
  guardAiResponseText,
  isValidAiResponseText,
} from "./ai-response-text.ts";

test("rejects internal labels after inspection-only normalization", () => {
  const variants = [
    "User Safety: safe",
    "I can help. user **safety**:\u200bsafe",
    "Intent: greeting\nReasoning: none",
    "\u200bAssistant\u200b Safety\u200b:\u200b safe",
  ];

  for (const value of variants) {
    assert.equal(isValidAiResponseText(value), false, value);
    assert.equal(guardAiResponseText(value), AI_RESPONSE_TEXT_FALLBACK);
  }
});

test("rejects raw, nested, encoded, and partial chat contracts", () => {
  const values = [
    '{"content":"hello","action":"NONE","params":null}',
    '"{\\"content\\":\\"hello\\",\\"action\\":\\"NONE\\"}"',
    '"{}"',
    'The model returned {"content":"hello","action":"NONE"}.',
    '{"content":"hello","action":"NONE"',
    '{"unknown":"hello"',
    "{}",
    "[]",
    "[1,2]",
    "[{}]",
    "UserSafety: safe",
    "User\u200bSafety: safe",
    "<think private",
    "<analysis",
    "<|assistant|> Reply",
    "[SYSTEM]",
    "<|end|>",
    String.fromCharCode(96).repeat(3) +
      "json" +
      String.fromCharCode(10) +
      "{unknown: hello" +
      String.fromCharCode(10) +
      String.fromCharCode(96).repeat(3),
    String.fromCharCode(96).repeat(3) +
      "json" +
      String.fromCharCode(10) +
      '{"oops":',
    '{"oops',
    "<think>hidden reasoning</think>hello",
    "<assistant><analysis>safe</analysis></assistant>",
  ];

  for (const value of values) {
    assert.equal(isValidAiResponseText(value), false, value);
  }
  assert.equal(
    isValidAiResponseText(
      "[".repeat(4096) + "0" + "]".repeat(4096),
    ),
    false,
  );
});

test("preserves normal safety prose, formatting, Unicode, and literal escapes", () => {
  const value =
    "For your safety, stop if pain increases.\n\n**Keep control** — use `\\n` literally and keep 日本語.";

  assert.equal(isValidAiResponseText(value), true);
  assert.equal(guardAiResponseText(value), value);
  assert.equal(
    isValidAiResponseText("Next action: Start with a short walk."),
    true,
  );
  assert.equal(
    isValidAiResponseText(
      "[Fitness basics](https://example.com) Start with a warm-up.",
    ),
    true,
  );
  assert.equal(
    isValidAiResponseText("```ts\nconst duration = 20;\n```"),
    true,
  );
});

test("rejects replacement/control characters and unpaired surrogates", () => {
  assert.equal(isValidAiResponseText("safe\u0000text"), false);
  assert.equal(isValidAiResponseText("safe\ufffdtext"), false);
  assert.equal(isValidAiResponseText("safe\ud800text"), false);
  assert.equal(
    isValidAiResponseText("safe" + String.fromCharCode(0xd800)),
    false,
  );
});
