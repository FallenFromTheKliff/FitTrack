export function resolveApiBaseUrl(baseURL?: string | null, fallbackBaseURL = "http://localhost:3001") {
  const value = typeof baseURL === "string" && baseURL.trim() !== ""
    ? baseURL.trim()
    : fallbackBaseURL.trim();
  return value.replace(/\/+$/, "");
}
