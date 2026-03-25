export type ScheduleResourceType = "trainer" | "facility";

export type ScheduleResource = {
  id: string;
  name: string;
  type: ScheduleResourceType;
  icon: string;
};

export type BookingRecord = {
  id: string;
  venueId: number;
  status: string;
};

export type ResourceDraft = {
  name: string;
  type: "" | ScheduleResourceType;
  icon: string;
};

export const SCHEDULE_EMOJI_OPTIONS = [
  "\ud83c\udfcb\ufe0f",
  "\ud83c\udfc0",
  "\ud83e\udd4a",
  "\ud83c\udfd0",
  "\ud83e\udd38",
  "\ud83d\udc64",
  "\ud83c\udfbd",
  "\ud83c\udfdf\ufe0f",
  "\ud83d\udcaa",
  "\ud83e\uddd8"
] as const;
