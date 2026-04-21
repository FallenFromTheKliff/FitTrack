import type { NextConfig } from "next";
import path from "path";

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
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname, "../..")
  }
};

export default nextConfig;
