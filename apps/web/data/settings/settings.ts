export type GymField = {
  key: string;
  label: string;
  default: string;
};

export type PasswordRequirementKey =
  | "minLength"
  | "hasUppercase"
  | "hasLowercase"
  | "hasNumber"
  | "hasSpecial";

export const PASSWORD_REQUIREMENTS: Array<{ key: PasswordRequirementKey; label: string }> = [
  { key: "minLength", label: "Minimum 8 characters" },
  { key: "hasUppercase", label: "At least one uppercase letter" },
  { key: "hasLowercase", label: "At least one lowercase letter" },
  { key: "hasNumber", label: "At least one number" },
  { key: "hasSpecial", label: "At least one special character" }
];

export const GYM_FIELDS: GymField[] = [
  { key: "name", label: "Gym Name", default: "SERTFIT Gym" },
  { key: "phone", label: "Phone Number", default: "09281234567" },
  { key: "address", label: "Address", default: "123 Fitness Ave, New York, NY 10001" },
  { key: "email", label: "Email", default: "contact@sertfit.com" },
  { key: "hours", label: "Opening Hours", default: "6:00 AM - 10:00 PM" }
];