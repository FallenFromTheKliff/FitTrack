const PUBLIC_DEFAULT_APPEARANCE_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/member-login",
  "/locked",
  "/dev/auth-bridge",
]);

const PUBLIC_DEFAULT_APPEARANCE_PREFIXES = ["/payments/"];

export function shouldUseDefaultPublicAppearance(pathname: string) {
  const normalizedPath = pathname.split("?")[0] || "/";
  return (
    PUBLIC_DEFAULT_APPEARANCE_EXACT_PATHS.has(normalizedPath) ||
    PUBLIC_DEFAULT_APPEARANCE_PREFIXES.some((prefix) =>
      normalizedPath.startsWith(prefix),
    )
  );
}
