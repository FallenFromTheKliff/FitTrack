"use client";
import { useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { calcBMI, formatDate, formatMonthYear, splitFullName } from "@fittrack/utils";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { sleep } from "@/utils/sleep";
import { api } from "@/lib/axios";
import type { PersonalFieldKey } from "@/data/profile/profile";

export type PersonalData = Record<PersonalFieldKey, string>;

export function validateProfileFields(
  personalData: PersonalData,
  weightKg: string,
  heightCm: string
): string | null {
  const first = personalData.firstName.trim();
  const last = personalData.lastName.trim();
  const email = personalData.email.trim();
  const phone = personalData.phone.trim();
  if (!first || !last) return "First and last name are required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
  if (!/^09\d{9}$/.test(phone)) return "Please enter a valid 11-digit PH phone number.";
  if (
    (weightKg.trim() !== "" && (Number.isNaN(Number(weightKg)) || Number(weightKg) < 0)) ||
    (heightCm.trim() !== "" && (Number.isNaN(Number(heightCm)) || Number(heightCm) < 0))
  ) return "Weight and height must be numeric values.";
  return null;
}

export function useProfilePage() {
  const { user, updateUser, logout, deleteUser } = useAuth();
  const { message, showMessage } = useTimedMessage(FEEDBACK_DURATION_MS.sensitive);

  const initialName = splitFullName(user?.name ?? "");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [showDobCalendar, setShowDobCalendar] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showSensitiveConfirm, setShowSensitiveConfirm] = useState(false);
  const [sensitiveAction, setSensitiveAction] = useState<"email" | "password" | null>(null);
  const [sensitiveLoading, setSensitiveLoading] = useState(false);

  const [personalData, setPersonalData] = useState<PersonalData>({
    firstName: initialName.firstName,
    lastName: initialName.lastName,
    email: user?.email ?? "",
    phone: user?.phone_no ?? "",
    dateOfBirth: user?.dateOfBirth ?? ""
  });
  const [weightKg, setWeightKg] = useState(String(user?.weightKg ?? ""));
  const [heightCm, setHeightCm] = useState(String(user?.heightCm ?? ""));

  const saveLabel = useLoadingText("SAVING CHANGES", saving);
  const terminateLabel = useLoadingText("TERMINATING ACCOUNT", terminating);

  const bmi = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) return null;
    return calcBMI(w, h);
  }, [heightCm, weightKg]);

  const hasChanges = useMemo(() => {
    const baselineName = splitFullName(user?.name ?? "");
    return (
      personalData.firstName !== baselineName.firstName ||
      personalData.lastName !== baselineName.lastName ||
      personalData.email !== (user?.email ?? "") ||
      personalData.phone !== (user?.phone_no ?? "") ||
      personalData.dateOfBirth !== (user?.dateOfBirth ?? "") ||
      weightKg !== String(user?.weightKg ?? "") ||
      heightCm !== String(user?.heightCm ?? "")
    );
  }, [heightCm, personalData, user, weightKg]);

  const roleValue = user?.role
    ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
    : "Member";
  const tierValue = user?.tier ?? "Premium";
  const memberSinceValue = user?.memberSince ? formatMonthYear(user.memberSince) : "Jan 2024";
  const dobDisplay = personalData.dateOfBirth
    ? formatDate(personalData.dateOfBirth, "MMM d, yyyy")
    : "Not set";
  const initials = user?.avatarInitials ?? user?.name?.slice(0, 2).toUpperCase() ?? "AU";
  const isAdmin = user?.role === "ADMIN";

  const persistProfileChanges = async () => {
    const fullName = [personalData.firstName.trim(), personalData.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);

    await api.patch("/users/profile", {
      firstName: personalData.firstName.trim() || undefined,
      lastName: personalData.lastName.trim() || undefined,
      dateOfBirth: personalData.dateOfBirth || undefined,
      currentWeightKg: Number.isNaN(w) ? undefined : w,
      heightCm: Number.isNaN(h) ? undefined : h
    });

    const emailChanged = personalData.email.trim() !== (user?.email ?? "");
    const phoneChanged = personalData.phone.trim() !== (user?.phone_no ?? "");
    if (emailChanged || phoneChanged) {
      await api.patch("/users/account", {
        ...(emailChanged ? { email: personalData.email.trim() } : {}),
        ...(phoneChanged ? { phone_no: personalData.phone.trim() } : {})
      });
    }

    await updateUser({
      name: fullName || user?.name,
      email: personalData.email.trim(),
      phone_no: personalData.phone.trim(),
      dateOfBirth: personalData.dateOfBirth || undefined,
      weightKg: Number.isNaN(w) ? undefined : w,
      heightCm: Number.isNaN(h) ? undefined : h,
      profile: {
        ...user?.profile,
        firstName: personalData.firstName.trim() || null,
        lastName: personalData.lastName.trim() || null,
        dateOfBirth: personalData.dateOfBirth || null,
        currentWeightKg: Number.isNaN(w) ? null : w,
        heightCm: Number.isNaN(h) ? null : h
      }
    });
  };

  const handleSave = async () => {
    if (saving) return;
    const error = validateProfileFields(personalData, weightKg, heightCm);
    if (error) { showMessage(error); return; }

    const emailChanged = personalData.email.trim() !== (user?.email ?? "");
    if (emailChanged) {
      setSensitiveAction("email");
      setShowSensitiveConfirm(true);
      return;
    }

    setSaving(true);
    await persistProfileChanges();
    await sleep(FEEDBACK_DURATION_MS.standard);
    setSaving(false);
    setEditing(false);
    showMessage("Profile updated.");
  };

  const handleSensitiveConfirm = async () => {
    if (!sensitiveAction || sensitiveLoading) return;
    setSensitiveLoading(true);
    if (sensitiveAction === "email") {
      await persistProfileChanges();
      setEditing(false);
      showMessage("Email changed. You will be logged out for security.");
    } else {
      showMessage("Password changed. You will be logged out for security.");
    }
    await sleep(FEEDBACK_DURATION_MS.sensitive);
    setSensitiveLoading(false);
    setShowSensitiveConfirm(false);
    setSensitiveAction(null);
    logout();
  };

  const handleTerminate = async () => {
    setTerminating(true);
    showMessage("Terminating account...");
    await sleep(FEEDBACK_DURATION_MS.sensitive);
    setTerminating(false);
    setShowTerminateConfirm(false);
    if (deleteUser) await deleteUser();
    else logout();
  };

  const resetPersonalData = () => {
    const resetName = splitFullName(user?.name ?? "");
    setPersonalData({
      firstName: resetName.firstName,
      lastName: resetName.lastName,
      email: user?.email ?? "",
      phone: user?.phone_no ?? "",
      dateOfBirth: user?.dateOfBirth ?? ""
    });
    setWeightKg(String(user?.weightKg ?? ""));
    setHeightCm(String(user?.heightCm ?? ""));
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
    isAdmin,
    message,
    showMessage,
    handleSave,
    handleSensitiveConfirm,
    handleTerminate,
    resetPersonalData
  };
}