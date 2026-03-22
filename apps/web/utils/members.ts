import type { MemberRecord } from "@fittrack/types";

export function fullName(member: MemberRecord): string {
  return `${member.profile?.firstName ?? ""} ${member.profile?.lastName ?? ""}`.trim();
}

export function membershipType(member: MemberRecord): string {
  return member.profile?.membershipType ?? "Basic";
}