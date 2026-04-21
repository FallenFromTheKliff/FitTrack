import type { FieldConfig } from "@/components/modals/DetailsModal";
import type { MemberRecord } from "@fittrack/types";
export type {
  AchievementReviewRecord,
  AchievementReviewStatus,
} from "@/data/progress/milestones";
export {
  ACHIEVEMENT_REVIEW_SEED,
  ACHIEVEMENT_REVIEW_STATUS_COLORS,
} from "@/data/progress/milestones";

export const MEMBER_STATUS_TABS = [
  { key: "Active", label: "Active" },
  { key: "Archived", label: "Archived" }
] as const;

export type MemberStatusTab = typeof MEMBER_STATUS_TABS[number]["key"];

export type DeletionRequest = {
  id: string;
  userId?: string | null;
  status?: string | null;
  createdAt?: string;
  user?: MemberRecord;
};

export type DeletionRequestResponse = {
  total: number;
  requests: DeletionRequest[];
};

export const MEMBERSHIP_CARD_STATUS_COLORS: Record<string, string> = {
  Member: "var(--fit-success)",
  "Non-member": "var(--fit-text-secondary)",
  "Pending verification": "var(--fit-warning)",
  Revoked: "var(--fit-danger)",
  "Not Applicable": "var(--fit-text-secondary)"
};

export const STATUS_COLORS: Record<string, string> = {
  Active: "var(--fit-success)",
  Archived: "var(--fit-warning)"
};

export const TIER_COLORS: Record<string, string> = {
  Member: "var(--fit-text-muted)",
  Premium: "var(--fit-brand)",
  VIP: "var(--fit-warning)",
  "Not Applicable": "var(--fit-border)"
};

export const MEMBER_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Admin", value: "Admin" },
  { label: "Staff", value: "Staff" },
  { label: "Members", value: "Member" }
];

export const ADD_USER_FIELDS: FieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", required: true, placeholder: "Enter the account holder's given name" },
  { name: "lastName", label: "Last Name", type: "text", required: true, placeholder: "Enter the account holder's surname" },
  { name: "email", label: "Email Address", type: "email", required: true, placeholder: "person@gmail.com or person@fittrack.com" },
  {
    name: "role",
    label: "Account Role",
    type: "select",
    required: true,
    hint: "Member accounts start unverified and receive an email OTP. Staff and admin accounts are activated immediately.",
    options: [
      { label: "Member (OTP verification)", value: "member" },
      { label: "Staff (active immediately)", value: "staff" },
      { label: "Admin (active immediately)", value: "admin" }
    ]
  },
  { name: "phone_no", label: "Phone Number", type: "tel", required: false, placeholder: "09XXXXXXXXX", hint: "Optional. Enter a local PH mobile number and we will normalize it for the account.", maxLength: 11 },
  { name: "password", label: "Password", type: "password", required: true, placeholder: "Set a temporary password with upper, lower, number, and symbol" }
];

export const EDIT_MEMBER_FIELDS: FieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", required: true, placeholder: "First name" },
  { name: "lastName", label: "Last Name", type: "text", required: true, placeholder: "Last name" },
  { name: "email", label: "Email", type: "email", required: true, readOnly: true, placeholder: "email@example.com", hint: "Email edits are not supported from this directory." },
  { name: "phone_no", label: "Phone Number", type: "tel", readOnly: true, placeholder: "09XXXXXXXXX", maxLength: 11, hint: "Phone changes currently follow the member profile flow." },
  { name: "dateOfBirth", label: "Date of Birth", type: "date", placeholder: "" },
  {
    name: "gender",
    label: "Gender",
    type: "select",
    placeholder: "Select gender",
    options: [
      { label: "Male", value: "male" },
      { label: "Female", value: "female" },
      { label: "Other", value: "other" }
    ]
  },
  {
    name: "activityLevel",
    label: "Activity Level",
    type: "select",
    placeholder: "Select activity level",
    options: [
      { label: "Sedentary", value: "sedentary" },
      { label: "Light", value: "light" },
      { label: "Moderate", value: "moderate" },
      { label: "Active", value: "active" },
      { label: "Very active", value: "very_active" }
    ]
  },
  {
    name: "fitnessGoal",
    label: "Fitness Goal",
    type: "select",
    placeholder: "Select fitness goal",
    options: [
      { label: "Bulking", value: "bulking" },
      { label: "Cutting", value: "cutting" },
      { label: "Maintenance", value: "maintenance" },
      { label: "Sport specific", value: "sport_specific" }
    ]
  },
  { name: "currentWeightKg", label: "Weight (kg)", type: "number", placeholder: "72", min: 30, max: 300, step: 0.1 },
  { name: "heightCm", label: "Height (cm)", type: "number", placeholder: "170", min: 100, max: 250, step: 1 },
  {
    name: "membershipAccess",
    label: "Member Access",
    type: "select",
    readOnly: true,
    hint: "Member access is tied to ownership of a verified membership card. Staff, admin, and coach roles show Not Applicable here.",
    options: [
      { label: "Not Applicable", value: "not_applicable" },
      { label: "Non-member", value: "none" },
      { label: "Pending verification", value: "pending_verification" },
      { label: "Member", value: "active" },
      { label: "Revoked", value: "revoked" }
    ]
  }
];
