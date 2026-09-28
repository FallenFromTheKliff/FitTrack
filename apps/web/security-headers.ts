type SecurityHeader = {
  key: string;
  value: string;
};

const DEVELOPMENT_API_HTTP_SOURCES = [
  "http://127.0.0.1:3001",
  "http://localhost:3001",
] as const;

const DEVELOPMENT_CONNECT_SOURCES = [
  ...DEVELOPMENT_API_HTTP_SOURCES,
  "ws://127.0.0.1:3001",
  "ws://localhost:3001",
  "ws://127.0.0.1:8080",
  "ws://localhost:8080",
] as const;

function normalizeCsp(directives: readonly string[]) {
  return directives
    .map((directive) => directive.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("; ");
}

function buildContentSecurityPolicy(isDevelopmentServer: boolean) {
  const developmentConnectSources = isDevelopmentServer
    ? ` ${DEVELOPMENT_CONNECT_SOURCES.join(" ")}`
    : "";
  const developmentImageSources = isDevelopmentServer
    ? ` ${DEVELOPMENT_API_HTTP_SOURCES.join(" ")}`
    : "";

  return normalizeCsp([
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${
      isDevelopmentServer ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${developmentImageSources}`,
    "font-src 'self' data:",
    `connect-src 'self' https:${developmentConnectSources}`,
    "media-src 'self' data: blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopmentServer ? [] : ["upgrade-insecure-requests"]),
  ]);
}

export function buildSecurityHeaders(
  isDevelopmentServer: boolean,
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(isDevelopmentServer),
    },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
  ];

  if (!isDevelopmentServer) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
  }

  return headers;
}
