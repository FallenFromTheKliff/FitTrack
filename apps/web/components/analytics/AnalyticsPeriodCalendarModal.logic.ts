export type AnalyticsPeriodPickerMode = "day" | "week" | "month" | "year";

export type PeriodDateParts = {
  day: number;
  month: number;
  year: number;
};

export type AnalyticsPeriodOption = {
  end: string;
  label: string;
  start: string;
};

export const ANALYTICS_PERIOD_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const ANALYTICS_PERIOD_YEAR_PAGE_SIZE = 12;
export const ANALYTICS_PERIOD_MIN_YEAR = 1;
export const ANALYTICS_PERIOD_MAX_YEAR = 9999;

const pad = (value: number) => String(value).padStart(2, "0");

export function createPeriodUtcDate(year: number, month = 1, day = 1): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function formatPeriodYmd(value: Date): string {
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

export function parsePeriodYmd(value?: string | null): PeriodDateParts | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < ANALYTICS_PERIOD_MIN_YEAR || year > ANALYTICS_PERIOD_MAX_YEAR || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = createPeriodUtcDate(year, month, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return { day, month, year };
}

export function normalizePeriodValue(value: string | null | undefined, mode: AnalyticsPeriodPickerMode): string | null {
  const parsed = parsePeriodYmd(value);
  if (!parsed) return null;
  const date = createPeriodUtcDate(parsed.year, parsed.month, parsed.day);
  if (mode === "day") return formatPeriodYmd(date);
  if (mode === "month") return `${String(parsed.year).padStart(4, "0")}-${pad(parsed.month)}-01`;
  if (mode === "year") return `${String(parsed.year).padStart(4, "0")}-01-01`;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return formatPeriodYmd(date);
}

export function addPeriodDays(value: string, days: number): string {
  const parsed = parsePeriodYmd(value);
  if (!parsed) return value;
  const date = createPeriodUtcDate(parsed.year, parsed.month, parsed.day);
  date.setUTCDate(date.getUTCDate() + days);
  return formatPeriodYmd(date);
}

function formatWeekDay(value: string, includeYear: boolean): string {
  const parsed = parsePeriodYmd(value);
  if (!parsed) return value;
  return createPeriodUtcDate(parsed.year, parsed.month, parsed.day).toLocaleDateString("en-PH", {
    day: "numeric", month: "short", ...(includeYear ? { year: "numeric" } : {}), timeZone: "UTC",
  });
}

export function formatPeriodWeekRange(start: string, end: string): string {
  const startParts = parsePeriodYmd(start);
  const endParts = parsePeriodYmd(end);
  if (!startParts || !endParts) return `${start}–${end}`;
  const crossesYear = startParts.year !== endParts.year;
  const startLabel = formatWeekDay(start, crossesYear);
  const endLabel = formatWeekDay(end, crossesYear);
  if (crossesYear || startParts.month !== endParts.month) return `${startLabel}–${endLabel}`;
  return `${startLabel}–${endParts.day}, ${startParts.year}`;
}

export function getAnalyticsPeriodWeekOptions(year: number): AnalyticsPeriodOption[] {
  if (!Number.isInteger(year) || year < ANALYTICS_PERIOD_MIN_YEAR || year > ANALYTICS_PERIOD_MAX_YEAR) return [];
  const firstDay = createPeriodUtcDate(year, 1, 1);
  firstDay.setUTCDate(firstDay.getUTCDate() - ((firstDay.getUTCDay() + 6) % 7));
  const lastDay = createPeriodUtcDate(year, 12, 31);
  lastDay.setUTCDate(lastDay.getUTCDate() - ((lastDay.getUTCDay() + 6) % 7));
  const last = formatPeriodYmd(lastDay);
  const options: AnalyticsPeriodOption[] = [];
  for (let cursor = formatPeriodYmd(firstDay); cursor <= last; cursor = addPeriodDays(cursor, 7)) {
    const end = addPeriodDays(cursor, 6);
    options.push({ end, label: formatPeriodWeekRange(cursor, end), start: cursor });
  }
  return options;
}

export function getAnalyticsPeriodYearPage(year: number) {
  const safeYear = Math.min(ANALYTICS_PERIOD_MAX_YEAR, Math.max(ANALYTICS_PERIOD_MIN_YEAR, Math.trunc(year) || ANALYTICS_PERIOD_MIN_YEAR));
  const start = Math.floor((safeYear - ANALYTICS_PERIOD_MIN_YEAR) / ANALYTICS_PERIOD_YEAR_PAGE_SIZE) * ANALYTICS_PERIOD_YEAR_PAGE_SIZE + ANALYTICS_PERIOD_MIN_YEAR;
  const end = Math.min(ANALYTICS_PERIOD_MAX_YEAR, start + ANALYTICS_PERIOD_YEAR_PAGE_SIZE - 1);
  return { end, start, values: Array.from({ length: end - start + 1 }, (_, index) => start + index) };
}

export function isPeriodAnchorSelectable(value: string, mode: AnalyticsPeriodPickerMode, minValue?: string | null, maxValue?: string | null): boolean {
  const anchor = normalizePeriodValue(value, mode);
  if (!anchor) return false;
  const minAnchor = normalizePeriodValue(minValue, mode);
  const maxAnchor = normalizePeriodValue(maxValue, mode);
  if (minAnchor && maxAnchor && minAnchor > maxAnchor) return false;
  return !(minAnchor && anchor < minAnchor) && !(maxAnchor && anchor > maxAnchor);
}

export function hasSelectablePeriodInYear(mode: AnalyticsPeriodPickerMode, year: number, minValue?: string | null, maxValue?: string | null): boolean {
  if (mode === "week") return getAnalyticsPeriodWeekOptions(year).some((option) => isPeriodAnchorSelectable(option.start, mode, minValue, maxValue));
  if (mode === "month") return Array.from({ length: 12 }, (_, index) => isPeriodAnchorSelectable(`${String(year).padStart(4, "0")}-${pad(index + 1)}-01`, mode, minValue, maxValue)).some(Boolean);
  return isPeriodAnchorSelectable(`${String(year).padStart(4, "0")}-01-01`, mode, minValue, maxValue);
}

export function getPeriodInitialValue(mode: AnalyticsPeriodPickerMode, selectedValue: string | null | undefined, minValue: string | null | undefined, maxValue: string | null | undefined, today = new Date()): string {
  const selected = normalizePeriodValue(selectedValue, mode);
  if (selected) return selected;
  const minimum = normalizePeriodValue(minValue, mode);
  if (minimum) return minimum;
  const maximum = normalizePeriodValue(maxValue, mode);
  if (maximum) return maximum;
  const todayYmd = formatPeriodYmd(createPeriodUtcDate(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()));
  return normalizePeriodValue(todayYmd, mode) ?? "0001-01-01";
}
