import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  ExerciseMovementFamilySummaryRecord,
  ExerciseMovementProfileRecord,
} from "@fittrack/api-client";
import {
  buildFallbackPoseMovementContract,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
} from "@fittrack/utils";

import { ExerciseLabPageProvider, useExerciseLabPage } from "./ExerciseLabPageContext";
import { ExerciseLabAuthoringModal } from "./ExerciseLabAuthoringModal";
import { ExerciseLabWorkbench } from "./ExerciseLabWorkbench";
import { createExerciseDraft } from "./exercise-lab-data";
import type { ExerciseWorkbenchStepId } from "./exerciseLabShared";

type WorkbenchStoryProps = {
  name?: string;
  stepId: ExerciseWorkbenchStepId;
  trackingMode: "manual" | "inherit" | "override";
  movementFamily?: ExerciseMovementFamilySummaryRecord | null;
  movementProfile?: ExerciseMovementProfileRecord | null;
  renderModal?: boolean;
};

const storyMovementFamily: ExerciseMovementFamilySummaryRecord = {
  canonicalExerciseId: "story-canonical-bench-press",
  contractRevision: 4,
  displayName: "Bench Press family",
  id: "story-bench-press-family",
  inheritingExerciseIds: ["story-inherited-bench-press"],
  key: "bench_press",
};

const storyMovementContract = buildFallbackPoseMovementContract(
  "Dumbbell Biceps Curl",
);
const storyMovementProfile = storyMovementContract
  ? createExerciseMovementProfile({
      movementContract: storyMovementContract,
      rig: createGeneratedExerciseRigFromMovementContract({
        exerciseLabel: "Dumbbell Biceps Curl",
        movementContract: storyMovementContract,
      }),
    })
  : null;

const meta = {
  title: "FitTrack/Exercise Lab/ExerciseLabWorkbench",
  component: ExerciseLabWorkbench,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/exercise-lab",
        query: {},
      },
    },
    docs: {
      description: {
        component:
          "Production-backed Exercise Lab workbench states with deterministic local draft data. API queries may remain idle or error; the editor uses its canonical fallbacks.",
      },
    },
  },
} satisfies Meta<typeof ExerciseLabWorkbench>;

export default meta;
type Story = StoryObj<typeof meta>;

function WorkbenchHarness({
  movementFamily,
  movementProfile,
  name,
  renderModal = false,
  stepId,
  trackingMode,
}: WorkbenchStoryProps) {
  const initialized = useRef(false);
  const {
    exerciseWorkbenchSteps,
    goToExerciseWorkbenchStep,
    handleOpenCreate,
    setDraft,
  } = useExerciseLabPage();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    handleOpenCreate();
    setDraft(
      createExerciseDraft({
        aliases: [{ kind: "synonym", label: "bench press" }],
        category: "strength",
        description: "A deterministic production-backed Storybook fixture.",
        instructions: "Press the bar from the chest to full extension.",
        muscleGroup: "chest",
        movementFamily,
        movementProfile,
        name: name ?? "Storybook Barbell Bench Press",
        trackingMode,
      }),
    );
  }, [handleOpenCreate, movementFamily, movementProfile, name, setDraft, trackingMode]);

  useEffect(() => {
    const step = exerciseWorkbenchSteps.find((entry) => entry.id === stepId)?.step;
    if (step) goToExerciseWorkbenchStep(step);
  }, [exerciseWorkbenchSteps, goToExerciseWorkbenchStep, stepId]);

  return renderModal ? <ExerciseLabAuthoringModal /> : <ExerciseLabWorkbench />;
}

function ExerciseLabWorkbenchStory(props: WorkbenchStoryProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
            staleTime: Number.POSITIVE_INFINITY,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ExerciseLabPageProvider>
        <div style={{ margin: "0 auto", maxWidth: 1154, minWidth: 0, width: "100%" }}>
          <WorkbenchHarness {...props} />
        </div>
      </ExerciseLabPageProvider>
    </QueryClientProvider>
  );
}

export const Setup: Story = {
  render: () => (
    <ExerciseLabWorkbenchStory renderModal stepId="setup" trackingMode="manual" />
  ),
};

export const ExpAllocation: Story = {
  name: "EXP Allocation",
  render: () => (
    <ExerciseLabWorkbenchStory renderModal stepId="training" trackingMode="override" />
  ),
};

export const TrackingChoice: Story = {
  render: () => (
    <ExerciseLabWorkbenchStory renderModal stepId="tracking" trackingMode="override" />
  ),
};

export const TrackingChoiceManual: Story = {
  name: "Tracking Choice — manual",
  render: () => (
    <ExerciseLabWorkbenchStory renderModal stepId="tracking" trackingMode="manual" />
  ),
};

export const MovementBuilder: Story = {
  render: () => (
    <ExerciseLabWorkbenchStory
      movementProfile={storyMovementProfile}
      renderModal
      stepId="movement"
      trackingMode="override"
    />
  ),
};

export const MovementBuilderInheritedInspectOnly: Story = {
  name: "Movement Builder — inherited inspect only",
  render: () => (
    <ExerciseLabWorkbenchStory
      movementFamily={storyMovementFamily}
      renderModal
      stepId="movement"
      trackingMode="inherit"
    />
  ),
};

export const MovementBuilderEmptyDraft: Story = {
  name: "Movement Builder — empty draft",
  render: () => (
    <ExerciseLabWorkbenchStory
      movementFamily={null}
      movementProfile={null}
      name=""
      renderModal
      stepId="movement"
      trackingMode="inherit"
    />
  ),
};

export const TrackingChoiceInherited: Story = {
  name: "Tracking Choice — inherited",
  render: () => (
    <ExerciseLabWorkbenchStory
      movementFamily={storyMovementFamily}
      renderModal
      stepId="tracking"
      trackingMode="inherit"
    />
  ),
};

export const HandSetup: Story = {
  render: () => (
    <ExerciseLabWorkbenchStory renderModal stepId="hand" trackingMode="override" />
  ),
};

export const ReviewManual: Story = {
  render: () => (
    <ExerciseLabWorkbenchStory renderModal stepId="review" trackingMode="manual" />
  ),
};

export const ReviewCamera: Story = {
  name: "Review Camera",
  render: () => (
    <ExerciseLabWorkbenchStory
      movementProfile={storyMovementProfile}
      renderModal
      stepId="review"
      trackingMode="override"
    />
  ),
};
