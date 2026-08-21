import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import FitTable, {
  FitTableTextCell,
  type FitTableColumn,
} from "./FitTable";

type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

const rows: MemberRow[] = [
  {
    id: "member-1",
    name: "Ava Rivera",
    email: "ava.rivera@fittrack.com",
    role: "Member",
    status: "Active",
  },
  {
    id: "coach-1",
    name: "Juan Carlos Cruz",
    email: "juan.cruz@fittrack.com",
    role: "Coach",
    status: "Active",
  },
  {
    id: "member-2",
    name: "Rina Torres",
    email: "rina.torres@fittrack.com",
    role: "Member",
    status: "Review",
  },
];

const columns: FitTableColumn<MemberRow>[] = [
  {
    key: "member",
    heading: "MEMBER",
    render: (row) => <FitTableTextCell primary={row.name} secondary={row.email} />,
  },
  {
    key: "role",
    heading: "ROLE",
    render: (row) => row.role,
  },
  {
    key: "status",
    heading: "STATUS",
    render: (row) => row.status,
  },
];

const meta = {
  title: "FitTrack/Primitives/FitTable",
  component: FitTable<MemberRow>,
  tags: ["autodocs"],
  args: {
    columns,
    rows,
    getRowKey: (row: MemberRow) => row.id,
    compact: true,
    overflowX: false,
    emptyStateHeight: 360,
  },
} satisfies Meta<typeof FitTable<MemberRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
  args: {
    rows: [],
    emptyMessage: "No members match the current filters.",
  },
};

export const Loading: Story = {
  args: {
    rows: [],
    isLoading: true,
    loadingMessage: "Loading members...",
  },
};
