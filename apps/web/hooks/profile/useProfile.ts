"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import {
  buildRenderableAssetUrl,
  calcBMI,
  formatDate,
  formatDateYMD,
  formatMonthYear,
  splitFullName
} from "@fittrack/utils";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { updatePhoneMutationOptions, updateProfileMutationOptions, uploadImageMutationOptions } from "@fittrack/query";
import {
  formatPhilippineMobileForInput,
  isSupportedPhilippineMobileNumber,
  normalizePhilippineMobileNumber
} from "@fittrack/validators";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { sleep } from "@/utils/sleep";
import { WEB_API_BASE_URL, webApiClient } from "@/lib/api-client";
import type { PersonalFieldKey } from "@/data/profile/profile";

export type PersonalData = Record<PersonalFieldKey, string>;

export type ProfileFieldKey = PersonalFieldKey | "weightKg" | "heightCm";
export type ProfileFieldErrors = Partial<Record<ProfileFieldKey, string>>;

const PROFILE_NAME_PATTERN = /^[\p{L}\s]+$/u;

function normalizeDateOfBirthValue(value?: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";

  return normalized.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1] ?? normalized;
}

export function getProfileFieldErrors(
  personalData: PersonalData,
  weightKg: string,
  heightCm: string
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  const first = personalData.firstName.trim();
  const last = personalData.lastName.trim();
  const phone = personalData.phone.trim();
  const dateOfBirth = personalData.dateOfBirth.trim();

  if (!first) errors.firstName = "First name is required.";
  else if (!PROFILE_NAME_PATTERN.test(first)) {
    errors.firstName = "Use letters and spaces only.";
  } else if (first.length < 2) {
    errors.firstName = "First name must be at least 2 characters.";
  }

  if (!last) errors.lastName = "Last name is required.";
  else if (!PROFILE_NAME_PATTERN.test(last)) {
    errors.lastName = "Use letters and spaces only.";
  } else if (last.length < 2) {
    errors.lastName = "Last name must be at least 2 characters.";
  }

  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (!isSupportedPhilippineMobileNumber(phone)) {
    errors.phone = "Enter a valid PH mobile number.";
  }

  if (dateOfBirth) {
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
    const parsedDate = dateParts
      ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
      : null;
    const isRealCalendarDate = Boolean(
      dateParts &&
        parsedDate &&
        parsedDate.getFullYear() === Number(dateParts[1]) &&
        parsedDate.getMonth() === Number(dateParts[2]) - 1 &&
        parsedDate.getDate() === Number(dateParts[3])
    );
    const todayYmd = formatDateYMD(new Date());
    if (!isRealCalendarDate) {
      errors.dateOfBirth = "Date of birth must be a real calendar date.";
    } else if (dateOfBirth > todayYmd) {
      errors.dateOfBirth = "Date of birth cannot be in the future.";
    }
  }

  if (weightKg.trim() !== "") {
    const weight = Number(weightKg);
    if (!Number.isFinite(weight) || weight < 0) {
      errors.weightKg = "Weight must be a numeric value.";
    }
  }

  if (heightCm.trim() !== "") {
    const height = Number(heightCm);
    if (!Number.isFinite(height) || height < 0) {
      errors.heightCm = "Height must be a numeric value.";
    }
  }

  return errors;
}

export function validateProfileFields(
  personalData: PersonalData,
  weightKg: string,
  heightCm: string
): string | null {
  return Object.values(getProfileFieldErrors(personalData, weightKg, heightCm))[0] ?? null;
}

function toSaveErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : "Unable to update profile.";
}

export function useProfilePage() {
  const { user, updateUser, logout, deleteUser } = useAuth();
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.sensitive);
  const updateProfileMutation = useMutation(updateProfileMutationOptions(webApiClient));
  const updatePhoneMutation = useMutation(updatePhoneMutationOptions(webApiClient));
  const uploadImageMutation = useMutation(uploadImageMutationOptions(webApiClient));

  const resolvedName = useMemo(() => {
    const fallbackName = splitFullName(user?.name ?? "");
    return {
      firstName: user?.profile?.firstName?.trim() || fallbackName.firstName,
      lastName: user?.profile?.lastName?.trim() || fallbackName.lastName
    };
  }, [user?.name, user?.profile?.firstName, user?.profile?.lastName]);

  const [editing, setEditingState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [showDobCalendar, setShowDobCalendar] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showSensitiveConfirm, setShowSensitiveConfirm] = useState(false);
  const [sensitiveAction, setSensitiveAction] = useState<"password" | null>(null);
  const [sensitiveLoading, setSensitiveLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [personalData, setPersonalData] = useState<PersonalData>({
    firstName: resolvedName.firstName,
    lastName: resolvedName.lastName,
    email: user?.email ?? "",
    phone: formatPhilippineMobileForInput(user?.phone_no),
    dateOfBirth: normalizeDateOfBirthValue(user?.dateOfBirth)
  });
  const [weightKg, setWeightKg] = useState(String(user?.weightKg ?? ""));
  const [heightCm, setHeightCm] = useState(String(user?.heightCm ?? ""));
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ProfileFieldKey, boolean>>>({});

  useEffect(() => {
    if (editing) return;

    setPersonalData({
      firstName: resolvedName.firstName,
      lastName: resolvedName.lastName,
      email: user?.email ?? "",
      phone: formatPhilippineMobileForInput(user?.phone_no),
      dateOfBirth: normalizeDateOfBirthValue(user?.dateOfBirth)
    });
    setWeightKg(String(user?.weightKg ?? ""));
    setHeightCm(String(user?.heightCm ?? ""));
  }, [
    editing,
    user?.dateOfBirth,
    user?.email,
    user?.heightCm,
    user?.name,
    user?.phone_no,
    user?.weightKg,
    resolvedName.firstName,
    resolvedName.lastName
  ]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [avatarFile]);

  const saveLabel = useLoadingText("SAVING CHANGES", saving);
  const terminateLabel = useLoadingText("TERMINATING ACCOUNT", terminating);

  const bmi = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) return null;
    return calcBMI(w, h);
  }, [heightCm, weightKg]);

  const hasChanges = useMemo(() => {
    const baselineName = {
      firstName: user?.profile?.firstName?.trim() || splitFullName(user?.name ?? "").firstName,
      lastName: user?.profile?.lastName?.trim() || splitFullName(user?.name ?? "").lastName
    };
    return (
      personalData.firstName !== baselineName.firstName ||
      personalData.lastName !== baselineName.lastName ||
      normalizePhilippineMobileNumber(personalData.phone) !==
        normalizePhilippineMobileNumber(user?.phone_no ?? "") ||
      personalData.dateOfBirth !== normalizeDateOfBirthValue(user?.dateOfBirth) ||
      weightKg !== String(user?.weightKg ?? "") ||
      heightCm !== String(user?.heightCm ?? "") ||
      !!avatarFile
    );
  }, [avatarFile, heightCm, personalData, user, weightKg]);

  const roleValue = user?.role
    ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
    : "Member";
  const tierValue = user?.tier ?? "Premium";
  const memberSinceValue = user?.memberSince ? formatMonthYear(user.memberSince) : "Jan 2024";
  const dobDisplay = personalData.dateOfBirth
    ? formatDate(personalData.dateOfBirth, "MMM d, yyyy")
    : "Not set";
  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "AU";
  const displayedAvatarUri = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: avatarPreviewUrl ?? user?.avatarUri ?? null
  });
  const fieldErrors = useMemo(() => {
    if (!editing) return {};

    const errors = getProfileFieldErrors(personalData, weightKg, heightCm);
    return (Object.keys(errors) as ProfileFieldKey[]).reduce<ProfileFieldErrors>(
      (visibleErrors, field) => {
        const error = errors[field];
        if (touchedFields[field] && error) visibleErrors[field] = error;
        return visibleErrors;
      },
      {}
    );
  }, [editing, heightCm, personalData, touchedFields, weightKg]);

  const setEditing = (nextEditing: boolean) => {
    setEditingState(nextEditing);
    setTouchedFields({});
  };

  const updatePersonalField = (field: PersonalFieldKey, value: string) => {
    setPersonalData((prev) => ({ ...prev, [field]: value }));
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const markPersonalFieldTouched = (field: PersonalFieldKey) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const persistProfileChanges = async () => {
    const fullName = [personalData.firstName.trim(), personalData.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    const normalizedPhone = normalizePhilippineMobileNumber(personalData.phone);
    const currentPhone = normalizePhilippineMobileNumber(user?.phone_no ?? "");
    let nextAvatarUri = user?.avatarUri;

    if (avatarFile) {
      const formData = new FormData();
      formData.append("file", avatarFile);
      const uploadResult = await uploadImageMutation.mutateAsync(formData);
      nextAvatarUri = uploadResult.url;
    }

    await updateProfileMutation.mutateAsync({
      firstName: personalData.firstName.trim() || undefined,
      lastName: personalData.lastName.trim() || undefined,
      avatarUrl: nextAvatarUri,
      dateOfBirth: personalData.dateOfBirth || undefined,
      currentWeightKg: Number.isNaN(w) ? undefined : w,
      heightCm: Number.isNaN(h) ? undefined : h
    });

    if (normalizedPhone !== currentPhone) {
      if (!normalizedPhone) {
        throw new Error("Phone number removal is not available in profile settings.");
      }

      await updatePhoneMutation.mutateAsync({
        phone_number: normalizedPhone
      });
    }

    await updateUser({
      name: fullName || user?.name,
      email: user?.email ?? "",
      phone_no: (normalizedPhone || user?.phone_no) ?? null,
      avatarUri: nextAvatarUri,
      dateOfBirth: personalData.dateOfBirth || undefined,
      weightKg: Number.isNaN(w) ? undefined : w,
      heightCm: Number.isNaN(h) ? undefined : h,
      profile: {
        ...user?.profile,
        avatarUrl: nextAvatarUri ?? null,
        firstName: personalData.firstName.trim() || null,
        lastName: personalData.lastName.trim() || null,
        dateOfBirth: personalData.dateOfBirth || null,
        currentWeightKg: Number.isNaN(w) ? null : w,
        heightCm: Number.isNaN(h) ? null : h
      }
    });

    setAvatarFile(null);
  };

  const handleSave = async () => {
    if (saving) return;
    const errors = getProfileFieldErrors(personalData, weightKg, heightCm);
    if (Object.keys(errors).length > 0) {
      setTouchedFields((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.keys(errors).map((field) => [field, true]))
      }));
      return;
    }

    setSaving(true);
    try {
      await persistProfileChanges();
      await sleep(FEEDBACK_DURATION_MS.standard);
      setEditing(false);
      showMessage("Profile updated.");
    } catch (saveError: unknown) {
      showMessage(toSaveErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleSensitiveConfirm = async () => {
    if (sensitiveAction !== "password" || sensitiveLoading) return;
    setSensitiveLoading(true);
    showMessage("Password changed. You will be logged out for security.");
    await sleep(FEEDBACK_DURATION_MS.sensitive);
    setSensitiveLoading(false);
    setShowSensitiveConfirm(false);
    setSensitiveAction(null);
    await logout();
  };

  const handleTerminate = async () => {
    setTerminating(true);
    showMessage("Terminating account...");
    await sleep(FEEDBACK_DURATION_MS.sensitive);
    setTerminating(false);
    setShowTerminateConfirm(false);
    if (deleteUser) await deleteUser();
    else await logout();
  };

  const resetPersonalData = () => {
    const resetName = {
      firstName: user?.profile?.firstName?.trim() || splitFullName(user?.name ?? "").firstName,
      lastName: user?.profile?.lastName?.trim() || splitFullName(user?.name ?? "").lastName
    };
    setPersonalData({
      firstName: resetName.firstName,
      lastName: resetName.lastName,
      email: user?.email ?? "",
      phone: formatPhilippineMobileForInput(user?.phone_no),
      dateOfBirth: normalizeDateOfBirthValue(user?.dateOfBirth)
    });
    setWeightKg(String(user?.weightKg ?? ""));
    setHeightCm(String(user?.heightCm ?? ""));
    setTouchedFields({});
    setAvatarFile(null);
    setEditing(false);
  };

  return {
    personalData,
    setPersonalData,
    updatePersonalField,
    markPersonalFieldTouched,
    weightKg,
    setWeightKg,
    heightCm,
    setHeightCm,
    editing,
    setEditing,
    saving,
    saveLabel,
    terminating,
    terminateLabel,
    showTerminateConfirm,
    setShowTerminateConfirm,
    showDobCalendar,
    setShowDobCalendar,
    showSecurityModal,
    setShowSecurityModal,
    showSensitiveConfirm,
    setShowSensitiveConfirm,
    sensitiveAction,
    setSensitiveAction,
    sensitiveLoading,
    bmi,
    hasChanges,
    roleValue,
    tierValue,
    memberSinceValue,
    dobDisplay,
    initials,
    displayedAvatarUri,
    fieldErrors,
    message,
    showMessage,
    setAvatarFile,
    handleSave,
    handleSensitiveConfirm,
    handleTerminate,
    resetPersonalData
  };
}
