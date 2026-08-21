import { CalendarDays, Mail, Phone, User } from "lucide-react";

export type PersonalFieldKey = "firstName" | "lastName" | "email" | "phone" | "dateOfBirth";

export const PERSONAL_FIELDS: {
  key: PersonalFieldKey;
  label: string;
  icon: typeof User;
  type?: string;
  placeholder: string;
}[] = [
  { key: "firstName", label: "First Name", icon: User, placeholder: "First name" },
  { key: "lastName", label: "Last Name", icon: User, placeholder: "Last name" },
  { key: "email", label: "Email", icon: Mail, type: "email", placeholder: "you@domain.com" },
  { key: "phone", label: "Phone", icon: Phone, type: "tel", placeholder: "0917xxxxxxx" },
  { key: "dateOfBirth", label: "Date of Birth", icon: CalendarDays, type: "date", placeholder: "" }
];