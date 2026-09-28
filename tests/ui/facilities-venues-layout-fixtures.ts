import type { Page, Route } from "@playwright/test";

export const FIXED_NOW = "2026-09-10T08:00:00.000Z";
export const ADMIN_ID = "88888888-8888-4888-8888-888888888888";

export function fixtureAmenityId(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const VENUE_IMAGE_URLS = [
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==#cover",
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==#detail-one",
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==#detail-two",
];
const FACILITY_CANVAS_ORIGIN = { column: 500, row: 500 };
const FACILITY_FOOTPRINT_COLUMNS = 14;
const FACILITY_FOOTPRINT_ROWS = 10;
const FACILITY_FOOTPRINT_START_COLUMN =
  FACILITY_CANVAS_ORIGIN.column -
  Math.floor((FACILITY_FOOTPRINT_COLUMNS + 1) / 2) +
  1;
const FACILITY_FOOTPRINT_START_ROW =
  FACILITY_CANVAS_ORIGIN.row -
  Math.floor((FACILITY_FOOTPRINT_ROWS + 1) / 2) +
  1;

export type FacilitiesFixtureMode = "short" | "long" | "empty" | "error" | "loading";

export type FacilitiesFixture = {
  enableRetry: () => void;
  mode: FacilitiesFixtureMode;
  observed: string[];
  pageErrors: string[];
  retainHiddenVenueAtPlacementDestination: boolean;
  consoleErrors: string[];
  releaseLoading: () => void;
  retryEnabled: boolean;
  unhandled: string[];
  venuePatches: Array<{ body: Record<string, unknown>; id: string }>;
  venueRequests: number;
  waitForLoading: Promise<void>;
};

const CORS_HEADERS = {
  "access-control-allow-credentials": "true",
  "access-control-allow-origin": "http://127.0.0.1:8080",
  "access-control-allow-headers": "Authorization,Content-Type",
  "access-control-allow-methods": "GET,OPTIONS,PATCH",
  "cache-control": "no-store",
};

const adminProfile = () => ({
  id: ADMIN_ID,
  email: "admin-facilities@fittrack.test",
  email_verified: true,
  has_accepted_privacy: true,
  role: "ADMIN",
  status: "active",
  membership_card: null,
  profile: {
    first_name: "Ada",
    last_name: "Facilities Admin",
    activity_level: "active",
    fitness_goal: "maintenance",
  },
});

function amenityRecord(index: number) {
  const id = fixtureAmenityId(index);
  return {
    id,
    name: `Venue ${String(index).padStart(2, "0")}`,
    description: "A synthetic training area used for deterministic layout evidence.",
    capacity: 8 + index,
    hourly_rate: 450 + index * 25,
    minimum_hours: 1,
    icon_key: "gym-area",
    type: "other",
    floor_id: "floor-1",
    grid_column: FACILITY_FOOTPRINT_START_COLUMN + ((index - 1) % 6) * 2,
    grid_row: FACILITY_FOOTPRINT_START_ROW + Math.floor((index - 1) / 6) * 2,
    grid_width: 2,
    grid_height: 2,
    is_reservable: true,
    is_active: index !== 10,
    is_mapped: true,
    display_order: index,
    image_url: VENUE_IMAGE_URLS[0],
    image_urls: VENUE_IMAGE_URLS,
    image_fit: "cover",
    image_focal_x: 0.5,
    image_focal_y: 0.5,
    image_crop_zoom: 1,
    status: index === 7 ? "maintenance" : "available",
  };
}

function operationalVenues(mode: FacilitiesFixtureMode) {
  if (mode === "empty") return [];
  const count = mode === "short" || mode === "loading" || mode === "error" ? 3 : 12;
  return Array.from({ length: count }, (_, index) => amenityRecord(index + 1));
}

function equipmentRecord(index: number) {
  return {
    created_at: FIXED_NOW,
    floor_id: "floor-1",
    grid_column: FACILITY_FOOTPRINT_START_COLUMN + (index - 1) * 2,
    grid_height: 1,
    grid_row: FACILITY_FOOTPRINT_START_ROW,
    grid_width: 1,
    icon_key: "dumbbell",
    id: `layout-equipment-${index}`,
    image_url: null,
    inventory_item_id: `inventory-equipment-${index}`,
    is_active: true,
    name: `Equipment ${index}`,
    position_x: index,
    position_y: 1,
    placed_quantity: 1,
    remaining_placeable_quantity: 2,
    status: "available",
    type: "strength",
    updated_at: FIXED_NOW,
    venue_id: fixtureAmenityId(index),
  };
}

function inventoryRecord(index: number) {
  return {
    created_at: FIXED_NOW,
    description: "Synthetic inventory item.",
    id: `inventory-equipment-${index}`,
    image_url: null,
    is_active: true,
    name: `Equipment ${index}`,
    quantity_current: 4,
    quantity_total: 5,
    status_counts: { available: 4, maintenance: 0, broken: 0, missing: 0 },
    placed_quantity: 1,
    remaining_placeable_quantity: 2,
    unit: "units",
    updated_at: FIXED_NOW,
  };
}

const snapshot = () => ({
  generated_at: FIXED_NOW,
  floors: ["floor-1", "floor-2", "floor-3"].map((floorId) => ({
    floor_id: floorId,
    grid_columns: 14,
    grid_rows: 10,
    image_url: null,
    footprint_cells: [],
    path_cells: [],
    entry_cells: [],
    exit_cells: [],
    equipment: [],
    regions: [],
  })),
});

function canonicalFootprint() {
  return Array.from({ length: FACILITY_FOOTPRINT_ROWS }, (_, row) =>
    Array.from({ length: FACILITY_FOOTPRINT_COLUMNS }, (_, column) => ({
      column: FACILITY_FOOTPRINT_START_COLUMN + column,
      row: FACILITY_FOOTPRINT_START_ROW + row,
    })),
  ).flat();
}

function floorPlanMedia() {
  return ["floor-1", "floor-2", "floor-3"].map((floorId) => ({
    created_at: FIXED_NOW,
    entry_cells: [],
    exit_cells: [],
    floor_id: floorId,
    footprint_cells: canonicalFootprint(),
    grid_height: FACILITY_FOOTPRINT_ROWS,
    grid_width: FACILITY_FOOTPRINT_COLUMNS,
    image_url: null,
    path_cells:
      floorId === "floor-1"
        ? [
            {
              column: FACILITY_CANVAS_ORIGIN.column,
              row: FACILITY_CANVAS_ORIGIN.row,
            },
          ]
        : [],
    updated_at: FIXED_NOW,
  }));
}

const bookings = () => [
  {
    id: "booking-venue-02",
    amenity_id: fixtureAmenityId(2),
    amenity: {
      id: fixtureAmenityId(2),
      name: "Venue 02",
      capacity: 10,
      hourly_rate: 500,
    },
    starts_at: "2026-09-10T09:00:00.000Z",
    ends_at: "2026-09-10T10:00:00.000Z",
    status: "confirmed",
    created_at: FIXED_NOW,
    user_id: ADMIN_ID,
  },
];

function venueFeedbackHistory(amenityId: string) {
  return Array.from({ length: 12 }, (_, index) => ({
    amenity: { id: amenityId, name: `Venue ${amenityId.slice(-2)}`, type: "other" },
    comment: index === 11 ? null : `Feedback comment ${index + 1}.`,
    created_at: `2026-09-${String(10 - Math.min(index, 8)).padStart(2, "0")}T08:00:00.000Z`,
    id: `feedback-${amenityId}-${index + 1}`,
    rating: (index % 5) + 1,
    submitted_by: {
      id: `member-${index + 1}`,
      name: `Feedback Member ${index + 1}`,
      role: "USER",
    },
    updated_at: FIXED_NOW,
  }));
}

async function fulfillData(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify({ data }),
  });
}

async function fulfillPaginated(route: Route, data: unknown[]) {
  await route.fulfill({
    status: 200,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify({
      data,
      meta: { page: 1, limit: data.length || 20, total: data.length, total_pages: data.length ? 1 : 0 },
    }),
  });
}

export function createFacilitiesFixture(mode: FacilitiesFixtureMode = "long"): FacilitiesFixture {
  let loadingResolver: (() => void) | null = null;
  const loadingGate = new Promise<void>((resolve) => {
    loadingResolver = resolve;
  });
  const fixture: FacilitiesFixture = {
    enableRetry: () => {
      fixture.retryEnabled = true;
    },
    mode,
    observed: [],
    pageErrors: [],
    retainHiddenVenueAtPlacementDestination: false,
    consoleErrors: [],
    releaseLoading: () => {
      loadingResolver?.();
      loadingResolver = null;
    },
    retryEnabled: false,
    unhandled: [],
    venuePatches: [],
    venueRequests: 0,
    waitForLoading: loadingGate,
  };

  return fixture;
}

export async function installFacilitiesFixture(
  page: Page,
  fixture: FacilitiesFixture = createFacilitiesFixture(),
): Promise<FacilitiesFixture> {
  const venueRecords = operationalVenues(fixture.mode);
  if (fixture.retainHiddenVenueAtPlacementDestination) {
    const retainedVenue = venueRecords.find(
      (venue) => venue.id === fixtureAmenityId(2),
    );
    if (retainedVenue) {
      retainedVenue.grid_column = FACILITY_FOOTPRINT_START_COLUMN;
      retainedVenue.grid_row = FACILITY_FOOTPRINT_START_ROW + 6;
      retainedVenue.is_mapped = false;
    }
  }
  page.on("pageerror", (error) => fixture.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") fixture.consoleErrors.push(message.text());
  });

  await page.addInitScript(({ adminId }) => {
    localStorage.setItem("fittrack_access_token", "facilities-layout-fixture-token");
    localStorage.setItem("fittrack_refresh_token", "facilities-layout-fixture-refresh");
    localStorage.setItem(
      `fittrack_prefs_${adminId}`,
      JSON.stringify({ themeKey: "night", fontKey: "standard", animationLevel: "none" }),
    );
  }, { adminId: ADMIN_ID });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const label = `${method} ${path}`;
    fixture.observed.push(label);

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const amenityPatchMatch = path.match(/^\/v1\/bookings\/amenities\/([^/]+)$/);
    if (method === "PATCH" && amenityPatchMatch) {
      let patch: Record<string, unknown>;
      try {
        patch = request.postDataJSON() as Record<string, unknown>;
      } catch {
        patch = {};
      }
      const venue = venueRecords.find((record) => record.id === amenityPatchMatch[1]);
      if (!venue) {
        await fulfillData(route, { detail: "Synthetic venue not found." }, 404);
        return;
      }
      Object.assign(venue, patch);
      fixture.venuePatches.push({ body: patch, id: venue.id });
      await fulfillData(route, venue);
      return;
    }

    if (method !== "GET") {
      fixture.unhandled.push(label);
      await route.abort();
      return;
    }

    switch (path) {
      case "/v1/users/me":
        await fulfillData(route, adminProfile());
        return;
      case "/v1/notifications/unread-count":
        await fulfillData(route, { count: 0, unread_count: 0 });
        return;
      case "/v1/notifications/my":
        await fulfillPaginated(route, []);
        return;
      case "/v1/bookings/amenity":
        await fulfillData(route, bookings());
        return;
      case "/v1/bookings/amenities/operations":
        fixture.venueRequests += 1;
        if (fixture.mode === "loading") {
          await fixture.waitForLoading;
        }
        if (fixture.mode === "error" && !fixture.retryEnabled) {
          await fulfillData(route, { detail: "Synthetic facilities read failure." }, 503);
          return;
        }
        await fulfillData(route, fixture.mode === "empty" ? [] : venueRecords);
        return;
      case "/v1/bookings/amenities/archived":
        await fulfillData(route, []);
        return;
      case "/v1/gym-layout/equipment":
        await fulfillData(route, [equipmentRecord(1), equipmentRecord(2)]);
        return;
      case "/v1/gym-layout/equipment/archived":
        await fulfillData(route, []);
        return;
      case "/v1/gym-layout/floor-plans/media":
        await fulfillData(route, floorPlanMedia());
        return;
      case "/v1/gym-layout/snapshot":
        await fulfillData(route, snapshot());
        return;
      case "/v1/inventory/equipment":
        await fulfillPaginated(route, [inventoryRecord(1), inventoryRecord(2)]);
        return;
      default:
        if (/^\/v1\/bookings\/amenities\/[^/]+\/feedback\/history$/.test(path)) {
          const amenityId = path.split("/")[4] ?? "venue";
          const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
          const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 10));
          const entries = venueFeedbackHistory(amenityId);
          const items = entries.slice((page - 1) * limit, page * limit);
          await fulfillData(route, {
            average_rating: entries.reduce((total, entry) => total + entry.rating, 0) / entries.length,
            has_more: page * limit < entries.length,
            items,
            limit,
            page,
            total: entries.length,
          });
          return;
        }
        if (/^\/v1\/bookings\/amenities\/[^/]+\/feedback$/.test(path)) {
          await fulfillData(route, []);
          return;
        }
        fixture.unhandled.push(label);
        await route.abort();
    }
  });

  return fixture;
}
