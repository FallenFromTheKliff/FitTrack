import { PASSWORD_REQUIREMENTS } from "./shared-settings";

export type GymField = {
  key: string;
  label: string;
  default: string;
};

export type GymData = Record<string, string>;

export { PASSWORD_REQUIREMENTS };

export const GYM_FIELDS: GymField[] = [
  { key: "name", label: "Gym Name", default: "SERTFIT Gym" },
  { key: "phone", label: "Phone Number", default: "09281234567" },
  { key: "address", label: "Address", default: "123 Fitness Ave, New York, NY 10001" },
  { key: "email", label: "Email", default: "contact@sertfit.com" },
  { key: "hours", label: "Opening Hours", default: "6:00 AM - 10:00 PM" }
];
