import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { submitAppFeedbackMutationOptions } from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import Animated from "react-native-reanimated";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { mobileApiClient } from "@/lib/api-client";
import {
  isAutomaticHelpEnabled,
  setAutomaticHelpEnabled as setAutomaticHelpEnabledPreference,
} from "@/lib/help-preferences";
import { HELP_FAQS, LEGAL_INFO_CARDS } from "@/data/settings";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import { FitSquareToggle } from "@/components/fit/FitSquareToggle";

type FeedbackFormValues = {
  category: "bug_report" | "feature_request" | "general_feedback";
  message: string;
};

const FEEDBACK_CATEGORY_OPTIONS = [
  { label: "Bug Report", value: "bug_report" },
  { label: "Feature Request", value: "feature_request" },
  { label: "General Feedback", value: "general_feedback" },
] as const;

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const { colors, settings } = useTheme();
  const { user } = useAuth();
  const { surfaceStyle, textMutedStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const [automaticHelpEnabled, setAutomaticHelpEnabled] = useState(true);
  const [automaticHelpStatus, setAutomaticHelpStatus] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const [feedbackState, setFeedbackState] = useState<{
    text: string;
    tone: "danger" | "success";
  } | null>(null);
  const feedbackMutation = useMutation(submitAppFeedbackMutationOptions(mobileApiClient));
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<FeedbackFormValues>({
    defaultValues: {
      category: "general_feedback",
      message: "",
    },
  });
  const feedbackCategory = watch("category");
  const feedbackMessage = watch("message");

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    isAutomaticHelpEnabled(user.id)
      .then((enabled) => {
        if (isMounted) setAutomaticHelpEnabled(enabled);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleAutomaticHelpToggle = (nextValue: boolean) => {
    setAutomaticHelpEnabled(nextValue);
    setAutomaticHelpStatus(null);

    if (!user?.id) return;

    setAutomaticHelpEnabledPreference(user.id, nextValue)
      .then(() => {
        setAutomaticHelpStatus({
          text: nextValue
            ? "All automatic Help Modals are restored."
            : "Automatic Help Modals are off for all supported screens.",
          tone: "success",
        });
      })
      .catch(() => {
        setAutomaticHelpEnabled(!nextValue);
        setAutomaticHelpStatus({
          text: "Automatic Help Modals could not be updated right now.",
          tone: "danger",
        });
      });
  };

  const handleFeedbackSubmit = handleSubmit(async ({ category, message }) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFeedbackState({
        text: "Write a short note before sending feedback.",
        tone: "danger",
      });
      return;
    }

    try {
      await feedbackMutation.mutateAsync({ category, message: trimmedMessage });
      reset({ category: "general_feedback", message: "" });
      setFeedbackState({
        text: "Feedback sent. Thanks for helping improve FitTrack.",
        tone: "success",
      });
    } catch {
      setFeedbackState({
        text: "Feedback could not be sent right now.",
        tone: "danger",
      });
    }
  });

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>AUTOMATIC HELP</AnimatedFitText>
      <View style={s.infoCard}>
        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <FitText style={s.toggleLabel}>Automatic Help Modals</FitText>
            <FitText style={s.toggleHint}>
              Show every supported Help guide automatically.
            </FitText>
          </View>
          <FitSquareToggle
            value={automaticHelpEnabled}
            onValueChange={handleAutomaticHelpToggle}
            activeColor={colors.brand}
            inactiveColor={colors.border}
            useAnimations={settings.animationLevel === "full"}
          />
        </View>
        <FitText style={s.infoCardHint}>
          Off means at least one automatic Help prompt is hidden. Turning this on restores every supported screen.
        </FitText>
        {automaticHelpStatus ? (
          <FitText
            style={{
              color:
                automaticHelpStatus.tone === "success"
                  ? colors.brand
                  : colors.danger,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {automaticHelpStatus.text}
          </FitText>
        ) : null}
      </View>
      <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>FREQUENTLY ASKED</AnimatedFitText>
      {HELP_FAQS.map((item, i) => (
        <View key={i} style={s.infoCard}>
          <FitText style={s.infoCardTitle}>{item.q}</FitText>
          <FitText style={s.infoCardHint}>{item.a}</FitText>
        </View>
      ))}
      <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>SEND FEEDBACK</AnimatedFitText>
      <View style={s.infoCard}>
        <FitText style={s.infoCardHint}>
          Share bugs, missing help, or anything that made the mobile experience harder than it should be.
        </FitText>
        <View style={s.feedbackCategoryRow}>
          {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
            <FitButton
              key={option.value}
              label={option.label}
              variant={feedbackCategory === option.value ? "primary" : "ghost"}
              onPress={() => {
                setValue("category", option.value, { shouldDirty: true });
                if (feedbackState) setFeedbackState(null);
              }}
              disabled={feedbackMutation.isPending}
              style={s.feedbackCategoryButton}
              textStyle={s.feedbackCategoryButtonText}
            />
          ))}
        </View>
        <FitInputField
          control={control}
          name="message"
          label="Your Feedback"
          placeholder="Tell us what helped or what got in the way today."
          errors={errors}
          multiline
          maxLength={1500}
          autoCapitalize="sentences"
          editable={!feedbackMutation.isPending}
          onChangeValue={() => {
            if (feedbackState) {
              setFeedbackState(null);
            }
          }}
          rules={{
            maxLength: {
              value: 1500,
              message: "Feedback must be 1500 characters or fewer.",
            },
            validate: (value) =>
              value.trim().length > 0 || "Write a short note before sending feedback.",
          }}
        />
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          {feedbackMessage.length}/1500
        </FitText>
        {feedbackState ? (
          <FitText
            style={{
              color: feedbackState.tone === "success" ? colors.brand : colors.danger,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {feedbackState.text}
          </FitText>
        ) : null}
      </View>
      <View style={s.footer}>
        <FitButton
          label="Close"
          variant="ghost"
          onPress={onClose}
          flex={1}
          textStyle={s.feedbackFooterButtonText}
        />
        <FitButton
          label="Send Feedback"
          variant="primary"
          onPress={() => void handleFeedbackSubmit()}
          disabled={feedbackMutation.isPending}
          loading={feedbackMutation.isPending}
          loadingLabel="Sending Feedback"
          flex={1}
          textStyle={s.feedbackFooterButtonText}
        />
      </View>
    </Animated.View>
  );
}

export function TermsPanel({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const { surfaceStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      {LEGAL_INFO_CARDS.map((card) => (
        <View key={card.title} style={s.infoCard}>
          <FitText style={s.infoCardTitle}>{card.title}</FitText>
          <FitText style={s.infoCardHint}>{card.body}</FitText>
        </View>
      ))}
      <View style={s.footer}>
        <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}
