import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Camera, Dumbbell, User } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { AuthUser } from "@fittrack/types";
import { calcBMI, formatDate, formatBookingDate, splitFullName } from "@fittrack/utils";
import { editProfilePersonalSchema, type EditProfilePersonalData } from "@fittrack/validators";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { mobileApi } from "@/lib/api";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { makeEditProfileModalStyles } from "@/styles/modals/EditProfileStyles";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";

type Props = {
  isVisible: boolean;
  onClose: () => void;
};

const capitalize = (value: string) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function EditProfileModal({ isVisible, onClose }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeEditProfileModalStyles(colors), [colors]);
  const { user, updateUser, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"personal" | "fitness">("personal");
  const [isDobCalOpen, setIsDobCalOpen] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailLogoutVisible, setEmailLogoutVisible] = useState(false);
  const [isEmailLogoutLoading, setIsEmailLogoutLoading] = useState(false);
  const { message: emailStatus, showMessage: showEmailStatus, clearMessage: clearEmailStatus } = useTimedMessage(1800);
  const personalForm = useForm<EditProfilePersonalData>({
    resolver: zodResolver(editProfilePersonalSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: ""
    }
  });
  const savingText = useLoadingText("Saving", isSubmitting);
  const emailLoadingTitle = useLoadingText("Updating", isEmailLogoutLoading);
  const { reset: resetPersonal } = personalForm;
  const wasVisibleRef = useRef(false);
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const userName = user?.name ?? "";
  const userEmail = user?.email ?? "";
  const userPhone = user?.phone_no ?? "";
  const userDob = user?.dateOfBirth ?? "";
  const userWeight = user?.weightKg;
  const userHeight = user?.heightCm;
  const statusValue = (user?.status ?? "active").toLowerCase();
  const statusLabel = statusValue === "frozen" ? "Frozen" : statusValue === "expired" ? "Expired" : "Active";
  const statusColor = statusValue === "frozen" ? colors.warning : statusValue === "expired" ? colors.danger : colors.success;

  useEffect(() => {
    const isOpening = isVisible && !wasVisibleRef.current;
    if (isOpening) {
      const { firstName: fn, lastName: ln } = splitFullName(userName);
      resetPersonal({
        firstName: fn,
        lastName: ln,
        email: userEmail,
        phone: userPhone,
        dateOfBirth: userDob
      });
      setWeightInput(String(userWeight ?? ""));
      setHeightInput(String(userHeight ?? ""));
      setAvatarUri(null);
      setActiveTab("personal");
      setIsDobCalOpen(false);
      setEmailLogoutVisible(false);
      setIsEmailLogoutLoading(false);
      setIsSubmitting(false);
      clearEmailStatus();
    }

    if (!isVisible) {
      setIsDobCalOpen(false);
      setEmailLogoutVisible(false);
    }

    wasVisibleRef.current = isVisible;
  }, [
    clearEmailStatus,
    isVisible,
    userDob,
    userEmail,
    userHeight,
    userName,
    userPhone,
    userWeight
  ]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  const dateOfBirth = personalForm.watch("dateOfBirth") ?? "";
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
  const displayedAvatarUri = avatarUri ?? user?.avatarUri ?? null;
  const isFitnessDirty = weightInput !== String(userWeight ?? "") || heightInput !== String(userHeight ?? "");
  const isDirty = personalForm.formState.isDirty || isFitnessDirty || !!avatarUri;

  const buildPatch = (personal: EditProfilePersonalData): Partial<AuthUser> => {
    const fullName = [personal.firstName.trim(), personal.lastName.trim()].filter(Boolean).join(" ");
    const patch: Partial<AuthUser> = {
      name: fullName || user?.name,
      email: personal.email.trim(),
      phone_no: personal.phone.trim(),
      dateOfBirth: personal.dateOfBirth || undefined
    };
    const wKgNum = parseFloat(weightInput);
    const hCmNum = parseFloat(heightInput);
    if (wKgNum > 0) patch.weightKg = wKgNum;
    if (hCmNum > 0) patch.heightCm = hCmNum;
    if (avatarUri) patch.avatarUri = avatarUri;
    return patch;
  };

  const commitSave = async (personal: EditProfilePersonalData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const emailChanged = personal.email.trim() !== (user?.email ?? "");
    const phoneChanged = personal.phone.trim() !== (user?.phone_no ?? "");
    const patch = buildPatch(personal);
    try {
      const wKgNum = parseFloat(weightInput);
      const hCmNum = parseFloat(heightInput);
      await mobileApi.patch("/users/profile", {
        firstName: personal.firstName.trim() || undefined,
        lastName: personal.lastName.trim() || undefined,
        dateOfBirth: personal.dateOfBirth || undefined,
        currentWeightKg: wKgNum > 0 ? wKgNum : undefined,
        heightCm: hCmNum > 0 ? hCmNum : undefined
      });
      if (emailChanged || phoneChanged) {
        await mobileApi.patch("/users/account", {
          ...(emailChanged ? { email: personal.email.trim() } : {}),
          ...(phoneChanged ? { phone_no: personal.phone.trim() } : {})
        });
      }
      await Promise.all([
        updateUser({
          ...patch,
          profile: {
            ...user?.profile,
            firstName: personal.firstName.trim() || null,
            lastName: personal.lastName.trim() || null,
            dateOfBirth: personal.dateOfBirth || null,
            currentWeightKg: wKgNum > 0 ? wKgNum : null,
            heightCm: hCmNum > 0 ? hCmNum : null
          }
        }),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
      if (!emailChanged) onClose();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = personalForm.handleSubmit(async (personal) => {
    if (isSubmitting) return;
    const emailChanged = personal.email.trim() !== (user?.email ?? "");
    if (emailChanged) {
      setEmailLogoutVisible(true);
      return;
    }
    await commitSave(personal);
  });

  const handleEmailLogoutConfirm = async () => {
    if (isEmailLogoutLoading) return;
    setIsEmailLogoutLoading(true);
    setIsSubmitting(true);
    try {
      const personal = personalForm.getValues();
      const patch = buildPatch(personal);
      const wKgNum = parseFloat(weightInput);
      const hCmNum = parseFloat(heightInput);
      showEmailStatus("Verifying request");
      await mobileApi.patch("/users/profile", {
        firstName: personal.firstName.trim() || undefined,
        lastName: personal.lastName.trim() || undefined,
        dateOfBirth: personal.dateOfBirth || undefined,
        currentWeightKg: wKgNum > 0 ? wKgNum : undefined,
        heightCm: hCmNum > 0 ? hCmNum : undefined
      });
      showEmailStatus("Updating email");
      await mobileApi.patch("/users/account", {
        email: personal.email.trim()
      });
      await updateUser(patch);
      await logout();
      return;
    } catch {
      setIsEmailLogoutLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsDobCalOpen(false);
    setEmailLogoutVisible(false);
    setIsEmailLogoutLoading(false);
    clearEmailStatus();
    onClose();
  };

  const roleValue = capitalize(user?.role ?? "");
  const tierValue = capitalize(user?.tier ?? "");
  const memberSinceValue = user?.memberSince ? formatDate(user.memberSince) : "\u2014";

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={undefined}
    >
      <Animated.View style={[s.backdrop, { backgroundColor: colors.overlay }]}>
        <Animated.View style={[s.card, cardStyle]}>
          <View style={s.header}>
            <View style={s.tabPill}>
              <Pressable style={[s.tabBtn, activeTab === "personal" && s.tabBtnActive]} onPress={() => setActiveTab("personal")}>
                <User size={14} color={activeTab === "personal" ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
                <FitText style={[s.tabLabel, activeTab === "personal" && s.tabLabelActive]}>Personal</FitText>
              </Pressable>
              <Pressable style={[s.tabBtn, activeTab === "fitness" && s.tabBtnActive]} onPress={() => setActiveTab("fitness")}>
                <Dumbbell size={14} color={activeTab === "fitness" ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
                <FitText style={[s.tabLabel, activeTab === "fitness" && s.tabLabelActive]}>Fitness</FitText>
              </Pressable>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
            {activeTab === "personal" ? (
              <>
                <View style={s.avatarRow}>
                  <Pressable onPress={handlePickImage}>
                    <View style={s.avatarWrap}>
                      {displayedAvatarUri ? (
                        <Image source={{ uri: displayedAvatarUri }} style={s.avatarImage} />
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
                  editable={!isSubmitting}
                />
                <FitInputField
                  control={personalForm.control}
                  name="phone"
                  label="Phone"
                  placeholder="0917xxxxxxx"
                  errors={personalForm.formState.errors}
                  keyboardType="phone-pad"
                  maxLength={11}
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
                  displayValue={
                    dateOfBirth ? formatBookingDate(dateOfBirth) : undefined
                  }
                  onPress={() => setIsDobCalOpen(true)}
                  compact
                  editable={!isSubmitting}
                />
              </>
            ) : (
              <>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Role</FitText>
                  <FitTextInput
                    value={roleValue || "\u2014"}
                    editable={false}
                    style={[s.fitInput, { color: colors.brand }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Tier</FitText>
                  <FitTextInput
                    value={tierValue || "\u2014"}
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
                      {bmiResult ? String(bmiResult.bmi) : "\u2014"}
                    </FitText>
                    {bmiResult && <FitText style={s.bmiLabel}>{bmiResult.status}</FitText>}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
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
        defaultYear={2000}
        defaultMonth={1}
        onSelect={(date) => {
          personalForm.setValue("dateOfBirth", date, { shouldDirty: true });
          setIsDobCalOpen(false);
        }}
        onClose={() => setIsDobCalOpen(false)}
      />
      <ConfirmModal
        isVisible={emailLogoutVisible}
        title="Changing Sensitive Info"
        message="You are about to change your email and you will be logged out right after the update."
        yesLabel="Continue"
        noLabel="Cancel"
        isDestructive
        isLoading={isEmailLogoutLoading}
        loadingLabel={emailStatus || "PLEASE WAIT"}
        loadingTitle={emailLoadingTitle}
        onNo={() => {
          if (isEmailLogoutLoading) return;
          clearEmailStatus();
          setEmailLogoutVisible(false);
        }}
        onYes={handleEmailLogoutConfirm}
      />
    </Modal>
  );
}
