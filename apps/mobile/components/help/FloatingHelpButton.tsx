import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { HelpCircle, X } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";

type FloatingHelpButtonProps = {
  description: string;
  terms: Array<{ label: string; value: string }>;
  title: string;
};

export default function FloatingHelpButton({
  description,
  terms,
  title,
}: FloatingHelpButtonProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open help for ${title}`}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: colors.brand }]}
      >
        <HelpCircle size={24} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={2.2} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.panel,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.header}>
              <FitText style={[styles.title, { color: colors.textPrimary }]}>{title}</FitText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close help" onPress={() => setOpen(false)}>
                <X size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <FitText style={[styles.description, { color: colors.textMuted }]}>
              {description}
            </FitText>
            <View style={styles.termList}>
              {terms.map((term) => (
                <View key={term.label} style={styles.term}>
                  <FitText style={[styles.termLabel, { color: colors.textPrimary }]}>
                    {term.label}
                  </FitText>
                  <FitText style={[styles.termValue, { color: colors.textMuted }]}>
                    {term.value}
                  </FitText>
                </View>
              ))}
            </View>
            <FitButton
              label="Open Support Settings"
              variant="ghost"
              onPress={() => {
                setOpen(false);
                router.push("/(tabs)/settings");
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.28)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
  },
  button: {
    alignItems: "center",
    borderRadius: 28,
    bottom: 96,
    elevation: 6,
    height: 54,
    justifyContent: "center",
    position: "absolute",
    right: 20,
    width: 54,
    zIndex: 30,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    width: "100%",
  },
  term: {
    gap: 3,
  },
  termLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  termList: {
    gap: 10,
  },
  termValue: {
    fontSize: 12,
    lineHeight: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
});
