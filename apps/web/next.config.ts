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
  async redirects() {
    return [
      {
        source: "/members",
        destination: "/accounts",
        permanent: false
      },
      {
        source: "/members/:path*",
        destination: "/accounts/:path*",
        permanent: false
      },
      {
        source: "/admin",
        destination: "/analytics",
        permanent: false
      },
      {
        source: "/admin/dashboard",
        destination: "/analytics",
        permanent: false
      },
      {
        source: "/staff",
        destination: "/accounts",
        permanent: false
      },
      {
        source: "/staff/dashboard",
        destination: "/accounts",
        permanent: false
      },
      {
        source: "/member/home",
        destination: "/dashboard",
        permanent: false
      },
      {
        source: "/member/facilities",
        destination: "/facilities",
        permanent: false
      },
      {
        source: "/member/bookings",
        destination: "/bookings",
        permanent: false
      },
      {
        source: "/member/nutrition",
        destination: "/nutrition",
        permanent: false
      },
      {
        source: "/member/mastery",
        destination: "/mastery",
        permanent: false
      },
      {
        source: "/member/workout",
        destination: "/workout",
        permanent: false
      },
      {
        source: "/member/ai",
        destination: "/ai",
        permanent: false
      },
      {
        source: "/member/profile",
        destination: "/profile",
        permanent: false
      },
      {
        source: "/member/settings",
        destination: "/settings",
        permanent: false
      },
      {
        source: "/coach",
        destination: "/dashboard",
        permanent: false
      },
      {
        source: "/coach/dashboard",
        destination: "/dashboard",
        permanent: false
      },
      {
        source: "/coach/clients",
        destination: "/accounts",
        permanent: false
      },
      {
        source: "/coach/sessions",
        destination: "/schedule",
        permanent: false
      },
      {
        source: "/coach/schedule",
        destination: "/schedule",
        permanent: false
      },
      {
        source: "/coach/earnings",
        destination: "/analytics",
        permanent: false
      },
      {
        source: "/coach/gamification",
        destination: "/gamification",
        permanent: false
      },
      {
        source: "/coach/exercise-lab",
        destination: "/exercise-lab",
        permanent: false
      },
      {
        source: "/coach/ai",
        destination: "/ai",
        permanent: false
      },
      {
        source: "/coach/settings",
        destination: "/settings",
        permanent: false
      }
    ];
  },
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname, "../..")
  }
};

export default nextConfig;
