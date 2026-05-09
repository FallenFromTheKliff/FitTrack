import type { PageKey } from "@fittrack/app-config";
import type { Role } from "@fittrack/types";

export type WebPortalRole = Extract<Role, "ADMIN" | "STAFF" | "USER" | "COACH">;

export const WEB_PORTAL_ALLOWED_ROLES = [
  "ADMIN",
  "STAFF",
  "USER",
  "COACH",
] as const satisfies readonly WebPortalRole[];

const WEB_MANAGEMENT_ROLES = ["ADMIN", "STAFF"] as const satisfies readonly WebPortalRole[];

export const WEB_ROLE_GATE = {
  allowedRoles: WEB_PORTAL_ALLOWED_ROLES,
  deniedMessage: "This account can't access the FitTrack portal.",
} as const;

export const WEB_PAGE_ALLOWED_ROLES: Record<PageKey, readonly WebPortalRole[]> =
  {
    dashboard: WEB_MANAGEMENT_ROLES,
    members: ["ADMIN", "STAFF"],
    schedule: WEB_MANAGEMENT_ROLES,
    "exercise-lab": WEB_MANAGEMENT_ROLES,
    gamification: ["ADMIN"],
    "gym-actions": WEB_MANAGEMENT_ROLES,
    "memberships-promos": WEB_MANAGEMENT_ROLES,
    ai: ["ADMIN"],
    facilities: ["ADMIN"],
    inventory: ["ADMIN", "STAFF"],
    analytics: ["ADMIN"],
    settings: WEB_MANAGEMENT_ROLES,
    profile: ["ADMIN", "STAFF", "COACH"],
    "member-home": ["USER"],
    "member-facilities": ["USER"],
    "member-bookings": ["USER"],
    "member-nutrition": ["USER"],
    "member-mastery": ["USER"],
    "member-ai": ["USER"],
    "member-profile": ["USER"],
    "member-settings": ["USER"],
  };

export function isWebPortalRole(
  role: Role | null | undefined,
): role is WebPortalRole {
  return !!role && WEB_PORTAL_ALLOWED_ROLES.includes(role as WebPortalRole);
}

export function canAccessWebPage(
  role: Role | null | undefined,
  pageKey: PageKey,
) {
  return (
    isWebPortalRole(role) && WEB_PAGE_ALLOWED_ROLES[pageKey].includes(role)
  );
}

export function getWebPortalLabel(role: Role | null | undefined) {
  switch (role) {
    case "STAFF":
      return "Staff Portal";
    case "USER":
      return "Member Portal";
    case "COACH":
      return "Coach Portal";
    default:
      return "Admin Portal";
  }
}

export function getWebPortalFallbackPath(role: Role | null | undefined) {
  switch (role) {
    case "ADMIN":
      return "/analytics";
    case "STAFF":
      return "/members";
    case "USER":
      return "/member/home";
    case "COACH":
      return "/profile";
    default:
      return "/login";
  }
}
