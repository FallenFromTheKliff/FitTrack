import { useState, useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Lock, CheckCircle, XCircle } from "lucide-react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { FITTRACK_PRIVACY_SECTIONS } from "@fittrack/app-config";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";
import { changePasswordSchema, type ChangePasswordData } from "@fittrack/validators";
import { revisePassword } from "@fittrack/utils";
import { PASSWORD_REQUIREMENTS } from "@/data/settings";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import { LegalDocumentSections } from "@/components/legal/LegalDocumentSections";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import NoticeModal from "@/components/modals/shared/NoticeModal";

const PASS_REQ_HEIGHT = 148;

export function PasswordPanel({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const { logout, verifyCurrentPassword, changePassword } = useAuth();
  const { surfaceStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);
  const [invalidCurrentPasswordNoticeVisible, setInvalidCurrentPasswordNoticeVisible] = useState(false);
  const [samePasswordNoticeVisible, setSamePasswordNoticeVisible] = useState(false);
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);
  const [pendingChange, setPendingChange] = useState<ChangePasswordData | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const { message: statusText, showMessage: showStatus } =
    useTimedMessage(2500);
  const sensitiveLoadingTitle = useLoadingText("Updating", isLogoutLoading);
  const buttonLabel = statusText || "Save Changes";

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });
  const newPasswordValue = watch("newPassword");
  const showReqs = newPasswordValue.length > 0 && (isPasswordFocused || !isPasswordValid);
  const { height: reqHeight, opacity: reqOpacity } = usePanelAnim({ targetHeight: PASS_REQ_HEIGHT, visible: showReqs });
  const reqPanelStyle = useAnimatedStyle(() => ({
    overflow: "hidden",
    height: reqHeight.value,
    opacity: reqOpacity.value
  }));

  const r = revisePassword(newPasswordValue);
  const REQ_ITEMS = PASSWORD_REQUIREMENTS.map((item) => ({ met: r[item.key], label: item.label }));
  const allMet = REQ_ITEMS.every((i) => i.met);
  useEffect(() => {
    setIsPasswordValid(allMet);
  }, [allMet]);

  const onSubmit = async (data: ChangePasswordData) => {
    if (data.currentPassword === data.newPassword) {
      setSamePasswordNoticeVisible(true);
      return;
    }
    setPendingChange(data);
    setIsLogoutConfirmVisible(true);
  };

  const handleLogoutConfirm = async () => {
    if (isLogoutLoading || !pendingChange) return;
    setIsLogoutLoading(true);
    try {
      showStatus("Verifying request");
      const verified = await verifyCurrentPassword(pendingChange.currentPassword);
      if (!verified) {
        setPendingChange(null);
        setIsLogoutConfirmVisible(false);
        setInvalidCurrentPasswordNoticeVisible(true);
        setIsLogoutLoading(false);
        return;
      }
      showStatus("Updating password");
      const result = await changePassword(pendingChange.currentPassword, pendingChange.newPassword);
      if (!result.success) {
        showStatus(result.error);
        setIsLogoutLoading(false);
        return;
      }
      setPendingChange(null);
      reset();
      await logout();
    } catch {
      setIsLogoutLoading(false);
    }
  };

  return (
    <>
      <Animated.View style={[s.body, surfaceStyle]}>
        <View style={{ gap: 4 }}>
          <FitInputField
            control={control}
            name="currentPassword"
            label="Current Password"
            placeholder="••••••••"
            errors={errors}
            icon={Lock}
            secureTextEntry
            editable={!isLogoutLoading}
          />
          <FitInputField
            control={control}
            name="newPassword"
            label="New Password"
            placeholder="••••••••"
            errors={errors}
            icon={Lock}
            secureTextEntry
            editable={!isLogoutLoading}
            onFocusChange={setIsPasswordFocused}
          />
          <Animated.View style={reqPanelStyle}>
            <View style={[s.infoCard, { gap: 6 }]}>
              {REQ_ITEMS.map(({ met, label }) => (
                <View key={label} style={s.reqRow}>
                  {met ? (
                    <CheckCircle size={14} color={colors.brand} strokeWidth={2} />
                  ) : (
                    <XCircle size={14} color={colors.danger} strokeWidth={2} />
                  )}
                  <FitText style={[s.reqText, met && s.reqTextMet]}>
                    {label}
                  </FitText>
                </View>
              ))}
            </View>
          </Animated.View>
          <FitInputField
            control={control}
            name="confirmPassword"
            label="Confirm New Password"
            placeholder="••••••••"
            errors={errors}
            icon={Lock}
            secureTextEntry
            editable={!isLogoutLoading}
          />
        </View>
        <View style={s.footer}>
          <FitButton label="Cancel" variant="ghost" onPress={onClose} flex={1} />
          <FitButton
            label={buttonLabel}
            variant="primary"
            onPress={handleSubmit(onSubmit)}
            disabled={isLogoutLoading}
            flex={1}
          />
        </View>
      </Animated.View>
      <ConfirmModal
        isVisible={isLogoutConfirmVisible}
        title="Changing Sensitive Info"
        message="You are about to change your password and you will be logged out right after the update."
        yesLabel="Continue"
        noLabel="Cancel"
        isDestructive
        isLoading={isLogoutLoading}
        loadingLabel={statusText || "PLEASE WAIT"}
        loadingTitle={sensitiveLoadingTitle}
        onYes={handleLogoutConfirm}
        onNo={() => {
          if (isLogoutLoading) return;
          setPendingChange(null);
          setIsLogoutConfirmVisible(false);
        }}
      />
      <NoticeModal
        isVisible={samePasswordNoticeVisible}
        title="Password Unchanged"
        message="Choose a new password that is different from your current password."
        buttonLabel="Got It"
        onClose={() => setSamePasswordNoticeVisible(false)}
      />
      <NoticeModal
        isVisible={invalidCurrentPasswordNoticeVisible}
        title="Current Password Incorrect"
        message="Enter your current password again before changing sensitive account information."
        buttonLabel="Got It"
        onClose={() => setInvalidCurrentPasswordNoticeVisible(false)}
      />
    </>
  );
}

export function PrivacyPanel({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const { surfaceStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <LegalDocumentSections
        eyebrow="Philippine Data Privacy Notice"
        sections={FITTRACK_PRIVACY_SECTIONS}
      />
      <View style={s.footer}>
        <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}
