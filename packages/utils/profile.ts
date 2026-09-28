import type { MemberRecord } from "@fittrack/types";

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
  if (member.role?.name && member.role.name !== "USER") return "Not Applicable";

  switch (member.profile?.membershipType?.trim().toLowerCase()) {
    case "premium":
      return "Premium";
    case "vip":
      return "VIP";
    case "member":
    default:
      return "Member";
  }
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeApiAssetBaseUrl(apiBaseUrl?: string | null) {
  const trimmedValue = apiBaseUrl?.trim();
  if (!trimmedValue) return null;
  return trimmedValue.replace(/\/+$/, "");
}

function normalizeAssetPathValue(value: string) {
  return value
    .split(/[?#]/)[0]
    .replace(/^\/+/, "");
}

function isPlaceholderAssetUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      parsed.hostname === "fittrack.dev" ||
      parsed.hostname === "fittrack.local" ||
      parsed.hostname.endsWith(".fittrack.local")
    );
  } catch {
    return false;
  }
}

function extractApiRenderObjectKey(assetUrl: string) {
  const isAbsoluteHttpUrl = /^https?:\/\//i.test(assetUrl);
  const isRelativeAssetUrl =
    assetUrl.startsWith("/") && !assetUrl.startsWith("//");
  if (!isAbsoluteHttpUrl && !isRelativeAssetUrl) return null;

  let parsed: URL;
  try {
    parsed = isAbsoluteHttpUrl
      ? new URL(assetUrl)
      : new URL(assetUrl, "http://fittrack.local");
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const normalizedPath = normalizeAssetPathValue(parsed.pathname);
  if (
    normalizedPath !== "files/render" &&
    !normalizedPath.endsWith("/files/render")
  ) {
    return null;
  }

  const key = parsed.searchParams.get("key");
  return key?.trim() || null;
}

export function extractStorageObjectKey(
  assetUrl?: string | null,
  publicBaseUrl?: string | null
) {
  const trimmedUrl = assetUrl?.trim();
  if (!trimmedUrl || trimmedUrl.startsWith("blob:") || trimmedUrl.startsWith("data:")) {
    return null;
  }

  const apiRenderObjectKey = extractApiRenderObjectKey(trimmedUrl);
  if (apiRenderObjectKey) {
    return apiRenderObjectKey;
  }

  const trimmedPublicBaseUrl = publicBaseUrl?.trim()?.replace(/\/+$/, "");
  if (trimmedPublicBaseUrl && trimmedUrl.startsWith(`${trimmedPublicBaseUrl}/`)) {
    return safeDecodeUriComponent(
      normalizeAssetPathValue(trimmedUrl.slice(trimmedPublicBaseUrl.length + 1))
    );
  }

  try {
    const parsed = new URL(trimmedUrl);
    const normalizedPath = normalizeAssetPathValue(parsed.pathname);
    if (!normalizedPath) return null;

    if (parsed.hostname.endsWith(".r2.dev")) {
      return safeDecodeUriComponent(normalizedPath);
    }

    if (parsed.hostname.endsWith(".r2.cloudflarestorage.com")) {
      const [, ...keyParts] = normalizedPath.split("/");
      const key = keyParts.join("/");
      return key ? safeDecodeUriComponent(key) : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildRenderableAssetUrl({
  apiBaseUrl,
  assetKey,
  assetUrl,
  publicBaseUrl
}: {
  apiBaseUrl?: string | null;
  assetKey?: string | null;
  assetUrl?: string | null;
  publicBaseUrl?: string | null;
}) {
  const trimmedAssetUrl = assetUrl?.trim() ?? null;
  if (trimmedAssetUrl?.startsWith("blob:") || trimmedAssetUrl?.startsWith("data:")) {
    return trimmedAssetUrl;
  }

  if (trimmedAssetUrl && isPlaceholderAssetUrl(trimmedAssetUrl)) {
    return null;
  }

  const normalizedApiBaseUrl = normalizeApiAssetBaseUrl(apiBaseUrl);
  const normalizedAssetKey =
    assetKey?.trim().replace(/^\/+/, "") ||
    extractStorageObjectKey(trimmedAssetUrl, publicBaseUrl);

  if (!normalizedAssetKey || !normalizedApiBaseUrl) {
    return trimmedAssetUrl;
  }

  return `${normalizedApiBaseUrl}/files/render?key=${encodeURIComponent(normalizedAssetKey)}`;
}
