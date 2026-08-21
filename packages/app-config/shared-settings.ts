import type { PasswordRequirementKey } from "@fittrack/utils";

export type { PasswordRequirementKey };

export type PasswordRequirementItem = {
  key: PasswordRequirementKey;
  label: string;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirementItem[] = [
  { key: "minLength", label: "Minimum 8 characters" },
  { key: "hasUppercase", label: "At least one uppercase letter" },
  { key: "hasLowercase", label: "At least one lowercase letter" },
  { key: "hasNumber", label: "At least one number" },
  { key: "hasSpecial", label: "At least one special character" }
];
