"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { buildRenderableAssetUrl, calcBMI, formatDate, formatMonthYear, splitFullName } from "@fittrack/utils";
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

export function validateProfileFields(
  personalData: PersonalData,
  weightKg: string,
  heightCm: string
): string | null {
  const first = personalData.firstName.trim();
  const last = personalData.lastName.trim();
  const phone = personalData.phone.trim();
  if (!first || !last) return "First and last name are required.";
  if (phone && !isSupportedPhilippineMobileNumber(phone)) return "Please enter a valid PH mobile number.";
  if (
    (weightKg.trim() !== "" && (Number.isNaN(Number(weightKg)) || Number(weightKg) < 0)) ||
    (heightCm.trim() !== "" && (Number.isNaN(Number(heightCm)) || Number(heightCm) < 0))
  ) return "Weight and height must be numeric values.";
  return null;
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

  const [editing, setEditing] = useState(false);
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
    dateOfBirth: user?.dateOfBirth ?? ""
  });
  const [weightKg, setWeightKg] = useState(String(user?.weightKg ?? ""));
  const [heightCm, setHeightCm] = useState(String(user?.heightCm ?? ""));

  useEffect(() => {
    if (editing) return;

    setPersonalData({
      firstName: resolvedName.firstName,
      lastName: resolvedName.lastName,
      email: user?.email ?? "",
      phone: formatPhilippineMobileForInput(user?.phone_no),
      dateOfBirth: user?.dateOfBirth ?? ""
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
      personalData.phone !== formatPhilippineMobileForInput(user?.phone_no) ||
      personalData.dateOfBirth !== (user?.dateOfBirth ?? "") ||
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
  const isAdmin = user?.role === "ADMIN";

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
    const error = validateProfileFields(personalData, weightKg, heightCm);
    if (error) {
      showMessage(error);
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
      dateOfBirth: user?.dateOfBirth ?? ""
    });
    setWeightKg(String(user?.weightKg ?? ""));
    setHeightCm(String(user?.heightCm ?? ""));
    setAvatarFile(null);
    setEditing(false);
  };

  return {
    personalData,
    setPersonalData,
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
    isAdmin,
    message,
    showMessage,
    setAvatarFile,
    handleSave,
    handleSensitiveConfirm,
    handleTerminate,
    resetPersonalData
  };
}
