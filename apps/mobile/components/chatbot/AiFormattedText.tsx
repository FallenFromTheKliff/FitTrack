import type { ReactNode } from "react";
import {
  Linking,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import {
  isSafeAiHref,
  parseAiFormattedText,
  type AiFormattedInlineToken,
  type AiFormattedTextBlock,
} from "@fittrack/utils";

import { FitText } from "@/components/fit/FitText";
import { useTheme } from "@/contexts/ThemeContext";

type AiFormattedTextProps = {
  text: string | null | undefined;
  textStyle?: StyleProp<TextStyle>;
};

const styles = StyleSheet.create({
  root: {
    flexShrink: 1,
    maxWidth: "100%",
    minWidth: 0,
  },
  blockSpacing: {
    marginBottom: 5,
  },
  heading: {
    fontWeight: "800",
  },
  headingLarge: {
    fontSize: 17,
    lineHeight: 22,
  },
  headingMedium: {
    fontSize: 16,
    lineHeight: 21,
  },
  headingSmall: {
    fontSize: 15,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "800",
  },
  italic: {
    fontStyle: "italic",
  },
  strike: {
    textDecorationLine: "line-through",
  },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  link: {
    textDecorationLine: "underline",
  },
  codeBlock: {
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 1,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  list: {
    gap: 3,
    maxWidth: "100%",
    minWidth: 0,
  },
  listRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    minWidth: 0,
  },
  listMarker: {
    flexShrink: 0,
    minWidth: 16,
    textAlign: "right",
  },
  listText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});

function openSafeLink(href: string) {
  if (!isSafeAiHref(href)) return;
  void Linking.openURL(href).catch(() => undefined);
}

function renderInline(
  tokens: AiFormattedInlineToken[],
  keyPrefix: string,
  brandColor: string,
  inlineCodeBackground: string,
): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (token.type) {
      case "text":
        return token.value;
      case "bold":
        return (
          <FitText key={key} style={styles.bold}>
            {renderInline(token.children, key, brandColor, inlineCodeBackground)}
          </FitText>
        );
      case "italic":
        return (
          <FitText key={key} style={styles.italic}>
            {renderInline(token.children, key, brandColor, inlineCodeBackground)}
          </FitText>
        );
      case "strike":
        return (
          <FitText key={key} style={styles.strike}>
            {renderInline(token.children, key, brandColor, inlineCodeBackground)}
          </FitText>
        );
      case "inline-code":
        return (
          <FitText
            key={key}
            style={[styles.inlineCode, { backgroundColor: inlineCodeBackground }]}
          >
            {token.value}
          </FitText>
        );
      case "link":
        return (
          <FitText
            accessibilityRole="link"
            key={key}
            onPress={() => openSafeLink(token.href)}
            style={[styles.link, { color: brandColor }]}
          >
            {renderInline(token.children, key, brandColor, inlineCodeBackground)}
          </FitText>
        );
    }
  });
}

function renderTextBlock(
  block: Extract<AiFormattedTextBlock, { type: "heading" | "paragraph" }>,
  index: number,
  isLast: boolean,
  textStyle: StyleProp<TextStyle>,
  brandColor: string,
  inlineCodeBackground: string,
) {
  const headingStyle =
    block.type !== "heading"
      ? null
      : block.level === 1
        ? styles.headingLarge
        : block.level === 2
          ? styles.headingMedium
          : styles.headingSmall;

  return (
    <FitText
      accessibilityRole={block.type === "heading" ? "header" : undefined}
      key={`ai-block-${index}`}
      style={[
        textStyle,
        block.type === "heading" && styles.heading,
        headingStyle,
        !isLast && styles.blockSpacing,
      ]}
    >
      {renderInline(
        block.children,
        `ai-block-${index}`,
        brandColor,
        inlineCodeBackground,
      )}
    </FitText>
  );
}

export default function AiFormattedText({ text, textStyle }: AiFormattedTextProps) {
  const { colors } = useTheme();
  const blocks = parseAiFormattedText(text);
  if (!blocks.length) return null;

  return (
    <View style={styles.root} testID="brodigyai-formatted-text">
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1;
        const key = `ai-block-${index}`;

        if (block.type === "heading" || block.type === "paragraph") {
          return renderTextBlock(
            block,
            index,
            isLast,
            textStyle,
            colors.brand,
            colors.surfaceRaised,
          );
        }

        if (block.type === "code") {
          return (
            <FitText
              key={key}
              style={[
                textStyle,
                styles.codeBlock,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
                !isLast && styles.blockSpacing,
              ]}
            >
              {block.value}
            </FitText>
          );
        }

        return (
          <View
            accessibilityRole="list"
            key={key}
            style={[styles.list, !isLast && styles.blockSpacing]}
          >
            {block.items.map((item, itemIndex) => (
              <View
                key={`${key}-item-${itemIndex}`}
                style={styles.listRow}
              >
                <FitText style={[textStyle, styles.listMarker]}>
                  {block.type === "ordered-list" ? `${itemIndex + 1}.` : "•"}
                </FitText>
                <FitText style={[textStyle, styles.listText]}>
                  {renderInline(
                    item,
                    `${key}-item-${itemIndex}`,
                    colors.brand,
                    colors.surfaceRaised,
                  )}
                </FitText>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
