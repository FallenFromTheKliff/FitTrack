"use client";
import { useTheme } from "@/contexts/ThemeContext";
import { useTypewriter } from "@/hooks/animations/useTypewriter";
import { FitText } from "@/components/fit/FitText";
import { headerStyles } from "@/styles/layoutStyles";
import { ADMIN_SUBTITLES, PAGE_NAMES } from "@/data/ui/labels";
import type { PageKey } from "@/data/ui/labels";

type HeaderMessageProps = {
  pageKey: PageKey;
};

export default function HeaderMessage({ pageKey }: HeaderMessageProps) {
  const { colors, settings } = useTheme();
  const s = headerStyles(colors);
  const shouldAnimate = settings.animationLevel !== "none";
  const title = PAGE_NAMES[pageKey];
  const subtitle = ADMIN_SUBTITLES[pageKey];
  const typedTitle = useTypewriter({ text: title, charsPerSecond: 42, isActive: shouldAnimate });
  const typedSubtitle = useTypewriter({ text: subtitle, charsPerSecond: 42, isActive: shouldAnimate });

  return (
    <div style={s.messageWrap}>
      <FitText as="h1" style={s.messageTitle}>
        {shouldAnimate ? typedTitle : title}
      </FitText>
      <FitText as="p" style={s.messageSubtitle}>
        {shouldAnimate ? typedSubtitle : subtitle}
      </FitText>
    </div>
  );
}