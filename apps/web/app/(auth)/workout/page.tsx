"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Dumbbell, Plus } from "lucide-react";

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
import {
  TodayWorkoutSteps,
  WorkoutPresetBuilder,
} from "@/components/workout/WorkoutPresetWorkspace";

export default function WorkoutPage() {
  const access = useMemberOnlyAccess("Workout");
  const { user, hasMemberCardAccess, isFrozen } = access;
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [showPresetBuilder, setShowPresetBuilder] = useState(false);
  const [showCameraNote, setShowCameraNote] = useState(false);
  const data = useMemberOnlyWorkoutData({
    hasMemberCardAccess,
    planId: selectedPlanId,
    sessionId: activeSessionId,
    userId: user?.id,
  });
  const plans = data.plansQuery.data?.data ?? [];
  const sessions = data.sessionsQuery.data?.data ?? [];
  const activeSession = sessions.find((session) => session.status === "in_progress") ?? null;
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans.find((plan) => plan.isActive) ?? plans[0] ?? null;
  const isCoachManaged = selectedPlan?.source === "coach_assigned";
  const selectedPlanDetail = data.planDetailQuery.data ?? null;
  const activeSessionDetail = data.sessionDetailQuery.data ?? null;
  const exercises = data.exercisesQuery.data?.data ?? [];
  const todayPlanExercises = useMemo(() => {
    const today = new Date().getDay();
    return (
      selectedPlanDetail?.scheduleDays.find(
        (day) => day.weekNumber === 1 && day.dayOfWeek === today,
      )?.exercises ?? []
    );
  }, [selectedPlanDetail]);
  const completedSetCount = activeSessionDetail?.exerciseLogs.filter(
    (log) => log.planExerciseId,
  ).length ?? 0;
  const requiredSetCount = todayPlanExercises.reduce(
    (total, exercise) => total + exercise.sets,
    0,
  );
  const canCompleteToday =
    !!activeSession &&
    requiredSetCount > 0 &&
    completedSetCount >= requiredSetCount;

  useEffect(() => {
    if (!selectedPlanId && selectedPlan?.id) setSelectedPlanId(selectedPlan.id);
  }, [selectedPlan?.id, selectedPlanId]);

  useEffect(() => {
    setActiveSessionId(activeSession?.id ?? "");
  }, [activeSession?.id]);

  if (!hasMemberCardAccess) return <AccessGate featureName="Workout" icon={Dumbbell} />;

  const handleStartSession = async () => {
    if (!user?.id || isFrozen) return;
    const started = await data.startMutation.mutateAsync({ input: selectedPlan?.id ? { planId: selectedPlan.id } : {}, userId: user.id });
    setActiveSessionId(started.id);
  };

  const handleCompleteSession = async () => {
    if (!user?.id || !activeSession) return;
    await data.completeMutation.mutateAsync({ sessionId: activeSession.id, userId: user.id });
  };

  const handlePlanSelect = async (planId: string) => {
    setSelectedPlanId(planId);
    if (!user?.id || !planId) return;
    await data.activatePlanMutation.mutateAsync({ planId, userId: user.id });
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
          <FitButton
            disabled={data.completeMutation.isPending || !canCompleteToday}
            label={
              data.completeMutation.isPending
                ? "Finishing Workout"
                : canCompleteToday
                  ? "Finish Workout"
                  : `${completedSetCount}/${requiredSetCount} Sets Complete`
            }
            onClick={() => void handleCompleteSession()}
            variant="danger"
          />
        ) : (
          <FitButton disabled={data.startMutation.isPending || isFrozen} label={data.startMutation.isPending ? "Starting Workout" : "Start Workout Session"} onClick={() => void handleStartSession()} />
        )}
      </MemberHero>

      <MemberSection
        action={isCoachManaged ? undefined : (
          <FitButton
            icon={Plus}
            label={showPresetBuilder ? "Close Builder" : "New Preset"}
            onClick={() => setShowPresetBuilder((current) => !current)}
            variant="ghost"
          />
        )}
        heading="Workout Presets"
      >
        <MemberSurface padded>
          <MemberPanelHeader eyebrow="Plan" title={selectedPlan?.title ?? "Free workout"} />
          <MemberText variant="muted">
            {selectedPlan
              ? `${selectedPlan.daysPerWeek} days per week across ${selectedPlan.durationWeeks} weeks.${selectedPlan.isActive ? " This split is active." : ""}`
              : "No active plan is attached yet."}
          </MemberText>
          {plans.length > 0 ? (
            <FitSelect
              disabled={data.activatePlanMutation.isPending}
              fullWidth
              value={selectedPlan?.id ?? ""}
              onChange={(event) => void handlePlanSelect(event.target.value)}
              options={plans.map((plan) => ({
                label: `${plan.title}${plan.isActive ? " (active)" : ""}`,
                value: plan.id,
              }))}
            />
          ) : null}
          {selectedPlan?.source === "coach_assigned" ? (
            <MemberText variant="muted">
              Your coach manages this preset. You can select and complete it, but editing stays locked.
            </MemberText>
          ) : null}
        </MemberSurface>
        {showPresetBuilder && !isCoachManaged ? (
          <MemberSurface padded>
            <MemberPanelHeader
              eyebrow="Preset builder"
              title="Build a reusable weekly split"
            />
            <WorkoutPresetBuilder
              exercises={exercises}
              isCreating={data.createPlanMutation.isPending}
              isCreatingCustomExercise={data.createCustomExerciseMutation.isPending}
              onCreate={async (input) => {
                if (!user?.id) return;
                const created = await data.createPlanMutation.mutateAsync({
                  input,
                  userId: user.id,
                });
                await data.activatePlanMutation.mutateAsync({
                  planId: created.id,
                  userId: user.id,
                });
                setSelectedPlanId(created.id);
                setShowPresetBuilder(false);
              }}
              onCreateCustomExercise={async (name) => {
                if (!user?.id) throw new Error("Sign in to create an exercise.");
                const created = await data.createCustomExerciseMutation.mutateAsync({
                  input: {
                    category: "strength",
                    description: "Custom exercise created from the member workout preset builder.",
                    muscleGroup: "custom",
                    name,
                  },
                  userId: user.id,
                });
                await data.exercisesQuery.refetch();
                return created.id;
              }}
            />
          </MemberSurface>
        ) : null}
      </MemberSection>

      <MemberSection
        action={
          <FitButton
            icon={Camera}
            label={showCameraNote ? "Hide Camera Option" : "Use Camera (Optional)"}
            onClick={() => setShowCameraNote((current) => !current)}
            variant="ghost"
          />
        }
        heading="Today’s Workout"
      >
        <MemberSurface padded>
          {showCameraNote ? (
            <MemberText variant="muted">
              Pose tracking can automate rep counting on a supported device, but it never blocks this manual workout flow.
            </MemberText>
          ) : null}
          <TodayWorkoutSteps
            isLogging={data.logSetMutation.isPending}
            onLogSet={async (input) => {
              if (!user?.id || !activeSession) return;
              await data.logSetMutation.mutateAsync({
                input,
                sessionId: activeSession.id,
                userId: user.id,
              });
            }}
            plan={selectedPlanDetail}
            session={activeSessionDetail}
          />
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
