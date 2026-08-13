import { useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AppointmentAvailabilitySlot,
  RecurringCoachingPlanRecord,
  RecurringCoachingScheduleItemRecord,
} from "@fittrack/api-client";
import { updateRecurringCoachingSessionMutationOptions } from "@fittrack/query";

import { FitButton, FitText } from "@/components/fit";
import TimeSlotModal, { type TimeSlot } from "@/components/modals/shared/TimeSlotModal";
import { useTheme } from "@/contexts/ThemeContext";
import { mobileApiClient } from "@/lib/api-client";
import { formatBookingDate } from "@fittrack/utils";
import { fitnessPlanDetailQueryOptions } from "@fittrack/query";
import { useQuery as useFitnessQuery } from "@tanstack/react-query";

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function availabilityToTimeSlot(slot: AppointmentAvailabilitySlot, selectedTime: string) {
  const time = formatSessionTime(slot.startAt);
  return {
    duration: `${slot.durationMinutes} min`,
    status: slot.available ? (time === selectedTime ? "selected" : "available") : "full",
    time,
  } satisfies TimeSlot;
}

function sessionDateKey(item: RecurringCoachingScheduleItemRecord) {
  return item.scheduledAt.slice(0, 10);
}

function scheduleItemLabel(
  item: RecurringCoachingScheduleItemRecord,
  scheduleDays: readonly { id: string; focusLabel: string | null; dayOfWeek: number }[],
) {
  const linkedDay = item.trainingScheduleDayId
    ? scheduleDays.find((day) => day.id === item.trainingScheduleDayId)
    : undefined;
  return linkedDay?.focusLabel?.trim() || `Workout ${item.sequenceIndex + 1}`;
}

export function CoachClientPaidSchedule({
  coachUserId,
  activeMonthlyPlan,
  canManage,
  onRescheduled,
}: {
  coachUserId: string;
  activeMonthlyPlan: RecurringCoachingPlanRecord | null;
  canManage: boolean;
  onRescheduled?: () => void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const updateGateRef = useRef(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
  const [message, setMessage] = useState("");

  const planDetailQuery = useFitnessQuery({
    ...fitnessPlanDetailQueryOptions(
      mobileApiClient,
      activeMonthlyPlan?.trainingPlanId ?? undefined,
    ),
    enabled: canManage && !!activeMonthlyPlan?.trainingPlanId,
  });
  const updateSessionMutation = useMutation(
    updateRecurringCoachingSessionMutationOptions(mobileApiClient, queryClient),
  );
  const selectedItem = useMemo(
    () =>
      activeMonthlyPlan?.scheduleItems?.find((item) => item.id === selectedItemId) ??
      null,
    [activeMonthlyPlan?.scheduleItems, selectedItemId],
  );
  const scheduleDays = planDetailQuery.data?.scheduleDays ?? [];
  const purchasedSessions = useMemo(
    () =>
      (activeMonthlyPlan?.scheduleItems ?? []).filter((item) =>
        scheduleDays.length
          ? !item.trainingScheduleDayId ||
            scheduleDays.some((day) => day.id === item.trainingScheduleDayId)
          : false,
      ),
    [activeMonthlyPlan?.scheduleItems, scheduleDays],
  );
  const availabilityQuery = useQuery({
    queryKey: [
      "coach-client-paid-session-availability",
      coachUserId,
      selectedItem?.id,
      selectedItem ? sessionDateKey(selectedItem) : "",
      selectedItem?.durationMinutes,
    ],
    queryFn: () =>
      mobileApiClient.appointments.getAvailability(coachUserId, {
        date: sessionDateKey(selectedItem!),
        durationMinutes: selectedItem!.durationMinutes,
      }),
    enabled: canManage && isTimeModalVisible && !!selectedItem,
  });
  const timeSlots = useMemo(
    () =>
      (availabilityQuery.data ?? []).map((slot) =>
        availabilityToTimeSlot(slot, selectedTime),
      ),
    [availabilityQuery.data, selectedTime],
  );

  const openTimePicker = (item: RecurringCoachingScheduleItemRecord) => {
    setSelectedItemId(item.id);
    setSelectedTime(formatSessionTime(item.scheduledAt));
    setMessage("");
    setIsTimeModalVisible(true);
  };

  const reschedule = async (slot: TimeSlot) => {
    if (!selectedItem || !activeMonthlyPlan || updateGateRef.current) return;
    const canonicalSlot = (availabilityQuery.data ?? []).find(
      (candidate) => formatSessionTime(candidate.startAt) === slot.time && candidate.available,
    );
    if (!canonicalSlot) return;

    updateGateRef.current = true;
    setMessage("");
    try {
      await updateSessionMutation.mutateAsync({
        planId: activeMonthlyPlan.id,
        sessionId: selectedItem.id,
        input: { action: "reschedule", newScheduledAt: canonicalSlot.startAt },
      });
      setIsTimeModalVisible(false);
      setSelectedItemId(null);
      setMessage("Paid session rescheduled from canonical coach availability.");
      onRescheduled?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reschedule this paid session.");
    } finally {
      updateGateRef.current = false;
    }
  };

  if (!canManage || !activeMonthlyPlan) {
    return (
      <View style={{ gap: 8 }}>
        <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: "900" }}>PAID MONTHLY SCHEDULE</FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
          Scheduling controls unlock after a paid active monthly enrollment.
        </FitText>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <FitText style={{ color: colors.brand, fontSize: 13, fontWeight: "900" }}>PAID MONTHLY SCHEDULE</FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
          Dates come from the selected client program and purchased sessions. Choose each exact time from canonical coach availability.
        </FitText>
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <FitText style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "900" }}>
          {purchasedSessions.length} purchased
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
          {selectedItemId ? "1 selected" : "0 selected"}
        </FitText>
      </View>
      {planDetailQuery.isLoading ? <FitText style={{ color: colors.textMuted, fontSize: 11 }}>Loading program dates…</FitText> : null}
      {!planDetailQuery.isLoading && purchasedSessions.length === 0 ? (
        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
          No purchased sessions match the selected client program.
        </FitText>
      ) : null}
      <View style={{ gap: 7 }}>
        {purchasedSessions.map((item) => {
          const hasConflict = item.status.toLowerCase().includes("conflict");
          return (
            <View
              key={item.id}
              style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 10, borderWidth: 1, gap: 7, padding: 11 }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
                <FitText style={{ color: colors.textPrimary, flex: 1, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
                  {scheduleItemLabel(item, scheduleDays)}
                </FitText>
                <FitText style={{ color: colors.success, fontSize: 9.5, fontWeight: "900" }}>PURCHASED</FitText>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <FitText style={{ color: colors.textMuted, flexBasis: "47%", fontSize: 10.5 }}>DATE · {formatBookingDate(item.scheduledAt)}</FitText>
                <FitText style={{ color: colors.textMuted, flexBasis: "47%", fontSize: 10.5 }}>TIME · {formatSessionTime(item.scheduledAt)}</FitText>
                <FitText style={{ color: colors.textMuted, flexBasis: "47%", fontSize: 10.5 }}>DURATION · {item.durationMinutes} min</FitText>
                <FitText style={{ color: hasConflict ? colors.danger : colors.success, flexBasis: "47%", fontSize: 10.5 }}>CONFLICT · {hasConflict ? "CHECK" : "CLEAR"}</FitText>
              </View>
              <FitButton
                label="SELECT TIME"
                onPress={() => openTimePicker(item)}
                style={{ minHeight: 42 }}
                textStyle={{ fontSize: 11, fontWeight: "900" }}
                variant="ghost"
              />
            </View>
          );
        })}
      </View>
      {message ? <FitText accessibilityLiveRegion="polite" style={{ color: message.includes("rescheduled") ? colors.success : colors.danger, fontSize: 11.5 }}>{message}</FitText> : null}
      <TimeSlotModal
        emptyMessage={availabilityQuery.isLoading ? "Checking canonical availability…" : "No canonical coach times are available for this session."}
        isVisible={isTimeModalVisible}
        onClose={() => setIsTimeModalVisible(false)}
        onSelect={(slot) => void reschedule(slot)}
        selectedTime={selectedTime}
        slots={timeSlots}
        title={selectedItem ? `Choose time · ${formatBookingDate(selectedItem.scheduledAt)}` : "Choose exact time"}
      />
    </View>
  );
}
