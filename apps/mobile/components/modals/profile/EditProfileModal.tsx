import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Camera, Check, Dumbbell, User, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthUser, CoachProfileRecord } from "@fittrack/types";
import type { UpdateUserProfilePayload } from "@fittrack/api-client";
import {
  buildRenderableAssetUrl,
  calcBMI,
  formatBookingDate,
  splitFullName
} from "@fittrack/utils";
import {
  coachProfileSchema,
  editProfileFitnessSchema,
  editProfilePersonalSchema,
  getLatestAllowedMemberBirthDate,
  normalizePhilippineMobileNumber,
  sanitizePhilippineMobileSubscriberInput,
  type EditProfilePersonalData
} from "@fittrack/validators";
import { coachSpecialtiesQueryOptions, updateCoachProfileMutationOptions, updatePhoneMutationOptions, updateProfileMutationOptions, uploadImageMutationOptions } from "@fittrack/query";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { MOBILE_API_BASE_URL, mobileApiClient } from "@/lib/api-client";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makeEditProfileModalStyles } from "@/styles/modals/EditProfileStyles";

import CalendarModal from "@/components/modals/shared/CalendarModal";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
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

type SaveScope = "personal" | "fitness";

type ProfileBaseline = {
  avatarUrl?: string;
  dateOfBirth: string;
  firstName: string;
  gender: string;
  heightCm?: number;
  lastName: string;
  phone: string;
  weightKg?: number;
};

const emptyProfileBaseline: ProfileBaseline = {
  avatarUrl: undefined,
  dateOfBirth: "",
  firstName: "",
  gender: "other",
  heightCm: undefined,
  lastName: "",
  phone: "",
  weightKg: undefined
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

const normalizeSpecialtyLabel = (value: string) => value.trim().replace(/\s+/g, " ");

const isSameSpecialtyLabel = (left: string, right: string) =>
  normalizeSpecialtyLabel(left).toLocaleLowerCase() ===
  normalizeSpecialtyLabel(right).toLocaleLowerCase();

const parseSpecialtyLabels = (value: string) => {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map(normalizeSpecialtyLabel)
    .filter((label) => {
      const key = label.toLocaleLowerCase();
      if (!label || key === "n/a" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

function CoachSpecialtyPicker({
  disabled,
  onChange,
  value
}: {
  disabled: boolean;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const queryParams = useMemo(
    () => ({ limit: 20, page: 1, search: search.trim() || undefined }),
    [search]
  );
  const specialtiesQuery = useQuery({
    ...coachSpecialtiesQueryOptions(mobileApiClient, queryParams),
    enabled: !disabled && isOpen,
    staleTime: 5 * 60_000
  });
  const selectedLabels = useMemo(
    () => new Set(value.map((label) => normalizeSpecialtyLabel(label).toLocaleLowerCase())),
    [value]
  );
  const catalogOptions = specialtiesQuery.data?.data ?? [];
  const normalizedSearch = normalizeSpecialtyLabel(search);
  const exactCatalogOption = catalogOptions.find((option) =>
    isSameSpecialtyLabel(option.label, normalizedSearch)
  );
  const canAddCustom = Boolean(
    normalizedSearch &&
      !exactCatalogOption &&
      !selectedLabels.has(normalizedSearch.toLocaleLowerCase()) &&
      !isSameSpecialtyLabel(normalizedSearch, "N/A")
  );

  const addSpecialty = (label: string) => {
    const normalizedLabel = normalizeSpecialtyLabel(label);
    const canonicalLabel = catalogOptions.find((option) =>
      isSameSpecialtyLabel(option.label, normalizedLabel)
    )?.label ?? normalizedLabel;
    const key = canonicalLabel.toLocaleLowerCase();
    if (!canonicalLabel || value.length >= 20 || selectedLabels.has(key) || key === "n/a") return;

    onChange([...value, canonicalLabel]);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <View style={{ gap: 8 }}>
      {value.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {value.map((label) => (
            <Pressable
              key={label}
              accessibilityLabel={`Remove ${label}`}
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onChange(value.filter((item) => !isSameSpecialtyLabel(item, label)))}
              style={{
                alignItems: "center",
                backgroundColor: colors.brand + "18",
                borderColor: colors.brand + "55",
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: "row",
                gap: 6,
                maxWidth: "100%",
                paddingHorizontal: 10,
                paddingVertical: 7
              }}
            >
              <FitText style={{ color: colors.brand, flexShrink: 1, fontSize: 12, fontWeight: "700" }}>
                {label}
              </FitText>
              {!disabled ? <X color={colors.brand} size={13} strokeWidth={2.5} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <FitTextInput
        nativeID="coach-specialties"
        accessibilityLabel="Search or add coach specialties"
        value={search}
        placeholder={value.length >= 20 ? "Specialty limit reached" : "Search or add a specialty"}
        editable={!disabled && value.length < 20}
        onFocus={() => setIsOpen(true)}
        onChangeText={(text) => {
          setSearch(text);
          setIsOpen(true);
        }}
        onSubmitEditing={() => {
          if (canAddCustom) addSpecialty(normalizedSearch);
        }}
        style={{
          backgroundColor: colors.fieldBg,
          borderColor: colors.fieldBorder,
          borderRadius: 10,
          borderWidth: 1,
          minHeight: 46,
          paddingHorizontal: 14
        }}
      />
      {isOpen && !disabled ? (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderRadius: 10,
            borderWidth: 1,
            maxHeight: 190,
            overflow: "hidden"
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {catalogOptions.map((option) => {
              const selected = selectedLabels.has(option.label.toLocaleLowerCase());
              return (
                <Pressable
                  key={option.id}
                  accessibilityLabel={`${option.label}${selected ? ", added" : ""}`}
                  accessibilityRole="button"
                  disabled={selected}
                  onPress={() => addSpecialty(option.label)}
                  style={{ paddingHorizontal: 12, paddingVertical: 10 }}
                >
                  <FitText style={{ color: selected ? colors.brand : colors.textPrimary, fontSize: 12 }}>
                    {option.label}{selected ? " (Added)" : ""}
                  </FitText>
                </Pressable>
              );
            })}
            {canAddCustom ? (
              <Pressable
                accessibilityLabel={`Add custom specialty ${normalizedSearch}`}
                accessibilityRole="button"
                onPress={() => addSpecialty(normalizedSearch)}
                style={{ paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <FitText style={{ color: colors.warning, fontSize: 12, fontWeight: "700" }}>
                  Add custom: {normalizedSearch}
                </FitText>
              </Pressable>
            ) : null}
            {catalogOptions.length === 0 && !canAddCustom ? (
              <FitText style={{ color: colors.textMuted, fontSize: 12, padding: 12 }}>
                {specialtiesQuery.isPending
                  ? "Loading specialties..."
                  : specialtiesQuery.isError
                    ? "Catalog unavailable. Enter a custom specialty."
                    : "No matching specialties."}
              </FitText>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
      <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
        Search the shared catalog or add a custom label. {value.length}/20 selected.
      </FitText>
    </View>
  );
}

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
  const [saveError, setSaveError] = useState("");
  const [pendingSave, setPendingSave] = useState<{
    personal: EditProfilePersonalData;
    scope: SaveScope;
  } | null>(null);
  const personalForm = useForm<EditProfilePersonalData>({
    resolver: zodResolver(editProfilePersonalSchema),
    mode: "onChange",
    reValidateMode: "onChange",
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
  const { reset: resetPersonal, trigger: triggerPersonalValidation } = personalForm;
  const wasVisibleRef = useRef(false);
  const saveCommitLockedRef = useRef(false);
  const profileBaselineRef = useRef<ProfileBaseline>(emptyProfileBaseline);
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
  const userDob = user?.dateOfBirth ?? user?.profile?.dateOfBirth ?? "";
  const userGender = normalizeGenderOption(user?.gender ?? user?.profile?.gender);
  const userWeight = user?.weightKg ?? user?.profile?.currentWeightKg ?? undefined;
  const userHeight = user?.heightCm ?? user?.profile?.heightCm ?? undefined;
  const userAvatarUrl = user?.avatarUri ?? user?.profile?.avatarUrl ?? undefined;
  const userProfileFirstName = user?.profile?.firstName?.trim() ?? "";
  const userProfileLastName = user?.profile?.lastName?.trim() ?? "";
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
      const firstName = userProfileFirstName || fn;
      const lastName = userProfileLastName || ln;
      profileBaselineRef.current = {
        avatarUrl: userAvatarUrl,
        dateOfBirth: userDob,
        firstName,
        gender: userGender,
        heightCm: userHeight,
        lastName,
        phone: normalizePhilippineMobileNumber(userPhone),
        weightKg: userWeight
      };
      resetPersonal({
        firstName,
        lastName,
        email: userEmail,
        phone: normalizePhilippineMobileNumber(userPhone),
        dateOfBirth: userDob,
        gender: userGender
      });
      void triggerPersonalValidation("phone");
      setWeightInput(String(userWeight ?? ""));
      setHeightInput(String(userHeight ?? ""));
      setAvatarAsset(null);
      setActiveTab("personal");
      setIsDobCalOpen(false);
      setIsSubmitting(false);
      setSaveError("");
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
    triggerPersonalValidation,
    userDob,
    userEmail,
    userGender,
    userAvatarUrl,
    userHeight,
    userName,
    userProfileFirstName,
    userProfileLastName,
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
  const firstNameInput = personalForm.watch("firstName") ?? "";
  const lastNameInput = personalForm.watch("lastName") ?? "";
  const phoneInput = personalForm.watch("phone") ?? "";
  const wKg = Number(weightInput);
  const hCm = Number(heightInput);
  const bmiResult = wKg > 0 && hCm > 0 ? calcBMI(wKg, hCm) : null;
  const fitnessValidation = useMemo(
    () => editProfileFitnessSchema.safeParse({ weightKg: weightInput, heightCm: heightInput }),
    [heightInput, weightInput]
  );
  const fitnessErrors = useMemo(() => {
    if (fitnessValidation.success) return { height: "", weight: "" };

    return {
      height:
        fitnessValidation.error.issues.find((issue) => issue.path[0] === "heightCm")?.message ?? "",
      weight:
        fitnessValidation.error.issues.find((issue) => issue.path[0] === "weightKg")?.message ?? ""
    };
  }, [fitnessValidation]);
  const coachValidation = useMemo(
    () =>
      coachProfileSchema.safeParse({
        bio: coachBio,
        specialties: coachSpecialties,
        certifications: coachCertifications
      }),
    [coachBio, coachCertifications, coachSpecialties]
  );
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
    assetUrl: avatarAsset?.uri ?? userAvatarUrl ?? null
  });
  const baseline = profileBaselineRef.current;
  const normalizedPhone = normalizePhilippineMobileNumber(phoneInput);
  const firstNameChanged = firstNameInput.trim() !== baseline.firstName;
  const lastNameChanged = lastNameInput.trim() !== baseline.lastName;
  const dateOfBirthChanged = dateOfBirth.trim() !== baseline.dateOfBirth;
  const genderChanged = selectedGender !== baseline.gender;
  const phoneChanged = normalizedPhone !== baseline.phone;
  const avatarChanged = !!avatarAsset;
  const isPersonalDirty =
    firstNameChanged ||
    lastNameChanged ||
    dateOfBirthChanged ||
    genderChanged ||
    phoneChanged ||
    avatarChanged;
  const isWeightDirty = fitnessValidation.success
    ? Number(fitnessValidation.data.weightKg) !== baseline.weightKg
    : weightInput.trim() !== String(baseline.weightKg ?? "");
  const isHeightDirty = fitnessValidation.success
    ? Number(fitnessValidation.data.heightCm) !== baseline.heightCm
    : heightInput.trim() !== String(baseline.heightCm ?? "");
  const isFitnessDirty = isWeightDirty || isHeightDirty;
  const isCoachDirty = isCoach && (
    coachBio !== coachSnapshot.current.bio ||
    coachSpecialties !== coachSnapshot.current.specialties ||
    coachCertifications !== coachSnapshot.current.certifications
  );
  const isCurrentTabDirty = activeTab === "personal"
    ? isPersonalDirty
    : isCoach
      ? isCoachDirty
      : isFitnessDirty;
  const isCurrentTabValid = activeTab === "personal"
    ? personalForm.formState.isValid
    : isCoach
      ? coachValidation.success
      : fitnessValidation.success;
  const isDirty = isCurrentTabDirty && isCurrentTabValid;

  const buildProfileUpdate = (
    personal: EditProfilePersonalData,
    scope: SaveScope,
    nextAvatarUri: string | undefined
  ): UpdateUserProfilePayload => {
    const payload: UpdateUserProfilePayload = {};
    if (scope === "personal") {
      const nextFirstName = personal.firstName.trim();
      const nextLastName = personal.lastName.trim();
      const nextDateOfBirth = personal.dateOfBirth?.trim() ?? "";

      if (nextFirstName !== baseline.firstName) payload.firstName = nextFirstName;
      if (nextLastName !== baseline.lastName) payload.lastName = nextLastName;
      if (nextDateOfBirth && nextDateOfBirth !== baseline.dateOfBirth) {
        payload.dateOfBirth = nextDateOfBirth;
      }
      if (personal.gender !== baseline.gender) payload.gender = personal.gender;
      if (avatarAsset && nextAvatarUri && nextAvatarUri !== baseline.avatarUrl) {
        payload.avatarUrl = nextAvatarUri;
      }
    }

    if (scope === "fitness" && !isCoach && fitnessValidation.success) {
      const nextWeightKg = Number(fitnessValidation.data.weightKg);
      const nextHeightCm = Number(fitnessValidation.data.heightCm);
      if (nextWeightKg !== baseline.weightKg) payload.currentWeightKg = nextWeightKg;
      if (nextHeightCm !== baseline.heightCm) payload.heightCm = nextHeightCm;
    }

    return payload;
  };

  const buildAuthPatch = (
    personal: EditProfilePersonalData,
    scope: SaveScope,
    profilePayload: UpdateUserProfilePayload,
    nextAvatarUri: string | undefined
  ): Partial<AuthUser> => {
    const patch: Partial<AuthUser> = {};
    const nextProfile = { ...(user?.profile ?? {}) };
    let profileChanged = false;

    if (scope === "personal") {
      const nextFirstName = personal.firstName.trim();
      const nextLastName = personal.lastName.trim();
      const nextDateOfBirth = personal.dateOfBirth?.trim() ?? "";

      if (firstNameChanged || lastNameChanged) {
        patch.name = [nextFirstName, nextLastName].filter(Boolean).join(" ");
        nextProfile.firstName = nextFirstName;
        nextProfile.lastName = nextLastName;
        profileChanged = true;
      }
      if (dateOfBirthChanged && nextDateOfBirth) {
        patch.dateOfBirth = nextDateOfBirth;
        nextProfile.dateOfBirth = nextDateOfBirth;
        profileChanged = true;
      }
      if (genderChanged) {
        patch.gender = personal.gender;
        nextProfile.gender = personal.gender;
        profileChanged = true;
      }
      if (avatarChanged && nextAvatarUri) {
        patch.avatarUri = nextAvatarUri;
        nextProfile.avatarUrl = nextAvatarUri;
        profileChanged = true;
      }
      if (phoneChanged) patch.phone_no = normalizedPhone;
    }

    if (scope === "fitness" && !isCoach) {
      if (profilePayload.currentWeightKg !== undefined) {
        patch.weightKg = profilePayload.currentWeightKg;
        nextProfile.currentWeightKg = profilePayload.currentWeightKg;
        profileChanged = true;
      }
      if (profilePayload.heightCm !== undefined) {
        patch.heightCm = profilePayload.heightCm;
        nextProfile.heightCm = profilePayload.heightCm;
        profileChanged = true;
      }
    }

    if (profileChanged) patch.profile = nextProfile;
    return patch;
  };

  const commitSave = async (personal: EditProfilePersonalData, scope: SaveScope) => {
    if (saveCommitLockedRef.current) return;
    saveCommitLockedRef.current = true;
    setIsSubmitting(true);
    setSaveError("");
    try {
      let nextAvatarUri = userAvatarUrl;
      if (scope === "personal" && avatarAsset) {
        const formData = new FormData();
        formData.append("file", await createAvatarUploadPart(avatarAsset) as never);
        const avatarResult = await uploadImageMutation.mutateAsync(formData);
        nextAvatarUri = avatarResult.url;
      }
      const profilePayload = buildProfileUpdate(personal, scope, nextAvatarUri);
      if (Object.keys(profilePayload).length > 0) {
        await updateProfileMutation.mutateAsync(profilePayload);
      }
      if (scope === "personal" && phoneChanged) {
        await updatePhoneMutation.mutateAsync({
          phone_number: normalizedPhone
        });
      }
      if (scope === "fitness" && isCoach) {
        const coachPayload = coachProfileSchema.parse({
          bio: coachBio,
          specialties: coachSpecialties,
          certifications: coachCertifications
        });
        await updateCoachProfileMutation.mutateAsync({
          payload: {
            bio: coachPayload.bio || undefined,
            specialties: coachPayload.specialties,
            certifications: coachPayload.certifications
          },
          userId: user?.id,
          coachId: coachProfile?.id
        });
      }
      const authPatch = buildAuthPatch(personal, scope, profilePayload, nextAvatarUri);
      if (Object.keys(authPatch).length > 0) await updateUser(authPatch);
      setAvatarAsset(null);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save profile changes.");
    } finally {
      saveCommitLockedRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSave = () => {
    if (isSubmitting || !isDirty) return;
    setSaveError("");
    if (activeTab === "personal") {
      void personalForm.handleSubmit((personal) => {
        setPendingSave({ personal, scope: "personal" });
      })();
      return;
    }

    if (!isCurrentTabValid) return;
    setPendingSave({ personal: personalForm.getValues(), scope: "fitness" });
  };

  const handleConfirmSave = () => {
    if (!pendingSave || saveCommitLockedRef.current) return;
    const nextSave = pendingSave;
    setPendingSave(null);
    void commitSave(nextSave.personal, nextSave.scope);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setPendingSave(null);
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
    <>
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
              <Pressable
                style={[s.tabBtn, activeTab === "personal" && s.tabBtnActive]}
                onPress={() => setActiveTab("personal")}
                accessibilityRole="tab"
                accessibilityLabel="Personal profile tab"
                accessibilityState={{ selected: activeTab === "personal" }}
              >
                <User size={14} color={activeTab === "personal" ? colors.textPrimary : colors.textSecondary} strokeWidth={2} />
                <FitText style={[s.tabLabel, activeTab === "personal" && s.tabLabelActive]}>Personal</FitText>
              </Pressable>
              <Pressable
                style={[s.tabBtn, activeTab === "fitness" && s.tabBtnActive]}
                onPress={() => setActiveTab("fitness")}
                accessibilityRole="tab"
                accessibilityLabel={`${isCoach ? "Coach" : "Fitness"} profile tab`}
                accessibilityState={{ selected: activeTab === "fitness" }}
              >
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
            contentContainerStyle={s.body}
            resetKey={`${isVisible}-${activeTab}`}
          >
            {activeTab === "personal" ? (
              <>
                <View style={s.avatarRow}>
                  <Pressable
                    onPress={handlePickImage}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                  >
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
                  placeholder="9XXXXXXXXX"
                  errors={personalForm.formState.errors}
                  keyboardType="phone-pad"
                  maxLength={10}
                  phonePrefix="+63"
                  sanitizeValue={sanitizePhilippineMobileSubscriberInput}
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
                          accessibilityRole="radio"
                          accessibilityLabel={option.label}
                          accessibilityState={{ disabled: isSubmitting, selected: isActive }}
                          onPress={() =>
                            personalForm.setValue("gender", option.value, {
                              shouldDirty: true,
                              shouldValidate: true
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
                  <FitTextInput
                    nativeID="coach-role"
                    accessibilityLabel="Role"
                    value={roleValue || "--"}
                    editable={false}
                    style={[s.fitInput, { color: colors.brand }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Hourly Rate</FitText>
                  <FitTextInput
                    nativeID="coach-hourly-rate"
                    accessibilityLabel="Hourly Rate"
                    value={coachHourlyRate}
                    placeholder="Set by admin"
                    editable={false}
                    style={[
                      s.fitInput,
                      { backgroundColor: colors.surfaceRaised, color: colors.textDisabled }
                    ]}
                  />
                  <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
                    Hourly rate is managed by gym admin.
                  </FitText>
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Specialties</FitText>
                  <CoachSpecialtyPicker
                    disabled={isSubmitting}
                    value={parseSpecialtyLabels(coachSpecialties)}
                    onChange={(labels) => setCoachSpecialties(labels.join(", "))}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Certifications</FitText>
                  <FitTextInput
                    nativeID="coach-certifications"
                    accessibilityLabel="Certifications"
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
                    nativeID="coach-bio"
                    accessibilityLabel="Bio"
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
                    nativeID="member-role"
                    accessibilityLabel="Role"
                    value={roleValue || "--"}
                    editable={false}
                    style={[s.fitInput, { color: colors.brand }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Tier</FitText>
                  <FitTextInput
                    nativeID="member-tier"
                    accessibilityLabel="Tier"
                    value={tierValue || "--"}
                    editable={false}
                    style={[s.fitInput, { color: colors.brand }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Member Since</FitText>
                  <FitTextInput
                    nativeID="member-since"
                    accessibilityLabel="Member Since"
                    value={memberSinceValue}
                    editable={false}
                    style={[s.fitInput, { color: colors.textSecondary }]}
                  />
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Weight (kg)</FitText>
                  <FitTextInput
                    nativeID="member-weight"
                    accessibilityLabel="Weight (kg)"
                    value={weightInput}
                    placeholder="e.g. 70"
                    keyboardType="decimal-pad"
                    maxLength={7}
                    editable={!isSubmitting}
                    onChangeText={(text) => {
                      setSaveError("");
                      setWeightInput(text);
                    }}
                    style={s.fitInput}
                  />
                  {fitnessErrors.weight ? (
                    <FitText style={{ color: colors.danger, fontSize: 12 }}>
                      {fitnessErrors.weight}
                    </FitText>
                  ) : null}
                </View>
                <View style={s.fitRow}>
                  <FitText style={s.fitLabel}>Height (cm)</FitText>
                  <FitTextInput
                    nativeID="member-height"
                    accessibilityLabel="Height (cm)"
                    value={heightInput}
                    placeholder="e.g. 170"
                    keyboardType="decimal-pad"
                    maxLength={7}
                    editable={!isSubmitting}
                    onChangeText={(text) => {
                      setSaveError("");
                      setHeightInput(text);
                    }}
                    style={s.fitInput}
                  />
                  {fitnessErrors.height ? (
                    <FitText style={{ color: colors.danger, fontSize: 12 }}>
                      {fitnessErrors.height}
                    </FitText>
                  ) : null}
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
          {saveError ? (
            <FitText style={{ color: colors.danger, fontSize: 12, lineHeight: 18, marginHorizontal: 20 }}>
              {saveError}
            </FitText>
          ) : null}
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
        maxDate={latestAllowedBirthDate}
        defaultYear={2000}
        defaultMonth={1}
        onSelect={(date) => {
          personalForm.setValue("dateOfBirth", date, {
            shouldDirty: true,
            shouldValidate: true
          });
          setIsDobCalOpen(false);
        }}
        onClose={() => setIsDobCalOpen(false)}
      />
    </Modal>
    <ConfirmModal
      isVisible={pendingSave !== null}
      title="Save profile changes?"
      message="Review complete. Confirm to update your profile with these changes."
      yesLabel="Confirm Save"
      noLabel="Keep Editing"
      yesIcon={Check}
      isLoading={isSubmitting}
      loadingLabel="Saving"
      onNo={() => setPendingSave(null)}
      onYes={handleConfirmSave}
    />
    </>
  );
}
