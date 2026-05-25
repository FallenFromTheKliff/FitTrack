import { StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";

import { R } from "@fittrack/ui/tokens";

import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

type FeatureHeaderProps = {
  children?: ReactNode;
  icon: LucideIcon;
  iconMode?: "boxed" | "none";
  meta?: string;
  subtitle?: string;
  title?: string;
};

export default function FeatureHeader({
  children,
  icon: Icon,
  iconMode = "boxed",
  meta,
  subtitle,
  title,
}: FeatureHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {iconMode === "boxed" ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.brand + "14",
              borderColor: colors.brand + "30",
            },
          ]}
        >
          <Icon size={30} color={colors.brand} strokeWidth={2.2} />
        </View>
      ) : null}
      <View style={styles.info}>
        {children ? (
          children
        ) : (
          <>
            {title ? (
              <FitText style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </FitText>
            ) : null}
            {subtitle ? (
              <FitText style={[styles.subtitle, { color: colors.textMuted }]}>
                {subtitle}
              </FitText>
            ) : null}
          </>
        )}
        {meta ? (
          <FitText style={[styles.meta, { color: colors.textMuted }]}>
            {meta}
          </FitText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    borderBottomWidth: 1,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: R.xl,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    overflow: "hidden",
    width: 64,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.65,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
});
