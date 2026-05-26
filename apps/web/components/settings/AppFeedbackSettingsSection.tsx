"use client";

import { useState } from "react";
import { MessageSquareMore } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { submitAppFeedbackMutationOptions } from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitText, FitTextArea } from "@/components/fit/FitText";

type FeedbackState =
  | {
      text: string;
      tone: "danger" | "success";
    }
  | null;

const MAX_FEEDBACK_LENGTH = 1500;
const FEEDBACK_CATEGORIES = [
  { label: "Bug Report", value: "bug_report" },
  { label: "Feature Request", value: "feature_request" },
  { label: "General Feedback", value: "general_feedback" },
] as const;

export default function AppFeedbackSettingsSection() {
  const { colors } = useTheme();
  const [category, setCategory] =
    useState<(typeof FEEDBACK_CATEGORIES)[number]["value"]>("general_feedback");
  const [message, setMessage] = useState("");
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(null);
  const feedbackMutation = useMutation(submitAppFeedbackMutationOptions(webApiClient));

  const handleClear = () => {
    setMessage("");
    setFeedbackState(null);
  };

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFeedbackState({
        text: "Add a short note before sending feedback.",
        tone: "danger",
      });
      return;
    }

    try {
      await feedbackMutation.mutateAsync({ category, message: trimmedMessage });
      setMessage("");
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
  };

  return (
    <FitSection
      heading="Support Feedback"
      headingStyle={{ fontSize: 13 }}
      action={<MessageSquareMore size={13} color={colors.brand} />}
    >
      <div style={{ display: "grid", gap: 14, padding: 16 }}>
        <FitText as="p" style={{ color: colors.textMuted, fontSize: 13 }}>
          Share bugs, friction points, or ideas from the web experience. The note is stored with your account so the team can review it later.
        </FitText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FEEDBACK_CATEGORIES.map((option) => (
            <FitButton
              key={option.value}
              variant={category === option.value ? "primary" : "ghost"}
              label={option.label}
              disabled={feedbackMutation.isPending}
              onClick={() => setCategory(option.value)}
              style={{ minHeight: 36 }}
              textStyle={{ fontSize: 11, fontWeight: 800 }}
            />
          ))}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <FitText
            as="label"
            htmlFor="settings-feedback-message"
            style={{ color: colors.textMuted, fontSize: 12, fontWeight: 700 }}
          >
            Your Feedback
          </FitText>
          <FitTextArea
            id="settings-feedback-message"
            aria-label="Your Feedback"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (feedbackState) {
                setFeedbackState(null);
              }
            }}
            placeholder="Tell us what helped or what got in the way today."
            rows={5}
            maxLength={MAX_FEEDBACK_LENGTH}
            disabled={feedbackMutation.isPending}
          />
          <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
            {message.length}/{MAX_FEEDBACK_LENGTH}
          </FitText>
        </div>
        {feedbackState ? (
          <FitText
            style={{
              color: feedbackState.tone === "success" ? colors.success : colors.danger,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {feedbackState.text}
          </FitText>
        ) : null}
        <div style={{ display: "flex", gap: 10 }}>
          <FitButton
            variant="ghost"
            label="Clear"
            flex={1}
            disabled={feedbackMutation.isPending || (!message && !feedbackState)}
            onClick={handleClear}
          />
          <FitButton
            variant="primary"
            label="Send Feedback"
            loading={feedbackMutation.isPending}
            loadingLabel="Sending Feedback"
            flex={1}
            onClick={() => void handleSubmit()}
          />
        </div>
      </div>
    </FitSection>
  );
}
