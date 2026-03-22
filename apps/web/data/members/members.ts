import type { FieldConfig } from "@/components/modals/DetailsModal";

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