import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { CheckCircle, Search, X } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { makeBookingPickerStyles } from "@/styles/modals/BookingPickerStyles";
import { filterBookingPickerOptions } from "./bookingPickerFilters";
import { FitButton, FitSearch, FitText } from "@/components/fit";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

export type BookingPickerOption = {
  detail?: string;
  disabled?: boolean;
  id: string;
  keywords?: string[];
  subtitle?: string;
  title: string;
};

export type BookingPickerFilter = {
  id: string;
  label: string;
  selected: boolean;
};

type Props = {
  emptyMessage: string;
  errorMessage?: string | null;
  filters?: BookingPickerFilter[];
  isLoading?: boolean;
  isVisible: boolean;
  onClose: () => void;
  onFilterPress?: (id: string) => void;
  onRetry?: () => void;
  onSelect: (id: string) => void;
  options: BookingPickerOption[];
  searchPlaceholder: string;
  selectedId?: string | null;
  subtitle: string;
  title: string;
};

export default function SearchableBookingPickerModal({
  emptyMessage,
  errorMessage,
  filters = [],
  isLoading = false,
  isVisible,
  onClose,
  onFilterPress,
  onRetry,
  onSelect,
  options,
  searchPlaceholder,
  selectedId,
  subtitle,
  title,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeBookingPickerStyles(colors), [colors]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isVisible) setQuery("");
  }, [isVisible]);

  const visibleOptions = useMemo(() => {
    return filterBookingPickerOptions(options, query);
  }, [options, query]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[s.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Search size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerText}>
              <FitText style={s.title}>{title}</FitText>
              <FitText style={s.subtitle}>{subtitle}</FitText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              hitSlop={8}
              onPress={onClose}
            >
              <X size={20} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={s.body}>
            <FitSearch
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
            />
            {filters.length > 0 ? (
              <View style={s.filters}>
                {filters.map((filter) => (
                  <Pressable
                    key={filter.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter.selected }}
                    onPress={() => onFilterPress?.(filter.id)}
                    style={[
                      s.filterChip,
                      filter.selected && {
                        backgroundColor: colors.brand + "16",
                        borderColor: colors.brand,
                      },
                    ]}
                  >
                    <FitText
                      style={[
                        s.filterChipText,
                        filter.selected && { color: colors.brand },
                      ]}
                    >
                      {filter.label}
                    </FitText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {isLoading ? (
              <View style={s.stateBox}>
                <FitText style={s.stateText}>Loading live options...</FitText>
              </View>
            ) : errorMessage ? (
              <View style={s.stateBox}>
                <FitText style={[s.stateText, { color: colors.danger }]}>
                  {errorMessage}
                </FitText>
                {onRetry ? (
                  <FitButton variant="ghost" label="Retry" onPress={onRetry} />
                ) : null}
              </View>
            ) : visibleOptions.length === 0 ? (
              <View style={s.stateBox}>
                <FitText style={s.stateText}>{emptyMessage}</FitText>
              </View>
            ) : (
              <FitModalScrollView
                style={s.listHost}
                contentContainerStyle={s.list}
                keyboardShouldPersistTaps="handled"
                resetKey={`${isVisible}-${query}-${visibleOptions.length}`}
              >
                {visibleOptions.map((option) => {
                  const selected = option.id === selectedId;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: option.disabled, selected }}
                      disabled={option.disabled}
                      onPress={() => onSelect(option.id)}
                      style={[
                        s.row,
                        option.disabled && { opacity: 0.5 },
                        selected && {
                          backgroundColor: colors.brand + "12",
                          borderColor: colors.brand,
                        },
                      ]}
                    >
                      <View style={s.rowBody}>
                        <FitText style={s.rowTitle}>{option.title}</FitText>
                        {option.subtitle ? (
                          <FitText style={s.rowSubtitle}>{option.subtitle}</FitText>
                        ) : null}
                        {option.detail ? (
                          <FitText style={s.rowDetail}>{option.detail}</FitText>
                        ) : null}
                      </View>
                      {selected ? (
                        <CheckCircle size={18} color={colors.brand} strokeWidth={2} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </FitModalScrollView>
            )}
          </View>
          <View style={s.footer}>
            <FitButton variant="ghost" label="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
