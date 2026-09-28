import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Search, XCircle } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { FitTextInput } from "@/components/fit/FitText";
import { useDebounce } from "@fittrack/hooks";
import { makeFitSearchStyles } from "@/styles/components/FitStyles";

type Props = {
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  isFabOpen?: boolean;
};

export default function FitSearch({ placeholder = "Search...", value, onChangeText, isFabOpen = false }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeFitSearchStyles(colors), [colors]);
  const [inputValue, setInputValue] = useState(value);
  const debouncedInput = useDebounce(inputValue, 300);
  const searchLabel = placeholder.replace(/\.+$/, "").trim() || "Search";
  const searchId = `${searchLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-input`;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (debouncedInput !== value) onChangeText(debouncedInput);
  }, [debouncedInput, onChangeText, value]);

  return (
    <View style={s.searchBar}>
      <Search size={18} color={colors.textMuted} strokeWidth={2} />
      <FitTextInput
        nativeID={searchId}
        accessibilityLabel={searchLabel}
        placeholder={placeholder}
        value={inputValue}
        onChangeText={setInputValue}
        editable={!isFabOpen}
        style={s.searchInput}
      />
      {inputValue.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${searchLabel.toLowerCase()}`}
          onPress={() => setInputValue("")}
          style={s.searchClear}
          hitSlop={8}
          disabled={isFabOpen}
        >
          <XCircle size={18} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}
