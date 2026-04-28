import type { FieldConfig } from "@/components/modals/DetailsModal";
import { COLS, ROWS } from "@/data/facilities/mapTypes";

export const VENUE_ICON_OPTIONS = [
    { label: "Basketball", value: "basketball" },
    { label: "Volleyball", value: "volleyball" },
    { label: "Boxing", value: "boxing" },
    { label: "Reception", value: "reception" },
    { label: "Gym Area", value: "gym-area" },
    { label: "Yoga", value: "yoga" }
];

export const VENUE_BOOKING_OPTIONS = [
    { label: "Reservable", value: "true" },
    { label: "Facility Only", value: "false" }
];

export const VENUE_FLOOR_OPTIONS = [
    { label: "Floor 1", value: "floor-1" },
    { label: "Floor 2", value: "floor-2" },
    { label: "Floor 3", value: "floor-3" }
];

export const VENUE_FIELDS: FieldConfig[] = [
    { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g., Boxing Ring" },
    { name: "description", label: "Description", type: "textarea", placeholder: "Optional venue description" },
    { name: "capacity", label: "Capacity", type: "text", required: true, placeholder: "e.g., 25" },
    { name: "hourlyRate", label: "Hourly Rate", type: "text", placeholder: "Leave blank for facility-only zones" },
    { name: "minimumHours", label: "Minimum Hours", type: "text", placeholder: "Default 1" },
    {
        name: "iconKey",
        label: "Icon",
        type: "select",
        options: VENUE_ICON_OPTIONS
    },
    {
        name: "floorId",
        label: "Floor",
        type: "select",
        options: VENUE_FLOOR_OPTIONS
    },
    { name: "gridColumn", label: "Grid Column", type: "text", required: true, placeholder: `1-${COLS}` },
    { name: "gridRow", label: "Grid Row", type: "text", required: true, placeholder: `1-${ROWS}` },
    { name: "gridWidth", label: "Grid Width", type: "text", required: true, placeholder: "e.g., 3" },
    { name: "gridHeight", label: "Grid Height", type: "text", required: true, placeholder: "e.g., 2" },
    {
        name: "isReservable",
        label: "User Booking",
        type: "radio",
        options: VENUE_BOOKING_OPTIONS
    },
    { name: "displayOrder", label: "Display Order", type: "text", placeholder: "Lower numbers appear first" }
];

export const FACILITY_TABS = [
    { key: "floor", label: "Floor Plan" },
    { key: "venues", label: "Venue Management" }
] as const;

export type FacilityTab = typeof FACILITY_TABS[number]["key"];

export const VENUE_INITIAL_VALUES = {
    name: "",
    description: "",
    capacity: "",
    hourlyRate: "",
    minimumHours: "1",
    iconKey: "gym-area",
    imageUrl: "",
    floorId: "floor-1",
    gridColumn: "1",
    gridRow: "1",
    gridWidth: "2",
    gridHeight: "2",
    isReservable: "true",
    displayOrder: "0"
};
