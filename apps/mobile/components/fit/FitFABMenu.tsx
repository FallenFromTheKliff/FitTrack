import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { FitText } from "@/components/fit/FitText";
import { type FABMenuItem } from "@/contexts/FABStateContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFABOptionAnim } from "@/hooks/animations/ui/useFABOptions";
import { makeFABMenuStyles } from "@/styles/components/FitStyles";

type Props = {
  items: FABMenuItem[];
  isOpen: boolean;
};

export default function FitFABMenu({ items, isOpen }: Props) {
  const { colors, settings } = useTheme();
  const useAnims = settings.animationLevel !== "none";
  const s = useMemo(() => makeFABMenuStyles(colors), [colors]);

  const optAnims = [
    useFABOptionAnim(0, isOpen, useAnims),
    useFABOptionAnim(1, isOpen, useAnims),
    useFABOptionAnim(2, isOpen, useAnims),
    useFABOptionAnim(3, isOpen, useAnims)
  ];

  if (!isOpen) return null;

  return (
    <View style={s.panel}>
      {items.map((item, idx) => (
        <Animated.View key={item.label} style={optAnims[idx]?.style}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.label}${item.sub ? `. ${item.sub}` : ""}`}
            style={s.row}
            onPress={() => {
              setTimeout(() => item.onPress(), 0);
            }}
          >
            <View style={[s.iconBox, { backgroundColor: item.iconBg }]}>
              <item.icon size={20} color={item.iconColor} strokeWidth={2} />
            </View>
            <View>
              <FitText style={s.label}>{item.label}</FitText>
              {item.sub ? <FitText style={s.sub}>{item.sub}</FitText> : null}
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
