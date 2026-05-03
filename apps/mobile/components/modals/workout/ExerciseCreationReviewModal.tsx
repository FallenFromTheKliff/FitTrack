import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { WandSparkles, X } from "lucide-react-native";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import SkeletonRigPreview from "@/components/workout/SkeletonRigPreview";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  ExerciseAiDraftEvidenceRecord,
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  FitnessExerciseCategory,
} from "@fittrack/types";
import {
  DEFAULT_EXERCISE_HAND_SHAPE_PROFILE,
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
  validateExerciseEditorContract,
} from "@fittrack/utils";

export type ExerciseCreationDraft = {
  category: FitnessExerciseCategory;
  description: string;
  evidence: ExerciseAiDraftEvidenceRecord;
  handShapeProfile: ExerciseHandShapeProfileRecord;
  instructions: string;
  movementProfile: ExerciseMovementProfileRecord | null;
  muscleGroup: string;
  muscleTargets: ExerciseMuscleTargetRecord[];
  name: string;
  summary: string;
};

type Props = {
  draft: ExerciseCreationDraft | null;
  isSubmitting?: boolean;
  isVisible: boolean;
  onChangeDraft: (draft: ExerciseCreationDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function toValidationMessage(draft: ExerciseCreationDraft | null) {
  if (!draft) return "Capture at least three clean reps first.";
  if (draft.name.trim().length < 3) return "Exercise name needs at least 3 characters.";
  const contractValidation = validateExerciseEditorContract({
    handShapeProfile: draft.handShapeProfile,
    movementProfile: draft.movementProfile,
    muscleGroup: draft.muscleGroup,
    muscleTargets: draft.muscleTargets,
  });
  if (contractValidation.errors.length) return contractValidation.errors[0];
  if (draft.description.trim().length < 20) return "Add a clearer description.";
  if (draft.instructions.trim().length < 20) return "Add clear coaching instructions.";
  if (!draft.evidence.rig?.keyframes.length) return "Rig evidence is missing.";
  return null;
}

export default function ExerciseCreationReviewModal({
  draft,
  isSubmitting = false,
  isVisible,
  onChangeDraft,
  onClose,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] =
    useState<"rig" | "details" | "muscles" | "hands">("rig");
  const [activeKeyframeIndex, setActiveKeyframeIndex] = useState(0);
  const validationMessage = useMemo(() => toValidationMessage(draft), [draft]);

  const updateDraft = (patch: Partial<ExerciseCreationDraft>) => {
    if (!draft) return;
    onChangeDraft({ ...draft, ...patch });
  };

  const updateMuscleTargets = (targets: ExerciseMuscleTargetRecord[]) => {
    if (!draft) return;
    const muscleTargets = normalizeExerciseMuscleTargets(
      targets,
      draft.muscleGroup,
    );
    onChangeDraft({
      ...draft,
      muscleGroup: getPrimaryExerciseMuscleGroup(
        muscleTargets,
        draft.muscleGroup,
      ),
      muscleTargets,
    });
  };

  const updateHandShape = (patch: Partial<ExerciseHandShapeProfileRecord>) => {
    if (!draft) return;
    onChangeDraft({
      ...draft,
      handShapeProfile: normalizeExerciseHandShapeProfile({
        ...(draft.handShapeProfile ?? DEFAULT_EXERCISE_HAND_SHAPE_PROFILE),
        ...patch,
      }),
    });
  };

  const updateRigKeyframe = (patch: { angle?: number | null; label?: string }) => {
    if (!draft?.evidence.rig) return;
    const keyframes = draft.evidence.rig.keyframes.map((frame, index) =>
      index === activeKeyframeIndex ? { ...frame, ...patch } : frame,
    );
    const rig = { ...draft.evidence.rig, keyframes };
    onChangeDraft({
      ...draft,
      evidence: { ...draft.evidence, rig },
      movementProfile:
        normalizeExerciseMovementProfile(
          {
            ...(draft.movementProfile ?? {
              movementContract: draft.evidence.movementContract,
              rig,
              schemaVersion: "exercise_movement_profile_v1",
              warnings: [],
            }),
            rig,
          },
          {
            movementContract: draft.evidence.movementContract,
            rig,
          },
        ) ?? draft.movementProfile,
    });
  };

  const activeKeyframe = draft?.evidence.rig?.keyframes[activeKeyframeIndex];

  const renderField = (
    label: string,
    key: keyof Pick<
      ExerciseCreationDraft,
      "description" | "instructions" | "name" | "summary"
    >,
    placeholder: string,
  ) => (
    <View key={key}>
      <FitText
        style={{
          color: colors.textPrimary,
          fontSize: 12,
          fontWeight: "800",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </FitText>
      <TextInput
        multiline={key === "description" || key === "instructions"}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={draft?.[key]}
        onChangeText={(value) => updateDraft({ [key]: value })}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderRadius: 16,
          borderWidth: 1,
          color: colors.textPrimary,
          minHeight:
            key === "description" || key === "instructions" ? 82 : 48,
          paddingHorizontal: 14,
          paddingVertical: 12,
          textAlignVertical: "top",
        }}
      />
    </View>
  );

  const thresholdInput = (
    label: string,
    value: number,
    onChange: (nextValue: number) => void,
    stepLabel?: string,
  ) => (
    <View style={{ flex: 1, minWidth: 130 }}>
      <FitText
        style={{
          color: colors.textPrimary,
          fontSize: 11,
          fontWeight: "800",
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </FitText>
      <TextInput
        keyboardType="numeric"
        placeholder={stepLabel ?? "0"}
        placeholderTextColor={colors.textMuted}
        value={String(value)}
        onChangeText={(text) => {
          const parsed = Number(text);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderRadius: 14,
          borderWidth: 1,
          color: colors.textPrimary,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />
    </View>
  );

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.72)",
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: `${colors.border}AA`,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderWidth: 1,
            maxHeight: "90%",
            padding: 18,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: `${colors.brand}18`,
                borderRadius: 16,
                height: 42,
                justifyContent: "center",
                width: 42,
              }}
            >
              <WandSparkles color={colors.brand} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <FitText style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>
                Create Exercise Draft
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                Review the captured rig before sending it to Exercise Lab.
              </FitText>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X color={colors.textMuted} size={22} />
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: colors.surfaceRaised,
              borderRadius: 18,
              flexDirection: "row",
              gap: 8,
              marginTop: 18,
              padding: 5,
            }}
          >
            {(["rig", "details", "muscles", "hands"] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    alignItems: "center",
                    backgroundColor: active ? colors.brand : "transparent",
                    borderRadius: 14,
                    flex: 1,
                    paddingVertical: 10,
                  }}
                >
                  <FitText
                    style={{
                      color: active ? (colors.onBrand ?? "#FFFFFF") : colors.textMuted,
                      fontSize: 13,
                      fontWeight: "800",
                      textTransform: "uppercase",
                    }}
                  >
                    {tab === "rig"
                      ? "Rig"
                      : tab === "details"
                        ? "Details"
                        : tab === "muscles"
                          ? "Muscles"
                          : "Hands"}
                  </FitText>
                </Pressable>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
            {activeTab === "rig" ? (
              <View>
                <SkeletonRigPreview rig={draft?.evidence.rig ?? null} />
                {draft?.evidence.rig?.keyframes.length ? (
                  <View style={{ gap: 10, marginTop: 14 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {draft.evidence.rig.keyframes.map((frame, index) => (
                        <Pressable
                          key={frame.kind}
                          onPress={() => setActiveKeyframeIndex(index)}
                          style={{
                            backgroundColor:
                              activeKeyframeIndex === index
                                ? colors.brand
                                : colors.surfaceRaised,
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <FitText
                            style={{
                              color:
                                activeKeyframeIndex === index
                                  ? (colors.onBrand ?? "#FFFFFF")
                                  : colors.textMuted,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {frame.label || frame.kind}
                          </FitText>
                        </Pressable>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>
                          KEYFRAME LABEL
                        </FitText>
                        <TextInput
                          value={activeKeyframe?.label ?? ""}
                          onChangeText={(label) => updateRigKeyframe({ label })}
                          style={{
                            backgroundColor: colors.surfaceRaised,
                            borderColor: colors.border,
                            borderRadius: 14,
                            borderWidth: 1,
                            color: colors.textPrimary,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                          }}
                        />
                      </View>
                      {thresholdInput(
                        "Angle",
                        activeKeyframe?.angle ?? 0,
                        (angle) => updateRigKeyframe({ angle }),
                      )}
                    </View>
                  </View>
                ) : null}
                <View
                  style={{
                    backgroundColor: `${colors.brand}12`,
                    borderColor: `${colors.brand}44`,
                    borderRadius: 20,
                    borderWidth: 1,
                    marginTop: 14,
                    padding: 14,
                  }}
                >
                  <FitText style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "800" }}>
                    AI-ready movement contract
                  </FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>
                    {draft
                      ? `${draft.evidence.repCount} reps captured. Contract: ${draft.evidence.movementContract?.exercise ?? "unknown"} / ${draft.evidence.movementContract?.dominantJoint ?? "joint"} dominant.`
                      : "No draft is ready yet."}
                  </FitText>
                </View>
              </View>
            ) : activeTab === "details" ? (
              <View style={{ gap: 12 }}>
                {renderField("Name", "name", "Dumbbell Bicep Curl Variation")}
                {renderField("Summary", "summary", "Short review summary")}
                {renderField("Description", "description", "What this exercise trains")}
                {renderField("Instructions", "instructions", "How to perform this movement")}
              </View>
            ) : activeTab === "muscles" ? (
              <View style={{ gap: 12 }}>
                {(draft?.muscleTargets ?? []).map((target, index) => (
                  <View
                    key={`${target.role}-${target.muscleGroup}-${index}`}
                    style={{
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      borderRadius: 18,
                      borderWidth: 1,
                      gap: 10,
                      padding: 12,
                    }}
                  >
                    <TextInput
                      placeholder="Muscle group"
                      placeholderTextColor={colors.textMuted}
                      value={target.muscleGroup}
                      onChangeText={(muscleGroup) =>
                        updateMuscleTargets(
                          (draft?.muscleTargets ?? []).map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, muscleGroup } : entry,
                          ),
                        )
                      }
                      style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {(["primary", "secondary", "stabilizer"] as ExerciseMuscleTargetRole[]).map((role) => (
                        <Pressable
                          key={role}
                          onPress={() =>
                            updateMuscleTargets(
                              (draft?.muscleTargets ?? []).map((entry, currentIndex) =>
                                currentIndex === index ? { ...entry, role } : entry,
                              ),
                            )
                          }
                          style={{
                            backgroundColor: target.role === role ? colors.brand : colors.surface,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                          }}
                        >
                          <FitText style={{ color: target.role === role ? (colors.onBrand ?? "#FFF") : colors.textMuted, fontSize: 11, fontWeight: "800" }}>
                            {role}
                          </FitText>
                        </Pressable>
                      ))}
                    </View>
                    {thresholdInput("Effort %", target.allocationPercent, (allocationPercent) =>
                      updateMuscleTargets(
                        (draft?.muscleTargets ?? []).map((entry, currentIndex) =>
                          currentIndex === index
                            ? { ...entry, allocationPercent }
                            : entry,
                        ),
                      ),
                    )}
                  </View>
                ))}
                <FitButton
                  label="Add muscle target"
                  variant="ghost"
                  onPress={() =>
                    updateMuscleTargets([
                      ...(draft?.muscleTargets ?? []),
                      { allocationPercent: 20, muscleGroup: "", role: "secondary" },
                    ])
                  }
                />
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <FitButton
                    label={draft?.handShapeProfile.grip.required ? "Grip required" : "Grip optional"}
                    variant={draft?.handShapeProfile.grip.required ? "primary" : "ghost"}
                    onPress={() =>
                      draft &&
                      updateHandShape({
                        grip: {
                          ...draft.handShapeProfile.grip,
                          required: !draft.handShapeProfile.grip.required,
                        },
                      })
                    }
                    style={{ flex: 1 }}
                  />
                  <FitButton
                    label={draft?.handShapeProfile.subjectLockGesture.enabled ? "Lock gesture on" : "Lock gesture off"}
                    variant={draft?.handShapeProfile.subjectLockGesture.enabled ? "primary" : "ghost"}
                    onPress={() =>
                      draft &&
                      updateHandShape({
                        subjectLockGesture: {
                          ...draft.handShapeProfile.subjectLockGesture,
                          enabled: !draft.handShapeProfile.subjectLockGesture.enabled,
                        },
                      })
                    }
                    style={{ flex: 1 }}
                  />
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {draft
                    ? [
                        thresholdInput("Grip window", draft.handShapeProfile.grip.recentFrameLimit, (recentFrameLimit) =>
                          updateHandShape({ grip: { ...draft.handShapeProfile.grip, recentFrameLimit } }),
                        ),
                        thresholdInput("Usable frames", draft.handShapeProfile.grip.minUsableFrames, (minUsableFrames) =>
                          updateHandShape({ grip: { ...draft.handShapeProfile.grip, minUsableFrames } }),
                        ),
                        thresholdInput("Open frames", draft.handShapeProfile.grip.maxOpenFrames, (maxOpenFrames) =>
                          updateHandShape({ grip: { ...draft.handShapeProfile.grip, maxOpenFrames } }),
                        ),
                        thresholdInput("Open ratio", draft.handShapeProfile.grip.maxOpenRatio, (maxOpenRatio) =>
                          updateHandShape({ grip: { ...draft.handShapeProfile.grip, maxOpenRatio } }),
                          "0.18",
                        ),
                        thresholdInput("Hold ms", draft.handShapeProfile.subjectLockGesture.holdMs, (holdMs) =>
                          updateHandShape({
                            subjectLockGesture: {
                              ...draft.handShapeProfile.subjectLockGesture,
                              holdMs,
                            },
                          }),
                        ),
                        thresholdInput("Finger lift", draft.handShapeProfile.subjectLockGesture.minFingerLift, (minFingerLift) =>
                          updateHandShape({
                            subjectLockGesture: {
                              ...draft.handShapeProfile.subjectLockGesture,
                              minFingerLift,
                            },
                          }),
                          "0.035",
                        ),
                      ]
                    : null}
                </View>
              </View>
            )}
          </ScrollView>

          {validationMessage ? (
            <FitText
              style={{
                color: colors.warning,
                fontSize: 12,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              {validationMessage}
            </FitText>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <FitButton label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <FitButton
              disabled={!!validationMessage || isSubmitting}
              label={isSubmitting ? "Submitting..." : "Submit Draft"}
              onPress={onSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
