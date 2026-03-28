import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import type { DeletionRequest } from "@/data/members/members";
import type { MemberRecord } from "@fittrack/types";
import { fullName } from "@fittrack/utils";

export const MIN_ACTION_DELAY_MS = FEEDBACK_DURATION_MS.standard;

export function getPendingRequestsByUserId(deletionRequests: DeletionRequest[]) {
  const map = new Map<string, DeletionRequest>();

  deletionRequests.forEach((request) => {
    const status = request.status?.toLowerCase() ?? "";
    const userId = request.userId ?? request.user?.id ?? "";
    if (!userId || status !== "pending") return;
    map.set(userId, request);
  });

  return map;
}

export function filterMembers(
  members: MemberRecord[],
  query: string,
  activeChip: string,
  activeStatus: "Active" | "Frozen",
  pendingRequestsByUserId: Map<string, DeletionRequest>
) {
  return members.filter((member) => {
    const normalizedQuery = query.toLowerCase();
    const name = fullName(member).toLowerCase();
    const matchesSearch =
      name.includes(normalizedQuery) || member.email.toLowerCase().includes(normalizedQuery);
    const isFrozen = pendingRequestsByUserId.has(member.id);
    const role = member.role?.name ?? "USER";
    const matchesStatus = activeStatus === "Active" ? !isFrozen : isFrozen;
    const matchesChip =
      activeChip === "all" ||
      (activeChip === "Admin"
        ? role === "ADMIN"
        : activeChip === "Staff"
          ? role === "STAFF"
          : activeChip === "Coach"
            ? role === "COACH"
            : activeChip === "Member"
              ? role === "USER"
              : true);

    return !member.deletedAt && matchesSearch && matchesChip && matchesStatus;
  });
}