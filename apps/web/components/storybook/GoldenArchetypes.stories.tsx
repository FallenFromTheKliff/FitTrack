import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRight, Check, FileText, Plus, Save, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";

import { useTheme } from "../../contexts/ThemeContext";
import FitButton from "../fit/FitButton";
import FitCard from "../fit/FitCard";
import FitInputField from "../fit/FitInputField";
import FitPill from "../fit/FitPill";
import FitTable, { FitTableTextCell, type FitTableColumn } from "../fit/FitTable";
import { FitText } from "../fit/FitText";

type StoryShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

function StoryShell({ eyebrow, title, description, actions, children }: StoryShellProps) {
  const { colors } = useTheme();

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: colors.base,
        color: colors.textPrimary,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1440,
          margin: "0 auto",
          display: "grid",
          gap: 24,
          padding: "14px 0 34px",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 7, maxWidth: 760 }}>
            <FitText
              as="p"
              excludeGlobalScale
              style={{
                margin: 0,
                color: colors.brand,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </FitText>
            <FitText
              as="h1"
              excludeGlobalScale
              style={{ margin: 0, fontSize: 30, lineHeight: 1.05, fontWeight: 800 }}
            >
              {title}
            </FitText>
            <FitText
              as="p"
              excludeGlobalScale
              style={{ margin: 0, color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 }}
            >
              {description}
            </FitText>
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

function Surface({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 18,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <FitText
      as="p"
      excludeGlobalScale
      style={{
        margin: 0,
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </FitText>
  );
}

type ResourceRow = {
  id: string;
  name: string;
  category: string;
  owner: string;
  availability: string;
  status: "Ready" | "Review";
};

const RESOURCE_ROWS: ResourceRow[] = [
  {
    id: "resource-1",
    name: "Strength Lab Pass",
    category: "Membership",
    owner: "Front desk",
    availability: "48 / 60",
    status: "Ready",
  },
  {
    id: "resource-2",
    name: "Coach Assessment",
    category: "Coaching",
    owner: "Lena Ortiz",
    availability: "12 slots",
    status: "Ready",
  },
  {
    id: "resource-3",
    name: "Recovery Room",
    category: "Facility",
    owner: "Operations",
    availability: "6 / 8",
    status: "Review",
  },
  {
    id: "resource-4",
    name: "Nutrition Check-in",
    category: "Wellness",
    owner: "Maya Chen",
    availability: "24 slots",
    status: "Ready",
  },
];

const RESOURCE_COLUMNS: FitTableColumn<ResourceRow>[] = [
  {
    key: "resource",
    heading: "RESOURCE",
    render: (row) => <FitTableTextCell primary={row.name} secondary={row.category} />,
  },
  {
    key: "owner",
    heading: "OWNER",
    render: (row) => row.owner,
  },
  {
    key: "availability",
    heading: "AVAILABILITY",
    align: "right",
    render: (row) => row.availability,
  },
  {
    key: "status",
    heading: "STATUS",
    render: (row, colors) => (
      <FitPill
        mode="status"
        label={row.status}
        color={row.status === "Ready" ? colors.success : colors.warning}
      />
    ),
  },
];

function ResourceListFixture() {
  const { colors } = useTheme();

  return (
    <StoryShell
      eyebrow="Golden archetype / resource list"
      title="Resource library"
      description="A dense operator list with clear ownership, availability, and one obvious next action."
      actions={
        <>
          <FitButton variant="ghost" label="Export view" icon={FileText} />
          <FitButton label="Add resource" icon={Plus} />
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <Surface
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <SectionLabel>Current view</SectionLabel>
            <FitPill
              mode="status"
              label="All resources"
              color={colors.brand}
              style={{ padding: "5px 10px" }}
            />
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
              4 synthetic records
            </FitText>
          </div>
          <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12 }}>
            Last reviewed: fixture baseline
          </FitText>
        </Surface>

        <FitTable
          columns={RESOURCE_COLUMNS}
          rows={RESOURCE_ROWS}
          getRowKey={(row) => row.id}
          compact
          overflowX={false}
          style={{ backgroundColor: colors.surface }}
        />
      </div>
    </StoryShell>
  );
}

function DetailRow({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 0.45fr) minmax(0, 1fr)",
        gap: 18,
        padding: "12px 0",
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
        {label}
      </FitText>
      <FitText
        excludeGlobalScale
        style={{ color: muted ? colors.textSecondary : colors.textPrimary, fontSize: 13, fontWeight: muted ? 400 : 650 }}
      >
        {value}
      </FitText>
    </div>
  );
}

function EntityDetailFixture() {
  const { colors } = useTheme();

  return (
    <StoryShell
      eyebrow="Golden archetype / entity detail"
      title="Member profile"
      description="A focused detail surface that keeps identity, operational facts, and the primary action in one frame."
      actions={
        <>
          <FitButton variant="ghost" label="Back to members" />
          <FitButton label="Edit profile" icon={ArrowRight} showTrailing />
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 0.7fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        <Surface style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  borderRadius: 14,
                  border: `1px solid ${colors.brand}66`,
                  backgroundColor: `${colors.brand}18`,
                  color: colors.brand,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                AR
              </div>
              <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                <FitText as="h2" excludeGlobalScale style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                  Avery Rivera
                </FitText>
                <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Member ID FT-2048 / North studio
                </FitText>
              </div>
            </div>
            <FitPill mode="status" label="Active" color={colors.success} />
          </div>

          <div>
            <SectionLabel>Profile details</SectionLabel>
            <DetailRow label="Membership" value="Strength Lab / annual" />
            <DetailRow label="Coach" value="Lena Ortiz" />
            <DetailRow label="Joined" value="March 18, 2026" />
            <DetailRow label="Contact" value="avery.rivera@example.test" muted />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              paddingTop: 2,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={16} color={colors.success} />
              <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12 }}>
                Consent and profile review complete
              </FitText>
            </div>
            <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
              Synthetic fixture / no member data
            </FitText>
          </div>
        </Surface>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <FitCard statMode icon={UserRound} statLabel="Visits this month" statValue="12" />
            <FitCard statMode icon={Check} statLabel="Plan adherence" statValue="92%" />
          </div>
          <Surface style={{ display: "grid", gap: 14 }}>
            <SectionLabel>Next recommended action</SectionLabel>
            <FitText as="h3" excludeGlobalScale style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>
              Confirm the next assessment
            </FitText>
            <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 1.45 }}>
              Avery is due for a movement review before the next plan cycle.
            </FitText>
            <FitButton fullWidth label="Open assessment" icon={ArrowRight} showTrailing />
          </Surface>
        </div>
      </div>
    </StoryShell>
  );
}

type TransactionFields = {
  resource: string;
  quantity: string;
  location: string;
  note: string;
};

function CreateEditTransactionFixture() {
  const { colors } = useTheme();
  const { control, handleSubmit, formState: { errors } } = useForm<TransactionFields>({
    defaultValues: {
      resource: "Strength Lab Pass",
      quantity: "3",
      location: "North studio",
      note: "Reserve for the Tuesday intake batch.",
    },
  });

  return (
    <StoryShell
      eyebrow="Golden archetype / create-edit transaction"
      title="Reserve a resource"
      description="A calm transaction form with explicit validation space, a reviewable summary, and a reversible save action."
    >
      <form
        onSubmit={handleSubmit(() => undefined)}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        <Surface style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 5 }}>
            <SectionLabel>Transaction details</SectionLabel>
            <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 13 }}>
              Fields use stable FitTrack form primitives with synthetic defaults.
            </FitText>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <FitInputField
              control={control}
              name="resource"
              label="Resource"
              placeholder="Choose a resource"
              errors={errors}
              rules={{ required: "Resource is required" }}
            />
            <FitInputField
              control={control}
              name="quantity"
              label="Quantity"
              placeholder="Enter quantity"
              type="number"
              errors={errors}
              rules={{ required: "Quantity is required" }}
            />
            <FitInputField
              control={control}
              name="location"
              label="Location"
              placeholder="Enter location"
              errors={errors}
            />
            <FitInputField
              control={control}
              name="note"
              label="Internal note"
              placeholder="Add context for the team"
              multiline
              rows={4}
              errors={errors}
              className="sm:col-span-2"
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              paddingTop: 4,
              borderTop: `1px solid ${colors.border}`,
              flexWrap: "wrap",
            }}
          >
            <FitButton variant="ghost" label="Cancel" type="button" />
            <FitButton label="Save reservation" icon={Save} type="submit" />
          </div>
        </Surface>

        <Surface style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <SectionLabel>Review</SectionLabel>
            <FitPill mode="status" label="Draft" color={colors.brand} />
          </div>
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 14,
              borderRadius: 10,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
            }}
          >
            <DetailRow label="Resource" value="Strength Lab Pass" />
            <DetailRow label="Quantity" value="3" />
            <DetailRow label="Location" value="North studio" />
            <DetailRow label="Total" value="3 reserved units" />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Check size={16} color={colors.success} style={{ marginTop: 2, flexShrink: 0 }} />
            <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}>
              Saving this fixture stays local to Storybook and does not call an API.
            </FitText>
          </div>
        </Surface>
      </form>
    </StoryShell>
  );
}

const meta = {
  title: "FitTrack/Golden Archetypes",
  tags: ["autodocs"],
  parameters: {
    deterministicCapture: true,
    docs: {
      description: {
        component: "Deterministic FitTrack web fixtures for visual review. All content is synthetic and local.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ResourceListTable: Story = {
  render: () => <ResourceListFixture />,
};

export const EntityDetail: Story = {
  render: () => <EntityDetailFixture />,
};

export const CreateEditTransaction: Story = {
  render: () => <CreateEditTransactionFixture />,
};
