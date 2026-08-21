import type { CoachClientRelationshipRecord } from "@fittrack/api-client";
import type { MemberRecord } from "@fittrack/types";

import type { CoachClientSummary } from "./coachClientSummary";

export function mapCoachClientToMember(
  record: CoachClientRelationshipRecord,
): MemberRecord | null {
  const memberId = record.member_id?.trim() || record.member?.id?.trim();
  if (!memberId) return null;

  return {
    email: record.member?.email ?? "",
    id: memberId,
    lastCheckInAt: record.member?.last_check_in_at ?? null,
    membershipCard: record.member?.membership_card?.status
      ? ({ status: record.member.membership_card.status } as NonNullable<
          MemberRecord["membershipCard"]
        >)
      : null,
    phone_no: record.member?.phone_no ?? null,
    profile: record.member?.profile
      ? {
          avatarUrl: record.member.profile.avatar_url ?? null,
          activityLevel: record.member.profile.activity_level ?? null,
          currentWeightKg: record.member.profile.weight_kg ?? null,
          dateOfBirth: record.member.profile.date_of_birth ?? null,
          fitnessGoal: record.member.profile.fitness_goal ?? null,
          firstName: record.member.profile.first_name ?? null,
          gender: record.member.profile.gender ?? null,
          heightCm: record.member.profile.height_cm ?? null,
          lastName: record.member.profile.last_name ?? null,
          membershipType: record.member.profile.membership_type ?? null,
        }
      : null,
    role: { id: 0, name: "USER" },
    status: (record.member?.status ?? "active") as MemberRecord["status"],
    emailVerified: record.member?.email_verified ?? false,
    phoneVerified: record.member?.phone_verified ?? false,
  };
}

export function mapCoachClientsToMembers(
  records: readonly CoachClientRelationshipRecord[],
): MemberRecord[] {
  return records.flatMap((record) => {
    const member = mapCoachClientToMember(record);
    return member ? [member] : [];
  });
}

export function retainOrSelectCoachClient(
  selected: MemberRecord | null,
  filtered: readonly MemberRecord[],
  visibleRows: readonly MemberRecord[],
): MemberRecord | null {
  if (filtered.length === 0) return null;
  const retained = selected
    ? filtered.find((member) => member.id === selected.id)
    : undefined;
  return retained ?? visibleRows[0] ?? null;
}

export function filterCoachClientsBySessionStatus(
  members: readonly MemberRecord[],
  status: string,
  summaries: ReadonlyMap<string, CoachClientSummary>,
): MemberRecord[] {
  if (status === "all") return [...members];

  const wantsUpcoming = status === "has_upcoming";
  return members.filter((member) => {
    const hasUpcoming = (summaries.get(member.id)?.upcoming ?? 0) > 0;
    return hasUpcoming === wantsUpcoming;
  });
}

export function filterCoachClientsByMembershipStatus(
  members: readonly MemberRecord[],
  status: string,
): MemberRecord[] {
  if (status === "all") return [...members];
  const wantsActiveMembership = status === "active_member";
  return members.filter(
    (member) =>
      (member.membershipCard?.status === "active") === wantsActiveMembership,
  );
}

export function filterCoachClientsByActivityLevel(
  members: readonly MemberRecord[],
  activityLevel: string,
): MemberRecord[] {
  if (activityLevel === "all") return [...members];
  return members.filter(
    (member) => member.profile?.activityLevel === activityLevel,
  );
}
