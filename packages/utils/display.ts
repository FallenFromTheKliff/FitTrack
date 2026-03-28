export type PasswordRequirementKey =
  | "minLength"
  | "hasUppercase"
  | "hasLowercase"
  | "hasNumber"
  | "hasSpecial";

export const PASSWORD_REQUIREMENT_ITEMS: Array<{ key: PasswordRequirementKey; label: string }> = [
  { key: "minLength", label: "Minimum 8 characters" },
  { key: "hasUppercase", label: "At least one uppercase letter" },
  { key: "hasLowercase", label: "At least one lowercase letter" },
  { key: "hasNumber", label: "At least one number" },
  { key: "hasSpecial", label: "At least one special character" }
];

export const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export const CALENDAR_VIEW_OPTIONS = [
  { value: "DAYS", label: "Days" },
  { value: "MONTHS", label: "Months" },
  { value: "YEARS", label: "Years" }
] as const;

export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;
