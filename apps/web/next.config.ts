import type { NextConfig } from "next";
import path from "path";

const apiInternalOrigin =
  process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, "") ??
  "http://api.railway.internal:3001";

const nextConfig: NextConfig = {
  distDir: ".next-runtime",
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
    workerThreads: true
  },
  transpilePackages: [
    "@fittrack/types",
    "@fittrack/validators",
    "@fittrack/utils",
    "@fittrack/ui",
    "@fittrack/query"
  ],
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: `${apiInternalOrigin}/v1/:path*`
      }
    ];
  },
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname, "../..")
  }
};

export default nextConfig;
