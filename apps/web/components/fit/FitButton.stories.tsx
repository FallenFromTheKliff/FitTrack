import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import FitButton from "./FitButton";

const meta = {
  title: "FitTrack/Primitives/FitButton",
  component: FitButton,
  tags: ["autodocs"],
  args: {
    label: "Save changes",
  },
} satisfies Meta<typeof FitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "ghost",
    label: "Refresh",
    icon: RefreshCw,
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    label: "Delete",
    icon: Trash2,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    loadingLabel: "Saving",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <FitButton label="Primary" icon={Plus} />
      <FitButton label="Secondary" variant="ghost" />
      <FitButton label="Danger" variant="danger" icon={Trash2} />
      <FitButton label="Loading" loading />
      <FitButton label="Disabled" disabled />
    </div>
  ),
};
