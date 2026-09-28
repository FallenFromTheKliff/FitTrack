export type AiFormattedInlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; children: AiFormattedInlineToken[] }
  | { type: "italic"; children: AiFormattedInlineToken[] }
  | { type: "strike"; children: AiFormattedInlineToken[] }
  | { type: "inline-code"; value: string }
  | { type: "link"; href: string; children: AiFormattedInlineToken[] };

export type AiFormattedTextBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3;
      children: AiFormattedInlineToken[];
    }
  | { type: "paragraph"; children: AiFormattedInlineToken[] }
  | {
      type: "unordered-list" | "ordered-list";
      items: AiFormattedInlineToken[][];
    }
  | { type: "code"; value: string; language?: string };

const ESCAPABLE_MARKERS = new Set(["\\", "`", "*", "_", "~", "[", "]"]);

function appendText(tokens: AiFormattedInlineToken[], value: string) {
  if (!value) return;

  const previous = tokens[tokens.length - 1];
  if (previous?.type === "text") {
    previous.value += value;
    return;
  }

  tokens.push({ type: "text", value });
}

function isEscaped(value: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function findClosing(value: string, marker: string, start: number) {
  let index = value.indexOf(marker, start);
  while (index >= 0) {
    if (!isEscaped(value, index)) return index;
    index = value.indexOf(marker, index + marker.length);
  }
  return -1;
}

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}

function plainTextFromTokens(tokens: AiFormattedInlineToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "text" || token.type === "inline-code") {
        return token.value;
      }
      return plainTextFromTokens(token.children);
    })
    .join("");
}

function findLinkEnd(value: string, start: number) {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "\\" && index + 1 < value.length) {
      index += 1;
      continue;
    }
    if (value[index] === "(") {
      depth += 1;
      continue;
    }
    if (value[index] !== ")") continue;
    if (depth === 0) return index;
    depth -= 1;
  }
  return -1;
}

type MarkdownLinkMatch = {
  end: number;
  href: string;
  label: string;
};

function matchMarkdownLink(value: string, start: number): MarkdownLinkMatch | null {
  if (value[start] !== "[") return null;

  const labelEnd = findClosing(value, "]", start + 1);
  if (labelEnd <= start || value[labelEnd + 1] !== "(") return null;

  const destinationStart = labelEnd + 2;
  const destinationEnd = findLinkEnd(value, destinationStart);
  if (destinationEnd < destinationStart) return null;

  const label = value.slice(start + 1, labelEnd);
  const href = value.slice(destinationStart, destinationEnd).trim();
  if (!label.trim() || !href || /[\r\n\s]/.test(href)) return null;

  return { end: destinationEnd + 1, href, label };
}

/** Only web URLs can become interactive links in an AI response. */
export function isSafeAiHref(value: string) {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f\s]/.test(href)) return false;

  try {
    const parsed = new URL(href);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function parseInline(value: string): AiFormattedInlineToken[] {
  const tokens: AiFormattedInlineToken[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (
      character === "\\" &&
      index + 1 < value.length &&
      ESCAPABLE_MARKERS.has(value[index + 1] ?? "")
    ) {
      appendText(tokens, value[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (character === "[") {
      const link = matchMarkdownLink(value, index);
      if (link) {
        const children = parseInline(link.label);
        appendText(tokens, "");
        if (isSafeAiHref(link.href)) {
          tokens.push({ type: "link", href: link.href, children });
        } else {
          appendText(
            tokens,
            `${plainTextFromTokens(children) || link.label} (${link.href})`,
          );
        }
        index = link.end - 1;
        continue;
      }
    }

    if (character === "`") {
      const closing = findClosing(value, "`", index + 1);
      if (closing > index + 1) {
        appendText(tokens, "");
        tokens.push({
          type: "inline-code",
          value: value.slice(index + 1, closing).replace(/\s+/g, " ").trim(),
        });
        index = closing;
        continue;
      }
      // A lone backtick is formatting noise. Keep its surrounding text.
      continue;
    }

    const pairedMarker = value.slice(index, index + 2);
    const pairedType =
      pairedMarker === "**" || pairedMarker === "__"
        ? "bold"
        : pairedMarker === "~~"
          ? "strike"
          : null;
    if (pairedType) {
      const closing = findClosing(value, pairedMarker, index + 2);
      if (closing > index + 2) {
        appendText(tokens, "");
        tokens.push({
          type: pairedType,
          children: parseInline(value.slice(index + 2, closing)),
        });
        index = closing + 1;
        continue;
      }
      // Keep malformed content readable without exposing a dangling marker.
      continue;
    }

    if (character === "*" || character === "_") {
      const previous = value[index - 1];
      const next = value[index + 1];
      const canOpen =
        character !== "_" || !isWordCharacter(previous) || !isWordCharacter(next);
      const closing = canOpen
        ? findClosing(value, character, index + 1)
        : -1;
      if (closing > index + 1) {
        appendText(tokens, "");
        tokens.push({
          type: "italic",
          children: parseInline(value.slice(index + 1, closing)),
        });
        index = closing;
        continue;
      }
      // A malformed emphasis marker is omitted, but its content remains.
      continue;
    }

    if (character === "~") {
      // A single tilde is commonly left behind by incomplete strike syntax.
      continue;
    }

    appendText(tokens, character);
  }

  return tokens;
}

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})\s*([^\s]*)?\s*$/;
const HEADING_PATTERN = /^\s{0,3}(#{1,6})(?:\s+|(?=\S))(.+?)\s*#*\s*$/;
const UNORDERED_ITEM_PATTERN = /^\s{0,3}[-+*]\s+(.+)$/;
const ORDERED_ITEM_PATTERN = /^\s{0,3}\d+[.)]\s+(.+)$/;

function getHeading(line: string) {
  const match = line.match(HEADING_PATTERN);
  if (!match?.[2]?.trim()) return null;

  return {
    level: Math.min(match[1].length, 3) as 1 | 2 | 3,
    text: match[2].trim(),
  };
}

function getListItem(line: string) {
  const unordered = line.match(UNORDERED_ITEM_PATTERN);
  if (unordered) return { kind: "unordered-list" as const, text: unordered[1] };

  const ordered = line.match(ORDERED_ITEM_PATTERN);
  if (ordered) return { kind: "ordered-list" as const, text: ordered[1] };

  return null;
}

function isBlockStart(line: string) {
  return Boolean(line.match(FENCE_PATTERN) || getHeading(line) || getListItem(line));
}

/**
 * Parses the small, safe Markdown subset used by Brodigy responses. It returns
 * data only; platform renderers decide how to display the data and never need
 * to inject model text as HTML.
 */
export function parseAiFormattedText(
  value: string | null | undefined,
): AiFormattedTextBlock[] {
  if (typeof value !== "string" || !value.trim()) return [];

  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: AiFormattedTextBlock[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(FENCE_PATTERN);
    if (fence) {
      const fenceCharacter = fence[1][0];
      const content: string[] = [];
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        if (
          new RegExp(`^\\s*${fenceCharacter}{3,}\\s*$`).test(candidate)
        ) {
          index += 1;
          break;
        }
        content.push(candidate);
        index += 1;
      }
      blocks.push({
        type: "code",
        value: content.join("\n"),
        ...(fence[2] ? { language: fence[2] } : {}),
      });
      continue;
    }

    const heading = getHeading(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading.level,
        children: parseInline(heading.text),
      });
      index += 1;
      continue;
    }

    const firstListItem = getListItem(line);
    if (firstListItem) {
      const items: AiFormattedInlineToken[][] = [];
      const listType = firstListItem.kind;
      while (index < lines.length) {
        const item = getListItem(lines[index] ?? "");
        if (!item || item.kind !== listType) break;
        items.push(parseInline(item.text.trim()));
        index += 1;
      }
      blocks.push({ type: listType, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index] ?? "";
      if (!paragraphLine.trim() || (paragraphLines.length > 0 && isBlockStart(paragraphLine))) {
        break;
      }
      paragraphLines.push(paragraphLine.trim());
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push({
        type: "paragraph",
        children: parseInline(paragraphLines.join("\n")),
      });
      continue;
    }

    // Defensive progress for an unexpected line shape.
    index += 1;
  }

  return blocks;
}

function plainTextFromBlock(block: AiFormattedTextBlock) {
  if (block.type === "code") return block.value;
  if (block.type === "unordered-list" || block.type === "ordered-list") {
    return block.items.map(plainTextFromTokens).join(" ");
  }
  if (!("children" in block)) return "";
  return plainTextFromTokens(block.children);
}

function plainDisplayTextFromTokens(tokens: AiFormattedInlineToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "text" || token.type === "inline-code") {
        return token.value;
      }
      if (token.type === "link") {
        const label = plainDisplayTextFromTokens(token.children);
        return `${label || token.href} (${token.href})`;
      }
      return plainDisplayTextFromTokens(token.children);
    })
    .join("");
}

/** Renders parsed AI text as safe, platform-neutral text for plain UI surfaces. */
export function formatAiFormattedTextForPlainDisplay(
  value: string | null | undefined,
) {
  return parseAiFormattedText(value)
    .map((block) => {
      if (block.type === "code") return block.value;
      if (block.type === "unordered-list" || block.type === "ordered-list") {
        return block.items
          .map((item, index) => {
            const marker = block.type === "ordered-list" ? `${index + 1}. ` : "• ";
            return `${marker}${plainDisplayTextFromTokens(item)}`;
          })
          .join("\n");
      }
      if (!("children" in block)) return "";
      return plainDisplayTextFromTokens(block.children);
    })
    .join("\n\n")
    .trim();
}

/** Flattens an AI string for compact analytics rows without leaking markers. */
export function normalizeAiFormattedInlineText(value: string | null | undefined) {
  return parseAiFormattedText(value)
    .map(plainTextFromBlock)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
