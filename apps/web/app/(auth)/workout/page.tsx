"use client";

import { useState } from "react";
import { Dumbbell } from "lucide-react";

import FitButton from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit";
import { AccessGate } from "@/components/member-only/MemberOnlyPageControls";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberHero,
  MemberOnlyScreen,
  MemberPanelHeader,
  MemberSection,
  MemberSurface,
  MemberText,
  StatTile,
} from "@/components/member-only/MemberOnlyPrimitives";
import { formatSessionDate, formatSessionDuration, getStatusTone } from "@/components/member-only/MemberOnlyPageShared";
import { formatStatusLabel } from "@/components/member-only/memberOnlyUtils";
import { useMemberOnlyAccess, useMemberOnlyWorkoutData } from "@/hooks/member-only/useMemberOnlyData";

export default function WorkoutPage() {
  const access = useMemberOnlyAccess("Workout");
  const { user, hasMemberCardAccess, isFrozen } = access;
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const data = useMemberOnlyWorkoutData({ hasMemberCardAccess, userId: user?.id });
  const plans = data.plansQuery.data?.data ?? [];
  const sessions = data.sessionsQuery.data?.data ?? [];
  const activeSession = sessions.find((session) => session.status === "in_progress") ?? null;
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans.find((plan) => plan.isActive) ?? plans[0] ?? null;

  if (!hasMemberCardAccess) return <AccessGate featureName="Workout" icon={Dumbbell} />;

  const handleStartSession = async () => {
    if (!user?.id || isFrozen) return;
    await data.startMutation.mutateAsync({ input: selectedPlan?.id ? { planId: selectedPlan.id } : {}, userId: user.id });
  };

  const handleCompleteSession = async () => {
    if (!user?.id || !activeSession) return;
    await data.completeMutation.mutateAsync({ sessionId: activeSession.id, userId: user.id });
  };

  return (
    <MemberOnlyScreen>
      <MemberHero
        eyebrow="Workout session console"
        title={activeSession ? "Workout session is active" : "Start a workout session"}
        subtitle="Web starts and completes the same workout records used by mobile. Live pose tracking remains mobile-only."
      >
        <MemberGrid columns={3}>
          <StatTile label="Duration" value={formatSessionDuration(activeSession?.durationSeconds)} tone="success" />
          <StatTile label="Logged Sets" value={String(activeSession?.exerciseLogCount ?? 0)} />
          <StatTile label="Completed" value={String(completedSessions.length)} />
        </MemberGrid>
        {activeSession ? (
          <FitButton disabled={data.completeMutation.isPending} label={data.completeMutation.isPending ? "Finishing Workout" : "Finish Workout"} onClick={() => void handleCompleteSession()} variant="danger" />
        ) : (
          <FitButton disabled={data.startMutation.isPending || isFrozen} label={data.startMutation.isPending ? "Starting Workout" : "Start Workout Session"} onClick={() => void handleStartSession()} />
        )}
      </MemberHero>

      <MemberSection heading="Connected Plan">
        <MemberSurface padded>
          <MemberPanelHeader eyebrow="Plan" title={selectedPlan?.title ?? "Free workout"} />
          <MemberText variant="muted">
            {selectedPlan ? `${selectedPlan.daysPerWeek} days per week across ${selectedPlan.durationWeeks} weeks.` : "No active plan is attached yet."}
          </MemberText>
          {plans.length > 0 ? (
            <FitSelect fullWidth value={selectedPlan?.id ?? ""} onChange={(event) => setSelectedPlanId(event.target.value)} options={plans.map((plan) => ({ label: plan.title, value: plan.id }))} />
          ) : null}
        </MemberSurface>
      </MemberSection>

      <MemberSection heading="Recent Sessions">
        <MemberSurface>
          {data.sessionsQuery.isPending ? (
            <EmptyState icon={Dumbbell} title="Loading sessions" hint="Please wait a moment." />
          ) : sessions.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No workout sessions yet" hint="Start a workout to share progress with mobile." />
          ) : (
            sessions.map((session, index) => (
              <MemberCard
                key={session.id}
                hasBorder={index < sessions.length - 1}
                icon={Dumbbell}
                label={session.plan?.title ?? "Free workout"}
                subtitle={`${formatSessionDate(session.completedAt ?? session.startedAt)} | ${session.exerciseLogCount} sets | ${formatSessionDuration(session.durationSeconds)}`}
                trailingLabel={formatStatusLabel(session.status)}
                trailingTone={getStatusTone(session.status)}
              />
            ))
          )}
        </MemberSurface>
      </MemberSection>
    </MemberOnlyScreen>
  );
}
