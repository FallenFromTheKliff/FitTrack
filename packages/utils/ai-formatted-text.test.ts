import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAiFormattedTextForPlainDisplay,
  isSafeAiHref,
  normalizeAiFormattedInlineText,
  parseAiFormattedText,
} from "./ai-formatted-text.ts";

test("parses headings, paragraphs, and both list styles", () => {
  const blocks = parseAiFormattedText(
    "### Recovery\n\nKeep **one easy day**.\n\n- Sleep consistently\n- _Walk_\n\n1. Plan\n2. Review",
  );

  assert.equal(blocks[0]?.type, "heading");
  assert.equal(blocks[1]?.type, "paragraph");
  assert.equal(blocks[2]?.type, "unordered-list");
  assert.equal(blocks[3]?.type, "ordered-list");
  assert.equal(normalizeAiFormattedInlineText("### Recovery"), "Recovery");
  assert.equal(
    normalizeAiFormattedInlineText("Keep **one easy day**."),
    "Keep one easy day.",
  );
});

test("keeps fenced code readable without parsing its contents", () => {
  const [block] = parseAiFormattedText("```ts\nconst value = `literal`;\n```");

  assert.deepEqual(block, {
    type: "code",
    value: "const value = `literal`;",
    language: "ts",
  });
});

test("parses emphasis, inline code, and safe links", () => {
  const [block] = parseAiFormattedText(
    "**bold** *italic* `code` [FitTrack](https://fittrack.example/path)",
  );

  assert.equal(block?.type, "paragraph");
  if (block?.type !== "paragraph") return;
  assert.deepEqual(
    block.children.map((token) => token.type),
    ["bold", "text", "italic", "text", "inline-code", "text", "link"],
  );
  assert.equal(isSafeAiHref("https://fittrack.example/path"), true);
});

test("renders unsafe links as readable text and never as interactive links", () => {
  const [block] = parseAiFormattedText(
    "[delete](javascript:alert(1)) [data](data:text/html,hello)",
  );

  assert.equal(block?.type, "paragraph");
  if (block?.type !== "paragraph") return;
  assert.equal(block.children.some((token) => token.type === "link"), false);
  assert.match(normalizeAiFormattedInlineText("[delete](javascript:alert(1))"), /javascript:alert\(1\)/);
  assert.equal(isSafeAiHref("javascript:alert(1)"), false);
  assert.equal(isSafeAiHref("https://user:pass@example.com"), false);
});

test("malformed markers, raw HTML, whitespace, and empty values remain safe and readable", () => {
  assert.equal(
    normalizeAiFormattedInlineText("  **unfinished emphasis and `code <b>html</b>"),
    "unfinished emphasis and code <b>html</b>",
  );
  assert.equal(normalizeAiFormattedInlineText("\n\t  \n"), "");
  assert.deepEqual(parseAiFormattedText(null), []);
  assert.equal(normalizeAiFormattedInlineText("\\*literal\\*"), "*literal*");
});

test("plain display preserves readable blocks while removing formatting markers", () => {
  assert.equal(
    formatAiFormattedTextForPlainDisplay(
      "### Recovery\n\nKeep **one easy day**.\n\n- Sleep\n- `Walk`\n\n1. Plan\n2. Review\n\n```ts\nconst ready = true;\n```\n\n[Guide](https://fittrack.example/guide)",
    ),
    "Recovery\n\nKeep one easy day.\n\n• Sleep\n• Walk\n\n1. Plan\n2. Review\n\nconst ready = true;\n\nGuide (https://fittrack.example/guide)",
  );
});
