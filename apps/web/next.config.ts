import type { NextConfig } from "next"

const apiUrl = process.env.API_URL ?? "http://localhost:3001"

const nextConfig: NextConfig = {
  // e2e builds into its own directory so it can run beside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@workspace/ui"],
  // The browser only ever talks to this origin, so the session cookie is
  // first-party and no CORS or cookie-domain setup is needed. Better Auth
  // keeps its own /api/auth prefix; every other API route is mounted at the
  // API root.
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${apiUrl}/api/auth/:path*` },
      { source: "/api/:path*", destination: `${apiUrl}/:path*` },
    ]
  },
}

export default nextConfig
