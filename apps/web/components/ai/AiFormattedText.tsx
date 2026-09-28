import type { CSSProperties, ReactNode } from "react";

import {
  parseAiFormattedText,
  type AiFormattedInlineToken,
  type AiFormattedTextBlock,
} from "@fittrack/utils";

import { FitText } from "@/components/fit/FitText";

type AiFormattedTextProps = {
  className?: string;
  compact?: boolean;
  style?: CSSProperties;
  text: string | null | undefined;
};

function renderInline(tokens: AiFormattedInlineToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case "text":
        return token.value;
      case "bold":
        return <strong key={key}>{renderInline(token.children, key)}</strong>;
      case "italic":
        return <em key={key}>{renderInline(token.children, key)}</em>;
      case "strike":
        return <del key={key}>{renderInline(token.children, key)}</del>;
      case "inline-code":
        return (
          <code
            key={key}
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
              fontSize: "0.92em",
            }}
          >
            {token.value}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noreferrer noopener"
            style={{ color: "inherit", textDecoration: "underline", overflowWrap: "anywhere" }}
          >
            {renderInline(token.children, key)}
          </a>
        );
    }
  });
}

function renderBlock(block: AiFormattedTextBlock, index: number, style: CSSProperties, compact: boolean) {
  const key = `ai-formatted-block-${index}`;
  const blockSpacing = compact ? 5 : 9;
  if (block.type === "code") {
    return (
      <pre
        key={key}
        style={{
          margin: `0 0 ${blockSpacing}px`,
          minWidth: 0,
          maxWidth: "100%",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
          color: "inherit",
          font: "inherit",
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: "0.92em",
          ...style,
        }}
      >
        {block.value}
      </pre>
    );
  }

  if (block.type === "unordered-list" || block.type === "ordered-list") {
    const ListTag = block.type === "ordered-list" ? "ol" : "ul";
    return (
      <ListTag
        key={key}
        style={{
          margin: `0 0 ${blockSpacing}px`,
          paddingLeft: compact ? 19 : 23,
          minWidth: 0,
          overflowWrap: "anywhere",
          ...style,
        }}
      >
        {block.items.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`} style={{ marginBottom: compact ? 2 : 4 }}>
            {renderInline(item, `${key}-${itemIndex}`)}
          </li>
        ))}
      </ListTag>
    );
  }

  if (block.type === "heading") {
    return (
      <FitText
        key={key}
        as={`h${block.level}` as "h1" | "h2" | "h3"}
        style={{
          margin: `0 0 ${blockSpacing}px`,
          minWidth: 0,
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
          fontWeight: 700,
          ...style,
        }}
      >
        {renderInline(block.children, key)}
      </FitText>
    );
  }

  if (!("children" in block)) return null;

  return (
    <FitText
      key={key}
      as="p"
      style={{
        margin: `0 0 ${blockSpacing}px`,
        minWidth: 0,
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {renderInline(block.children, key)}
    </FitText>
  );
}

export default function AiFormattedText({
  className,
  compact = false,
  style,
  text,
}: AiFormattedTextProps) {
  const blocks = parseAiFormattedText(text);
  if (!blocks.length) return null;

  return (
    <div
      className={className}
      style={{ minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}
    >
      {blocks.map((block, index) => renderBlock(block, index, style ?? {}, compact))}
    </div>
  );
}
