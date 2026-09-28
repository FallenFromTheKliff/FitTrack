import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import FitWorkflowRail, { type FitWorkflowRailProps, type FitWorkflowRailStep } from "./FitWorkflowRail";

const exerciseLabSteps: readonly FitWorkflowRailStep[] = [
  { step: 1, label: "Exercise Setup" },
  { step: 2, label: "Training Map" },
  { step: 3, label: "Tracking Choice" },
  { step: 4, label: "Movement Builder" },
  { step: 5, label: "Hand Setup", optional: true },
  { step: 6, label: "Review & Publish" },
];

const manualExerciseLabSteps: readonly FitWorkflowRailStep[] = [
  { step: 1, label: "Exercise Setup" },
  { step: 2, label: "Training Map" },
  { step: 3, label: "Tracking Choice" },
  { step: 4, label: "Review & Publish" },
];

const meta = {
  title: "FitTrack/Primitives/FitWorkflowRail",
  component: FitWorkflowRail,
  tags: ["autodocs"],
  args: {
    steps: exerciseLabSteps,
    activeStep: 3,
    eyebrow: "New exercise",
    title: "Untitled",
    onStepChange: () => undefined,
    onExit: () => undefined,
  },
} satisfies Meta<typeof FitWorkflowRail>;

export default meta;
type Story = StoryObj<typeof meta>;

function WorkflowRailStory(args: FitWorkflowRailProps) {
  const [activeStep, setActiveStep] = useState(args.activeStep);

  return (
    <div
      style={{
        background: "var(--fit-base, #111111)",
        border: "1px solid var(--fit-border, #3a3a3a)",
        borderRadius: 12,
        display: "grid",
        gap: 24,
        gridTemplateColumns: "minmax(0, 220px)",
        padding: 24,
      }}
    >
      <FitWorkflowRail
        {...args}
        activeStep={activeStep}
        onStepChange={setActiveStep}
        style={{ width: 220, ...args.style }}
      />
    </div>
  );
}

export const Active: Story = {
  render: WorkflowRailStory,
};

export const ReviewReady: Story = {
  args: {
    activeStep: 6,
    title: "Barbell bench press",
  },
  render: WorkflowRailStory,
};

export const ManualTracking: Story = {
  args: {
    activeStep: 4,
    steps: manualExerciseLabSteps,
    title: "Cable row",
  },
  render: WorkflowRailStory,
};

export const Narrow: Story = {
  args: {
    activeStep: 4,
    responsiveMode: "narrow",
    title: "Goblet squat",
  },
  render: (args) => (
    <div style={{ maxWidth: 460, minWidth: 0 }}>
      <WorkflowRailStory {...args} />
    </div>
  ),
};
