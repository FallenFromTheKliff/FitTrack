import type { PageKey } from "@fittrack/app-config";
import type { Role } from "@fittrack/types";

export type WebPortalRole = Extract<Role, "ADMIN" | "STAFF">;

export const WEB_PORTAL_ALLOWED_ROLES = [
  "ADMIN",
  "STAFF",
] as const satisfies readonly WebPortalRole[];

export const WEB_ROLE_GATE = {
  allowedRoles: WEB_PORTAL_ALLOWED_ROLES,
  deniedMessage: "This account can't access the management portal.",
} as const;

export const WEB_PAGE_ALLOWED_ROLES: Record<PageKey, readonly WebPortalRole[]> =
  {
    dashboard: WEB_PORTAL_ALLOWED_ROLES,
    members: ["ADMIN", "STAFF"],
    schedule: WEB_PORTAL_ALLOWED_ROLES,
    "exercise-lab": WEB_PORTAL_ALLOWED_ROLES,
    gamification: ["ADMIN"],
    ai: ["ADMIN", "STAFF"],
    facilities: ["ADMIN"],
    inventory: ["ADMIN", "STAFF"],
    analytics: ["ADMIN"],
    settings: WEB_PORTAL_ALLOWED_ROLES,
    profile: WEB_PORTAL_ALLOWED_ROLES,
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
    default:
      return "Admin Portal";
  }
}
