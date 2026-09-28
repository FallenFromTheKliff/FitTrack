import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// @ts-expect-error Node's focused TypeScript runner requires the explicit extension.
import createNextConfig from "./next.config.ts";
// @ts-expect-error Node's focused TypeScript runner requires the explicit extension.
import { buildSecurityHeaders } from "./security-headers.ts";

Object.assign(globalThis, {
  __dirname: path.dirname(fileURLToPath(import.meta.url)),
});

function headersByKey(headers: Array<{ key: string; value: string }>) {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
}

function cspDirectives(csp: string) {
  return Object.fromEntries(
    csp.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

test("production emits all six normalized security headers", () => {
  const headers = headersByKey(buildSecurityHeaders(false));

  assert.deepEqual(Object.keys(headers).sort(), [
    "Content-Security-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ].sort());
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000");
  assert.equal(headers["X-Frame-Options"], "SAMEORIGIN");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(
    headers["Referrer-Policy"],
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    headers["Permissions-Policy"],
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  );
});

test("production CSP keeps required web consumers without unsafe-eval", () => {
  const csp = headersByKey(buildSecurityHeaders(false))["Content-Security-Policy"];
  const directives = cspDirectives(csp);

  assert.doesNotMatch(csp, /\r|\n/);
  assert.doesNotMatch(csp, / {2,}/);
  assert.equal(directives["default-src"], "'self'");
  assert.equal(directives["base-uri"], "'self'");
  assert.equal(directives["form-action"], "'self'");
  assert.equal(directives["frame-ancestors"], "'self'");
  assert.equal(directives["object-src"], "'none'");
  assert.equal(
    directives["script-src"],
    "'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  );
  assert.equal(directives["style-src"], "'self' 'unsafe-inline'");
  assert.equal(directives["img-src"], "'self' data: blob: https:");
  assert.equal(directives["font-src"], "'self' data:");
  assert.equal(directives["connect-src"], "'self' https:");
  assert.equal(directives["media-src"], "'self' data: blob: https:");
  assert.equal(directives["worker-src"], "'self' blob:");
  assert.equal(directives["manifest-src"], "'self'");
  assert.equal(directives["upgrade-insecure-requests"], "");
  assert.equal(/(?:^|\s)'unsafe-eval'(?:$|\s)/.test(directives["script-src"]), false);
});

test("development keeps local API/HMR connections and unsafe-eval without HSTS upgrade", () => {
  const headers = headersByKey(buildSecurityHeaders(true));
  const directives = cspDirectives(headers["Content-Security-Policy"]);

  assert.equal(headers["Strict-Transport-Security"], undefined);
  assert.equal(directives["upgrade-insecure-requests"], undefined);
  assert.match(
    directives["script-src"],
    /'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'/,
  );
  assert.match(
    directives["connect-src"],
    /http:\/\/127\.0\.0\.1:3001/,
  );
  assert.match(directives["connect-src"], /ws:\/\/127\.0\.0\.1:3001/);
  assert.match(directives["connect-src"], /ws:\/\/localhost:8080/);
  assert.equal(
    directives["img-src"],
    "'self' data: blob: https: http://127.0.0.1:3001 http://localhost:3001",
  );
});

test("Next applies the policy once to every web path and disables powered by", async () => {
  const productionConfig = createNextConfig();
  const developmentConfig = createNextConfig(PHASE_DEVELOPMENT_SERVER);

  assert.equal(productionConfig.poweredByHeader, false);
  assert.deepEqual(await productionConfig.headers?.(), [
    { source: "/:path*", headers: buildSecurityHeaders(false) },
  ]);
  assert.deepEqual(await developmentConfig.headers?.(), [
    { source: "/:path*", headers: buildSecurityHeaders(true) },
  ]);
});
