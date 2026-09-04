import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The inventory-sync cron route renders automaxlv.com pages with a real
  // headless Chromium (see src/lib/inventory/automaxlv.ts) via
  // playwright-core + @sparticuz/chromium. Both ship native binaries that
  // Next's build should leave alone rather than trying to webpack-bundle.
  serverExternalPackages: ["playwright-core", "playwright", "@sparticuz/chromium"],

  // serverExternalPackages alone isn't enough on Vercel: its automatic file
  // tracer only bundles files it can find via a *static* require()/import,
  // but playwright-core reads some of its own files (e.g. browsers.json)
  // dynamically at module-init time, so they get silently left out of the
  // deployed function and it fails at runtime with something like
  // "Cannot find module '.../playwright-core/browsers.json'" — confirmed
  // happening in production. Force the tracer to include each package's
  // files wholesale instead of relying on it to detect what it needs.
  outputFileTracingIncludes: {
    "/api/cron/inventory-sync": ["./node_modules/playwright-core/**", "./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
