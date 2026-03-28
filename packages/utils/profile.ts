import type { MemberRecord } from "../types";

export function calcBMI(weightKg: number, heightCm: number) {
  const heightMeters = heightCm / 100;
  const bmi = Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
  const status = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  return { bmi, status };
}

export function splitFullName(fullName: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]
  };
}

export function fullName(member: MemberRecord): string {
  return `${member.profile?.firstName ?? ""} ${member.profile?.lastName ?? ""}`.trim();
}

export function membershipType(member: MemberRecord): string {
  return member.profile?.membershipType ?? "Basic";
}