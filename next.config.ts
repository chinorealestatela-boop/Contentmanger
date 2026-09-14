import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles the demo SQLite database (built by scripts/build-demo-db.mjs,
  // only when no real Postgres DATABASE_URL/DIRECT_URL is configured — see
  // scripts/vercel-build.mjs) into every serverless function so a preview
  // deploy with no database attached still has something to run against.
  // No-op locally and in real production, where this file is never created.
  outputFileTracingIncludes: {
    "/*": ["./prisma/demo-seed.db"],
  },
};

export default nextConfig;
