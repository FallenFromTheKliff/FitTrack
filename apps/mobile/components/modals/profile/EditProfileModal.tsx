import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Camera, Dumbbell, User } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AuthUser, CoachProfileRecord } from "@fittrack/types";
import {
  buildRenderableAssetUrl,
  calcBMI,
  formatBookingDate,
  splitFullName
} from "@fittrack/utils";
import {
  coachProfileSchema,
  editProfilePersonalSchema,
  formatPhilippineMobileForInput,
  getLatestAllowedMemberBirthDate,
  normalizePhilippineMobileNumber,
  sanitizePhilippineMobileInput,
  type EditProfilePersonalData
} from "@fittrack/validators";
import { updateCoachProfileMutationOptions, updatePhoneMutationOptions, updateProfileMutationOptions, uploadImageMutationOptions } from "@fittrack/query";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { MOBILE_API_BASE_URL, mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makeEditProfileModalStyles } from "@/styles/modals/EditProfileStyles";

import CalendarModal from "@/components/modals/shared/CalendarModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import { FitAvatarImage, FitButton, FitInputField, FitText, FitTextInput } from "@/components/fit";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  coachProfile?: CoachProfileRecord | null;
};

const capitalize = (value: string) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const GENDER_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" }
] as const;

type GenderOptionValue = (typeof GENDER_OPTIONS)[number]["value"];

const normalizeGenderOption = (value?: string | null): GenderOptionValue => {
  const normalized = value?.toLowerCase();
  return normalized === "male" || normalized === "female" || normalized === "other"
    ? normalized
    : "other";
};

type SelectedAvatarAsset = {
  file?: File | null;
  fileName?: string | null;
  mimeType?: string | null;
  uri: string;
};

const createAvatarUploadPart = async (asset: SelectedAvatarAsset) => {
  const fileName = asset.fileName ?? `avatar-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? "image/jpeg";

  if (Platform.OS !== "web") {
    return {
      uri: asset.uri,
      name: fileName,
      type: mimeType
    };
  }

  if (asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || mimeType
  });
};

export default function EditProfileModal({ isVisible, onClose, coachProfile = null }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const { height: windowHeight } = useWindowDimensions();
  const s = useMemo(() => makeEditProfileModalStyles(colors), [colors]);
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const isCoach = user?.role === "COACH";
  const updateProfileMutation = useMutation(updateProfileMutationOptions(mobileApiClient));
  const updatePhoneMutation = useMutation(updatePhoneMutationOptions(mobileApiClient));
  const uploadImageMutation = useMutation(uploadImageMutationOptions(mobileApiClient));
  const updateCoachProfileMutation = useMutation(updateCoachProfileMutationOptions(mobileApiClient, queryClient));

  const [activeTab, setActiveTab] = useState<"personal" | "fitness">("personal");
  const [isDobCalOpen, setIsDobCalOpen] = useState(false);
  const [avatarAsset, setAvatarAsset] = useState<SelectedAvatarAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coachBio, setCoachBio] = useState("");
  const [coachSpecialties, setCoachSpecialties] = useState("");
  const [coachCertifications, setCoachCertifications] = useState("");
  const [coachHourlyRate, setCoachHourlyRate] = useState("");
  const personalForm = useForm<EditProfilePersonalData>({
    resolver: zodResolver(editProfilePersonalSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      gender: "other"
    }
  });
  const savingText = useLoadingText("Saving", isSubmitting);
  const latestAllowedBirthDate = useMemo(() => getLatestAllowedMemberBirthDate(), []);
  const { reset: resetPersonal } = personalForm;
  const wasVisibleRef = useRef(false);
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const coachSnapshot = useRef({
    bio: "",
    specialties: "",
    certifications: "",
    hourlyRate: ""
  });
  const userName = user?.name ?? "";
  const userEmail = user?.email ?? "";
  const userPhone = user?.phone_no ?? "";
  const userDob = user?.dateOfBirth ?? "";
  const userGender = normalizeGenderOption(user?.gender ?? user?.profile?.gender);
  const userWeight = user?.weightKg;
  const userHeight = user?.heightCm;
  const statusValue = (user?.status ?? "active").toLowerCase();
  const statusLabel = statusValue === "frozen" ? "Frozen" : statusValue === "expired" ? "Expired" : "Active";
  const statusColor = statusValue === "frozen" ? colors.warning : statusValue === "expired" ? colors.danger : colors.success;
  const modalCardHeight = Math.max(
    280,
    Math.min(windowHeight - 32, windowHeight * 0.88)
  );

  useEffect(() => {
    const isOpening = isVisible && !wasVisibleRef.current;
    if (isOpening) {
      const { firstName: fn, lastName: ln } = splitFullName(userName);
      resetPersonal({
        firstName: fn,
        lastName: ln,
        email: userEmail,
        phone: formatPhilippineMobileForInput(userPhone),
        dateOfBirth: userDob,
        gender: userGender
      });
      setWeightInput(String(userWeight ?? ""));
      setHeightInput(String(userHeight ?? ""));
      setAvatarAsset(null);
      setActiveTab("personal");
      setIsDobCalOpen(false);
      setIsSubmitting(false);
      const nextCoachState = {
        bio: coachProfile?.bio ?? "",
        specialties: coachProfile?.specialties?.join(", ") ?? "",
        certifications: coachProfile?.certifications?.join(", ") ?? "",
        hourlyRate: coachProfile?.hourlyRate != null ? String(coachProfile.hourlyRate) : ""
      };
      coachSnapshot.current = nextCoachState;
      setCoachBio(nextCoachState.bio);
      setCoachSpecialties(nextCoachState.specialties);
      setCoachCertifications(nextCoachState.certifications);
      setCoachHourlyRate(nextCoachState.hourlyRate);
    }

    if (!isVisible) {
      setIsDobCalOpen(false);
    }

    wasVisibleRef.current = isVisible;
  }, [
    coachProfile,
    isVisible,
    resetPersonal,
    userDob,
    userEmail,
    userGender,
    userHeight,
    userName,
    userPhone,
    userWeight
  ]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });
    const nextAsset = result.canceled ? null : result.assets[0];
    if (nextAsset?.uri) {
      setAvatarAsset({
        file: nextAsset.file ?? null,
        fileName: nextAsset.fileName,
        mimeType: nextAsset.mimeType,
        uri: nextAsset.uri
      });
    }
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  const dateOfBirth = personalForm.watch("dateOfBirth") ?? "";
  const selectedGender = personalForm.watch("gender") ?? "other";
  const wKg = parseFloat(weightInput);
  const hCm = parseFloat(heightInput);
  const bmiResult = wKg > 0 && hCm > 0 ? calcBMI(wKg, hCm) : null;
  const avatarInitials =
    [
      (personalForm.watch("firstName") ?? "").trim().charAt(0),
      (personalForm.watch("lastName") ?? "").trim().charAt(0)
    ]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.avatarInitials ||
    "?";
  const displayedAvatarUri = buildRenderableAssetUrl({
    apiBaseUrl: MOBILE_API_BASE_URL,
    assetUrl: avatarAsset?.uri ?? user?.avatarUri ?? null
  });
  const isFitnessDirty = weightInput !== String(userWeight ?? "") || heightInput !== String(userHeight ?? "");
  const isCoachDirty = isCoach && (
    coachBio !== coachSnapshot.current.bio ||
    coachSpecialties !== coachSnapshot.current.specialties ||
    coachCertifications !== coachSnapshot.current.certifications ||
    coachHourlyRate !== coachSnapshot.current.hourlyRate
  );
  const isDirty = personalForm.formState.isDirty || isFitnessDirty || !!avatarAsset || isCoachDirty;

  const buildPatch = (personal: EditProfilePersonalData): Partial<AuthUser> => {
    const fullName = [personal.firstName.trim(), personal.lastName.trim()].filter(Boolean).join(" ");
    const normalizedPhone = normalizePhilippineMobileNumber(personal.phone);
    const patch: Partial<AuthUser> = {
      name: fullName || user?.name,
      email: user?.email ?? "",
      phone_no: (normalizedPhone || user?.phone_no) ?? null,
      dateOfBirth: personal.dateOfBirth || undefined,
      gender: personal.gender
    };
    const wKgNum = parseFloat(weightInput);
    const hCmNum = parseFloat(heightInput);
    if (wKgNum > 0) patch.weightKg = wKgNum;
    if (hCmNum > 0) patch.heightCm = hCmNum;
    return patch;
  };

  const commitSave = async (personal: EditProfilePersonalData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const normalizedPhone = normalizePhilippineMobileNumber(personal.phone);
    const currentPhone = normalizePhilippineMobileNumber(user?.phone_no ?? "");
    const phoneChanged = normalizedPhone !== currentPhone;
    const patch = buildPatch(personal);
    try {
      const coachPayload = coachProfileSchema.parse({
        bio: coachBio,
        specialties: coachSpecialties,
        certifications: coachCertifications,
        hourlyRate: coachHourlyRate
      });
      const wKgNum = parseFloat(weightInput);
      const hCmNum = parseFloat(heightInput);
      let nextAvatarUri = user?.avatarUri;
      if (avatarAsset) {
        const formData = new FormData();
        formData.append("file", await createAvatarUploadPart(avatarAsset) as never);
        const avatarResult = await uploadImageMutation.mutateAsync(formData);
        nextAvatarUri = avatarResult.url;
      }
      await updateProfileMutation.mutateAsync({
        firstName: personal.firstName.trim() || undefined,
        lastName: personal.lastName.trim() || undefined,
        avatarUrl: nextAvatarUri,
        dateOfBirth: personal.dateOfBirth || undefined,
        gender: personal.gender,
        currentWeightKg: !isCoach && wKgNum > 0 ? wKgNum : undefined,
        heightCm: !isCoach && hCmNum > 0 ? hCmNum : undefined
      });
      if (phoneChanged) {
        if (!normalizedPhone) {
          throw new Error("Phone number removal is not available in profile settings.");
        }
        await updatePhoneMutation.mutateAsync({
          phone_number: normalizedPhone
        });
      }
      if (isCoach) {
        await updateCoachProfileMutation.mutateAsync({
          payload: {
            bio: coachPayload.bio || undefined,
            specialties: coachPayload.specialties,
            certifications: coachPayload.certifications,
            hourlyRate: coachPayload.hourlyRate
          },
          userId: user?.id,
          coachId: coachProfile?.id
        });
      }
      await Promise.all([
        updateUser({
          ...patch,
          avatarUri: nextAvatarUri,
          profile: {
            ...user?.profile,
            avatarUrl: nextAvatarUri ?? null,
            firstName: personal.firstName.trim() || null,
            lastName: personal.lastName.trim() || null,
            dateOfBirth: personal.dateOfBirth || null,
            gender: personal.gender ?? null,
            currentWeightKg: !isCoach && wKgNum > 0 ? wKgNum : null,
            heightCm: !isCoach && hCmNum > 0 ? hCmNum : null
          }
        }),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
      setAvatarAsset(null);
      onClose();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = personalForm.handleSubmit(async (personal) => {
    if (isSubmitting) return;
    await commitSave(personal);
  });

  const handleClose = () => {
    if (isSubmitting) return;
    setIsDobCalOpen(false);
    onClose();
  };

  const roleValue = capitalize(user?.role ?? "");
  const hasPaidMembership = user?.membershipCard?.status === "active";
  const tierValue = hasPaidMembership ? "MEMBER" : "FREE";
  const memberSinceValue = user?.memberSince
    ? new Date(user.memberSince).toLocaleString("en-US", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        year: "numeric"
      })
    : "--";

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[s.backdrop, { backgroundColor: colors.overlay }]}>
        <Animated.View style={[s.card, { height: modalCardHeight }, cardStyle]}>
          <View style={s.header}>
            <View style={s.tabPill}>
              <Pressable style={[s.tabBtn, activeTab === "personal" && s.tabBtnActive]} onPress={() => setActiveTab("personal")}>
                <User size={14} color={activeTab === "personal" ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
                <FitText style={[s.tabLabel, activeTab === "personal" && s.tabLabelActive]}>Personal</FitText>
              </Pressable>
              <Pressable style={[s.tabBtn, activeTab === "fitness" && s.tabBtnActive]} onPress={() => setActiveTab("fitness")}>
                <Dumbbell size={14} color={activeTab === "fitness" ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
                <FitText style={[s.tabLabel, activeTab === "fitness" && s.tabLabelActive]}>{isCoach ? "Coach" : "Fitness"}</FitText>
              </Pressable>
            </View>
          </View>
          <FitModalScrollView
            style={s.scrollHost}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={s.body}
            resetKey={`${isVisible}-${activeTab}`}
          >
            {activeTab === "personal" ? (
              <>
                <View style={s.avatarRow}>
                  <Pressable onPress={handlePickImage}>
                    <View style={s.avatarWrap}>
                      {displayedAvatarUri ? (
                        <FitAvatarImage
                          alt={`${user?.name ?? "Member"} avatar`}
                          borderRadius={16}
                          uri={displayedAvatarUri}
                          fallback={
                            <View style={s.avatarCircle}>
                              <FitText style={s.avatarInitialsText}>{avatarInitials}</FitText>
                            </View>
                          }
                        />
                      ) : (
                        <View style={s.avatarCircle}>
                          <FitText style={s.avatarInitialsText}>{avatarInitials}</FitText>
                        </View>
                      )}
                      <View style={s.avatarCameraBadge}>
                        <Camera size={12} color={colors.surface} strokeWidth={2.5} />
                      </View>
                    </View>
                  </Pressable>
                  <View style={[s.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                    <FitText style={[s.statusText, { color: statusColor }]}>{statusLabel}</FitText>
                  </View>
                </View>
                <FitInputField
                  control={personalForm.control}
                  name="firstName"
                  label="First Name"
                  placeholder="First name"
                  errors={personalForm.formState.errors}
                  autoCapitalize="words"
                  compact
                  editable={!isSubmitting}
                />
                <FitInputField
                  control={personalForm.control}
                  name="lastName"
                  label="Last Name"
                  placeholder="Last name"
                  errors={personalForm.formState.errors}
                  autoCapitalize="words"
                  compact
                  editable={!isSubmitting}
                />
                <FitInputField
                  control={personalForm.control}
                  name="email"
                  label="Email"
                  placeholder="you@domain.com"
                  errors={personalForm.formState.errors}
                  keyboardType="email-address"
                  compact
                  editable={false}
                />
                <FitText style={{ fontSize: 12, color: colors.textMuted, marginTop: -4, marginBottom: 4 }}>
                  Email updates are managed outside profile settings.
                </FitText>
                <FitInputField
                  control={personalForm.control}
                  name="phone"
                  label="Phone"
                  placeholder="0917xxxxxxx"
                  errors={personalForm.formState.errors}
                  keyboardType="phone-pad"
                  maxLength={11}
                  sanitizeValue={sanitizePhilippineMobileInput}
                  compact
                  editable={!isSubmitting}
                />
                <FitInputField
                  control={personalForm.control}
                  name="dateOfBirth"
                  label="Date of Birth"
                  placeholder="Select date"
                  errors={personalForm.formState.errors}
                  pressable
                  trailingIcon={CalendarDays}
                  displayValue={dateOfBirth ? formatBookingDate(dateOfBirth) : undefined}
                  onPress={() => setIsDobCalOpen(true)}
                  compact
                  editable={!isSubmitting}
                />
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Gender</FitText>
                  <View style={s.genderOptionRow}>
                    {GENDER_OPTIONS.map((option) => {
                      const isActive = selectedGender === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          disabled={isSubmitting}
                          onPress={() =>
                            personalForm.setValue("gender", option.value, {
                              shouldDirty: true
                            })
                          }
                          style={[
                            s.genderOption,
                            isActive && {
                              backgroundColor: colors.brand + "18",
                              borderColor: colors.brand
                            }
                          ]}
                        >
                          <FitText
                            style={[
                              s.genderOptionText,
                              { color: isActive ? colors.brand : colors.textMuted }
                            ]}
                          >
                            {option.label}
                          </FitText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ) : isCoach ? (
              <>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Role</FitText>
                  <FitTextInput value={roleValue || "--"} editable={false} style={[s.fitInput, { color: colors.brand }]} />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Hourly Rate</FitText>
                  <FitTextInput
                    value={coachHourlyRate}
                    placeholder="e.g. 850"
                    keyboardType="phone-pad"
                    editable={!isSubmitting}
                    onChangeText={(text) => setCoachHourlyRate(text.replace(/[^0-9]/g, ""))}
                    style={s.fitInput}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Specialties</FitText>
                  <FitTextInput
                    value={coachSpecialties}
                    placeholder="Strength, Boxing"
                    editable={!isSubmitting}
                    onChangeText={setCoachSpecialties}
                    style={s.fitInput}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Certifications</FitText>
                  <FitTextInput
                    value={coachCertifications}
                    placeholder="NASM, CPR"
                    editable={!isSubmitting}
                    onChangeText={setCoachCertifications}
                    style={s.fitInput}
                  />
                </View>
                <View style={s.bmiCard}>
                  <FitText style={s.fitLabel}>Bio</FitText>
                  <FitTextInput
                    value={coachBio}
                    placeholder="Tell members about your coaching style"
                    editable={!isSubmitting}
                    onChangeText={setCoachBio}
                    multiline
                    style={[s.fitInput, { minHeight: 72, textAlignVertical: "top" }]}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Role</FitText>
                  <FitTextInput
                    value={roleValue || "--"}
                    editable={false}
                    style={[s.fitInput, { color: colors.brand }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Tier</FitText>
                  <FitTextInput
                    value={tierValue || "--"}
                    editable={false}
                    style={[s.fitInput, { color: colors.brand }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Member Since</FitText>
                  <FitTextInput
                    value={memberSinceValue}
                    editable={false}
                    style={[s.fitInput, { color: colors.textSecondary }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Weight (kg)</FitText>
                  <FitTextInput
                    value={weightInput}
                    placeholder="e.g. 70"
                    keyboardType="phone-pad"
                    maxLength={3}
                    editable={!isSubmitting}
                    onChangeText={(text) => setWeightInput(text.replace(/[^0-9]/g, ""))}
                    style={s.fitInput}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Height (cm)</FitText>
                  <FitTextInput
                    value={heightInput}
                    placeholder="e.g. 170"
                    keyboardType="phone-pad"
                    maxLength={3}
                    editable={!isSubmitting}
                    onChangeText={(text) => setHeightInput(text.replace(/[^0-9]/g, ""))}
                    style={s.fitInput}
                  />
                </View>
                <View style={s.bmiCard}>
                  <FitText style={s.fitLabel}>BMI</FitText>
                  <View style={s.bmiRow}>
                    <FitText style={[s.bmiValue, { color: bmiResult ? colors.brand : colors.textDisabled }]}>
                      {bmiResult ? String(bmiResult.bmi) : "--"}
                    </FitText>
                    {bmiResult ? <FitText style={s.bmiLabel}>{bmiResult.status}</FitText> : null}
                  </View>
                </View>
              </>
            )}
          </FitModalScrollView>
          <View style={s.footer}>
            <FitButton
              label="Cancel"
              variant="ghost"
              onPress={handleClose}
              disabled={isSubmitting}
              style={s.cancelBtn}
            />
            <FitButton
              label={isSubmitting ? savingText : "Save"}
              variant="primary"
              onPress={handleSave}
              disabled={!isDirty || isSubmitting}
              loading={isSubmitting}
              loadingLabel={savingText}
              style={s.saveBtn}
            />
          </View>
        </Animated.View>
      </Animated.View>
      <CalendarModal
        isVisible={isDobCalOpen}
        selectedDate={dateOfBirth}
        allowEmpty
        maxDate={latestAllowedBirthDate}
        defaultYear={2000}
        defaultMonth={1}
        onSelect={(date) => {
          personalForm.setValue("dateOfBirth", date, { shouldDirty: true });
          setIsDobCalOpen(false);
        }}
        onClose={() => setIsDobCalOpen(false)}
      />
    </Modal>
  );
}
