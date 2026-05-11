"use client";
import { PAGE_NAMES, PAGE_SUBTITLES, type PageKey } from "@fittrack/app-config";
import { useTypewriter } from "@fittrack/hooks";
import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";
import { headerStyles } from "@/styles/layoutStyles";

type HeaderMessageProps = {
  pageKey: PageKey;
};

export default function HeaderMessage({ pageKey }: HeaderMessageProps) {
  const { colors, settings } = useTheme();
  const s = headerStyles(colors);
  const shouldAnimate = settings.animationLevel !== "none";
  const title = PAGE_NAMES[pageKey];
  const subtitle = PAGE_SUBTITLES[pageKey];
  const { typed: typedTitle } = useTypewriter({ text: title, charsPerSecond: 42, isActive: shouldAnimate });
  const { typed: typedSubtitle } = useTypewriter({ text: subtitle, charsPerSecond: 42, isActive: shouldAnimate });

  return (
    <div style={s.messageWrap}>
      <FitText as="h1" className="fit-header-title" style={s.messageTitle} excludeGlobalScale>
        {shouldAnimate ? typedTitle : title}
      </FitText>
      <FitText as="p" className="fit-header-subtitle" style={s.messageSubtitle} excludeGlobalScale>
        {shouldAnimate ? typedSubtitle : subtitle}
      </FitText>
    </div>
  );
}
