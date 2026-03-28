import type { FieldConfig } from "@/components/modals/DetailsModal";
import type { MemberRecord } from "@fittrack/types";

export const MEMBER_STATUS_TABS = [
  { key: "Active", label: "Active" },
  { key: "Frozen", label: "Frozen" }
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

export const STATUS_COLORS: Record<string, string> = {
  Active: "var(--fit-success)",
  Frozen: "var(--fit-warning)"
};

export const TIER_COLORS: Record<string, string> = {
  member: "var(--fit-text-muted)",
  premium: "var(--fit-brand)",
  vip: "var(--fit-warning)"
};

export const MEMBER_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Admin", value: "Admin" },
  { label: "Staff", value: "Staff" },
  { label: "Coach", value: "Coach" },
  { label: "Member", value: "Member" }
];

export const ADD_STAFF_FIELDS: FieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", required: false, placeholder: "e.g., John" },
  { name: "lastName", label: "Last Name", type: "text", required: false, placeholder: "e.g., Doe" },
  { name: "email", label: "Email Address", type: "email", required: true, placeholder: "e.g., john@sertfit.com" },
  { name: "phone_no", label: "Phone Number", type: "tel", required: false, placeholder: "e.g., 09171234567", hint: "11 digits", maxLength: 11 },
  { name: "password", label: "Password", type: "text", required: true, placeholder: "Create temporary password" }
];

export const EDIT_MEMBER_FIELDS: FieldConfig[] = [
  { name: "firstName", label: "First Name", type: "text", placeholder: "First name" },
  { name: "lastName", label: "Last Name", type: "text", placeholder: "Last name" },
  { name: "email", label: "Email", type: "email", required: true, placeholder: "email@example.com" },
  { name: "phone_no", label: "Phone Number", type: "tel", placeholder: "09XXXXXXXXX", maxLength: 11 },
  {
    name: "membershipType",
    label: "Membership Type",
    type: "select",
    options: [
      { label: "Member", value: "member" },
      { label: "Premium", value: "premium" },
      { label: "VIP", value: "vip" }
    ]
  }
];

export const UPGRADE_COACH_FIELDS: FieldConfig[] = [
  { name: "specialties", label: "Specialties", type: "textarea", required: true, placeholder: "Strength, Boxing, Conditioning" },
  { name: "bio", label: "Bio", type: "textarea", placeholder: "Short coach introduction" },
  { name: "certifications", label: "Certifications", type: "textarea", placeholder: "NASM, CPR, First Aid" },
  { name: "yearsExperience", label: "Years of Experience", type: "text", required: true, placeholder: "e.g., 4" },
  { name: "hourlyRate", label: "Hourly Rate", type: "text", required: true, placeholder: "e.g., 850" }
];
