const DEFAULT_API_BASE_URL = "http://localhost:3001/v1";

function normalizeApiBaseUrl(value: string) {
  const trimmedValue = value.replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmedValue);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      parsed.pathname = "/v1";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmedValue;
  }
}

export function resolveApiBaseUrl(
  baseURL?: string | null,
  fallbackBaseURL = DEFAULT_API_BASE_URL
) {
  const value = typeof baseURL === "string" && baseURL.trim() !== ""
    ? baseURL.trim()
    : fallbackBaseURL.trim();

  return normalizeApiBaseUrl(value);
}
