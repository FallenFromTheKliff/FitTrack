import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type { VenueBookingRecord } from "@fittrack/api-client";
import type {
  FloorVenueRecord,
  GymLayoutEquipmentRecord,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { FacilitiesVenuesTable } from "./FacilitiesVenuesTable";

const FIXED_NOW = "2026-09-10T08:00:00.000Z";

function venueRecord(
  index: number,
  overrides: Partial<FloorVenueRecord> = {},
): FloorVenueRecord {
  const id = `venue-${index}`;
  return {
    id,
    slug: id,
    name: [
      "Strength Studio",
      "Boxing Ring",
      "Recovery Room",
      "Functional Turf",
      "Yoga Loft",
      "Spin Deck",
      "Mobility Bay",
      "Sprint Lane",
      "Pilates Room",
      "Assessment Suite",
      "Free Weights",
      "Quiet Stretch",
    ][index - 1] ?? `Training Zone ${index}`,
    description: "A focused training space for members and coaches.",
    capacity: 8 + index * 2,
    hourlyRate: 450 + index * 50,
    minimumHours: 1,
    amenities: ["Mirrors", "Storage"],
    iconKey: index % 2 === 0 ? "boxing" : "gym-area",
    floorId: "floor-1",
    gridColumn: ((index - 1) % 6) + 1,
    gridRow: Math.floor((index - 1) / 6) + 1,
    gridWidth: 2,
    gridHeight: 2,
    isReservable: true,
    isSystem: index === 1,
    displayOrder: index,
    isActive: true,
    isMapped: true,
    imageUrl: null,
    imageFit: "cover",
    imageFocalX: 0.5,
    imageFocalY: 0.5,
    imageCropZoom: 1,
    status: "available",
    mapId: `map-${id}`,
    sourceVenueId: id,
    isBookable: true,
    bookingBlockReason: null,
    ...overrides,
  };
}

const SHORT_VENUES: FloorVenueRecord[] = [
  venueRecord(1),
  venueRecord(2, { status: "maintenance" }),
  venueRecord(3, { isActive: false }),
];

const LONG_VENUES: FloorVenueRecord[] = Array.from(
  { length: 12 },
  (_, index) => {
    const number = index + 1;
    if (number === 4) return venueRecord(number, { isMapped: false });
    if (number === 7) return venueRecord(number, { status: "maintenance" });
    if (number === 10) return venueRecord(number, { isActive: false });
    return venueRecord(number);
  },
);

const ACTIVE_BOOKINGS: VenueBookingRecord[] = [
  {
    id: "booking-1",
    durationHours: 1,
    endTime: "2026-09-10T10:00:00.000Z",
    startTime: "2026-09-10T09:00:00.000Z",
    venueId: "venue-2",
  },
  {
    id: "booking-2",
    durationHours: 2,
    endTime: "2026-09-10T12:00:00.000Z",
    startTime: "2026-09-10T10:00:00.000Z",
    venueId: "venue-7",
  },
];

const EQUIPMENT: GymLayoutEquipmentRecord[] = [1, 2, 7].map((index) => ({
  createdAt: FIXED_NOW,
  floorId: "floor-1",
  gridColumn: index,
  gridHeight: 1,
  gridRow: 1,
  gridWidth: 1,
  iconKey: "dumbbell",
  id: `equipment-${index}`,
  imageUrl: null,
  inventoryItemId: `inventory-${index}`,
  isActive: true,
  name: `Equipment ${index}`,
  positionX: index,
  positionY: 1,
  placedQuantity: 1,
  remainingPlaceableQuantity: 2,
  status: "available",
  type: "strength",
  updatedAt: FIXED_NOW,
  venueId: `venue-${index}`,
}));

type StoryProps = {
  isError?: boolean;
  isLoading?: boolean;
  venues: FloorVenueRecord[];
};

function VenuesTableStory({
  isError = false,
  isLoading = false,
  venues,
}: StoryProps) {
  const { colors } = useTheme();
  const [selectedVenueId, setSelectedVenueId] = useState<
    FloorVenueRecord["id"] | null
  >(null);
  const [lastAction, setLastAction] = useState("No table action yet");
  const report = (message: string) => setLastAction(message);

  return (
    <div
      style={{
        backgroundColor: colors.base,
        color: colors.textPrimary,
        display: "grid",
        gap: 12,
        gridTemplateRows: "minmax(0, 1fr) auto",
        height: "calc(100vh - 64px)",
        minHeight: 560,
        padding: 18,
        width: "100%",
      }}
    >
      <FacilitiesVenuesTable
        activeBookings={ACTIVE_BOOKINGS}
        colors={colors}
        equipment={EQUIPMENT}
        floorId="floor-1"
        isError={isError}
        isLoading={isLoading}
        onAddVenue={() => report("Add venue")}
        onArchiveVenue={(venue) => report(`Archive ${venue.name}`)}
        onEditVenue={(venue) => report(`Edit ${venue.name}`)}
        onFloorChange={(floorId) => report(`Floor changed to ${floorId}`)}
        onOpenArchive={() => report("Archive opened")}
        onRemoveFromMap={(venue) => report(`Remove ${venue.name} from map`)}
        onRetry={() => report("Retry venues")}
        onSelectVenue={(venue) => {
          setSelectedVenueId((current) =>
            current === venue.id ? null : venue.id,
          );
          report(`Selected ${venue.name}`);
        }}
        onToggleMaintenance={(venue) => report(`Toggle ${venue.name} maintenance`)}
        onViewDetails={(venue) => report(`View details for ${venue.name}`)}
        selectedVenueId={selectedVenueId}
        venues={venues}
      />
      <div
        aria-live="polite"
        data-testid="story-last-action"
        role="status"
        style={{
          borderTop: `1px solid ${colors.border}`,
          color: colors.textMuted,
          fontSize: 12,
          paddingTop: 8,
        }}
      >
        Last table action: {lastAction}
      </div>
    </div>
  );
}

const meta = {
  title: "FitTrack/Facilities/VenuesTable",
  component: FacilitiesVenuesTable,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FacilitiesVenuesTable>;

export default meta;
type Story = StoryObj<typeof VenuesTableStory>;

export const ShortList: Story = {
  args: { venues: SHORT_VENUES },
  render: () => <VenuesTableStory venues={SHORT_VENUES} />,
};

export const LongList: Story = {
  args: { venues: LONG_VENUES },
  render: () => <VenuesTableStory venues={LONG_VENUES} />,
};

export const Empty: Story = {
  args: { venues: [] },
  render: () => <VenuesTableStory venues={[]} />,
};

export const Loading: Story = {
  args: { venues: SHORT_VENUES, isLoading: true },
  render: () => <VenuesTableStory isLoading venues={SHORT_VENUES} />,
};

export const ErrorWithRetry: Story = {
  args: { venues: SHORT_VENUES, isError: true },
  render: () => <VenuesTableStory isError venues={SHORT_VENUES} />,
};
