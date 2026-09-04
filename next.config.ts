import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The inventory-sync cron route renders automaxlv.com pages with a real
  // headless Chromium (see src/lib/inventory/automaxlv.ts) via
  // playwright-core + @sparticuz/chromium. Both ship native binaries that
  // Next's build should leave alone rather than trying to webpack-bundle —
  // NOT verified against a real Vercel deploy from the sandbox this was
  // written in (no network access to test with). If the cron function
  // fails to find/launch Chromium in production, this is the first thing
  // to check.
  serverExternalPackages: ["playwright-core", "playwright", "@sparticuz/chromium"],
};

export default nextConfig;
