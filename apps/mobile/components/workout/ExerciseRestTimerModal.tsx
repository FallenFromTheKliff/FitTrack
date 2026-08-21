import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";
import { ArrowLeft, Minus, Plus, X } from "lucide-react-native";

import { FitButton, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

const REST_STEP_SECONDS = 15;
const MAX_REST_SECONDS = 600;

type RestTimerValue = {
  restSeconds: number;
  restSecondsBySet: number[] | null;
};

type ExerciseRestTimerModalProps = RestTimerValue & {
  exerciseName: string;
  isVisible: boolean;
  onClose: () => void;
  onSave: (value: RestTimerValue) => void;
  sets: number;
};

function clampSeconds(value: number) {
  return Math.max(0, Math.min(MAX_REST_SECONDS, value));
}

export default function ExerciseRestTimerModal({
  exerciseName,
  isVisible,
  onClose,
  onSave,
  restSeconds,
  restSecondsBySet,
  sets,
}: ExerciseRestTimerModalProps) {
  const { colors } = useTheme();
  const [defaultSeconds, setDefaultSeconds] = useState(restSeconds);
  const [perSet, setPerSet] = useState(Boolean(restSecondsBySet));
  const [setSeconds, setSetSeconds] = useState<number[]>([]);
  const [showSetTimes, setShowSetTimes] = useState(false);

  useEffect(() => {
    if (!isVisible) return;
    setDefaultSeconds(restSeconds);
    setPerSet(Boolean(restSecondsBySet));
    setSetSeconds(
      Array.from(
        { length: sets },
        (_, index) => restSecondsBySet?.[index] ?? restSeconds,
      ),
    );
    setShowSetTimes(false);
  }, [isVisible, restSeconds, restSecondsBySet, sets]);

  const changeDefault = (amount: number) => {
    setDefaultSeconds((current) => clampSeconds(current + amount));
  };

  const changeSet = (index: number, amount: number) => {
    setSetSeconds((current) =>
      current.map((value, valueIndex) =>
        valueIndex === index ? clampSeconds(value + amount) : value,
      ),
    );
  };

  const save = () => {
    onSave({
      restSeconds: defaultSeconds,
      restSecondsBySet: perSet ? setSeconds : null,
    });
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={isVisible}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.76)",
          flex: 1,
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          accessibilityLabel="Exercise rest timer"
          style={{
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: 16,
            borderWidth: 1,
            maxHeight: "82%",
            maxWidth: 360,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <View
            style={{
              alignItems: "center",
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              gap: 10,
              minHeight: 58,
              paddingHorizontal: 14,
            }}
          >
            {showSetTimes ? (
              <Pressable
                accessibilityLabel="Back to rest timer"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowSetTimes(false)}
                style={{ padding: 4 }}
              >
                <ArrowLeft color={colors.textPrimary} size={19} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <FitText
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "900",
                }}
              >
                {showSetTimes ? "Set times" : "Rest timer"}
              </FitText>
              <FitText
                numberOfLines={1}
                style={{ color: colors.textMuted, fontSize: 10.5 }}
              >
                {exerciseName}
              </FitText>
            </View>
            <Pressable
              accessibilityLabel="Close rest timer"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={{ padding: 4 }}
            >
              <X color={colors.textMuted} size={18} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 10, padding: 14 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {showSetTimes ? (
              setSeconds.map((seconds, index) => (
                <View
                  key={index}
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: 9,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 12,
                    justifyContent: "space-between",
                    minHeight: 48,
                    paddingHorizontal: 12,
                  }}
                >
                  <FitText
                    style={{
                      color: colors.textPrimary,
                      flex: 1,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    Set {index + 1}
                  </FitText>
                  <Pressable
                    accessibilityLabel={`Decrease set ${index + 1} rest`}
                    hitSlop={8}
                    onPress={() => changeSet(index, -REST_STEP_SECONDS)}
                    style={{ padding: 5 }}
                  >
                    <Minus color={colors.textMuted} size={16} />
                  </Pressable>
                  <FitText
                    style={{
                      color: colors.textPrimary,
                      fontSize: 12,
                      fontWeight: "900",
                      minWidth: 42,
                      textAlign: "center",
                    }}
                  >
                    {seconds}s
                  </FitText>
                  <Pressable
                    accessibilityLabel={`Increase set ${index + 1} rest`}
                    hitSlop={8}
                    onPress={() => changeSet(index, REST_STEP_SECONDS)}
                    style={{ padding: 5 }}
                  >
                    <Plus color={colors.brand} size={16} />
                  </Pressable>
                </View>
              ))
            ) : (
              <>
                {perSet ? (
                  <Pressable
                    accessibilityLabel="Set individual rest times"
                    accessibilityRole="button"
                    onPress={() => setShowSetTimes(true)}
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.surface,
                      borderColor: colors.brand,
                      borderRadius: 9,
                      borderWidth: 1,
                      justifyContent: "center",
                      minHeight: 48,
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      Set times
                    </FitText>
                  </Pressable>
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: 9,
                      borderWidth: 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      minHeight: 48,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Pressable
                      accessibilityLabel="Decrease rest time"
                      hitSlop={8}
                      onPress={() => changeDefault(-REST_STEP_SECONDS)}
                      style={{ padding: 5 }}
                    >
                      <Minus color={colors.textMuted} size={16} />
                    </Pressable>
                    <View style={{ alignItems: "center", gap: 1 }}>
                      <FitText
                        style={{
                          color: colors.textPrimary,
                          fontSize: 13,
                          fontWeight: "900",
                        }}
                      >
                        {defaultSeconds}s
                      </FitText>
                      <FitText
                        style={{ color: colors.textMuted, fontSize: 9.5 }}
                      >
                        After each set
                      </FitText>
                    </View>
                    <Pressable
                      accessibilityLabel="Increase rest time"
                      hitSlop={8}
                      onPress={() => changeDefault(REST_STEP_SECONDS)}
                      style={{ padding: 5 }}
                    >
                      <Plus color={colors.brand} size={16} />
                    </Pressable>
                  </View>
                )}

                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: 44,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <FitText
                      style={{
                        color: colors.textPrimary,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      Per set
                    </FitText>
                    <FitText style={{ color: colors.textMuted, fontSize: 9.5 }}>
                      Use a different timer for each set.
                    </FitText>
                  </View>
                  <Switch
                    accessibilityLabel="Use individual rest times per set"
                    onValueChange={(enabled) => {
                      setPerSet(enabled);
                      if (enabled) {
                        setSetSeconds(
                          Array.from(
                            { length: sets },
                            (_, index) => setSeconds[index] ?? defaultSeconds,
                          ),
                        );
                      }
                    }}
                    thumbColor={perSet ? colors.brand : colors.textMuted}
                    trackColor={{
                      false: colors.border,
                      true: `${colors.brand}66`,
                    }}
                    value={perSet}
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View
            style={{
              borderTopColor: colors.border,
              borderTopWidth: 1,
              flexDirection: "row",
              gap: 8,
              padding: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <FitButton label="Cancel" onPress={onClose} variant="ghost" />
            </View>
            <View style={{ flex: 1 }}>
              <FitButton label="Save" onPress={save} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
