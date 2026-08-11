import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  Apple,
  Beef,
  Coffee,
  Cookie,
  Dumbbell,
  Milk,
  Salad,
  Sandwich,
  UtensilsCrossed,
  type LucideIcon
} from "lucide-react-native";

import type { NutritionIconKind, NutritionMealIconLibraryKey } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { MOBILE_API_BASE_URL } from "@/lib/api-client";

type MealIconValue = {
  assetKey?: string | null;
  key?: NutritionMealIconLibraryKey | null;
  kind: NutritionIconKind;
};

type Props = {
  color: string;
  icon?: MealIconValue | null;
  previewUri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export const NUTRITION_MEAL_ICON_COMPONENTS: Record<NutritionMealIconLibraryKey, LucideIcon> = {
  apple: Apple,
  beef: Beef,
  coffee: Coffee,
  cookie: Cookie,
  dumbbell: Dumbbell,
  milk: Milk,
  salad: Salad,
  sandwich: Sandwich,
  utensils: UtensilsCrossed
};

const styles = StyleSheet.create({
  image: {
    borderRadius: 8,
    height: "100%",
    width: "100%"
  },
  root: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
});

export default function NutritionMealIcon({ color, icon, previewUri, size = 18, style }: Props) {
  const customUri = previewUri ?? (
    icon?.kind === "custom"
      ? buildRenderableAssetUrl({ apiBaseUrl: MOBILE_API_BASE_URL, assetKey: icon.assetKey })
      : null
  );

  if (customUri) {
    return (
      <View
        accessibilityLabel="Custom meal illustration"
        accessible
        style={[styles.root, { height: size + 8, width: size + 8 }, style]}
      >
        <Image source={{ uri: customUri }} resizeMode="cover" style={styles.image} />
      </View>
    );
  }

  const key = icon?.kind === "library" && icon.key ? icon.key : "utensils";
  const Icon = NUTRITION_MEAL_ICON_COMPONENTS[key] ?? UtensilsCrossed;
  return (
    <View accessibilityLabel={`${key} meal icon`} accessible style={[styles.root, style]}>
      <Icon color={color} size={size} strokeWidth={2} />
    </View>
  );
}
