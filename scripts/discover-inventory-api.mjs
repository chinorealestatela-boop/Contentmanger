#!/usr/bin/env node
// Run this LOCALLY (or on any machine with normal, unrestricted internet
// access) — it will NOT work from a sandboxed CI/build environment that
// blocks outbound connections to arbitrary domains.
//
// What it does:
//   1. Opens https://www.automaxlv.com/inventory/ and one vehicle detail
//      page (VDP) in a real, visible network path using Playwright's
//      bundled Chromium (already a devDependency of this repo).
//   2. Logs EVERY network request/response the page makes — highlighting
//      any that return JSON, since that's almost certainly the real data
//      source if this site loads inventory client-side.
//   3. Saves the fully-rendered HTML (after JS has run) for both pages to
//      ./debug/ so you can diff it against the DOM structure documented in
//      src/lib/inventory/automaxlv.ts (the "dws-vehicle-fields-item"
//      blocks, VDP link pattern, etc.) and confirm or correct those notes.
//
// Usage:
//   npx playwright install chromium   # one-time, if not already installed
//   node scripts/discover-inventory-api.mjs
//
// That's everything needed to wire automaxlv.ts up to a direct JSON call
// instead of rendering a full page per vehicle, if one exists.

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";

const INVENTORY_URL = "https://www.automaxlv.com/inventory/";
const SAMPLE_VDP_URL = "https://www.automaxlv.com/inventory/ford/f150-supercrew-cab/5041a/";
const OUT_DIR = new URL("../debug/", import.meta.url);
const JSON_BODY_PREVIEW_CHARS = 2000;

/** @param {import('playwright').Page} page */
function attachNetworkLogging(page, label) {
  const interesting = [];

  page.on("response", async (response) => {
    const request = response.request();
    const url = response.url();
    const method = request.method();
    const status = response.status();
    const contentType = response.headers()["content-type"] ?? "";

    console.log(`[${label}] ${method} ${status} ${contentType || "(no content-type)"} ${url}`);

    const looksInteresting =
      contentType.includes("json") ||
      /inventory|vehicle|dws|widget|api|inventor/i.test(url);

    if (!looksInteresting) return;

    let bodyPreview = null;
    try {
      if (contentType.includes("json")) {
        const text = await response.text();
        bodyPreview = text.slice(0, JSON_BODY_PREVIEW_CHARS);
      }
    } catch {
      // response body may not be readable (e.g. redirects, opaque
      // cross-origin responses) — that's fine, we still keep the metadata
    }

    interesting.push({ label, method, url, status, contentType, bodyPreview });
  });

  return interesting;
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });

  const allInteresting = [];

  try {
    const listingPage = await context.newPage();
    const listingHits = attachNetworkLogging(listingPage, "LISTING");
    console.log(`\n=== Loading ${INVENTORY_URL} ===\n`);
    await listingPage.goto(INVENTORY_URL, { waitUntil: "networkidle", timeout: 30000 }).catch((err) => {
      console.warn(`[LISTING] networkidle wait failed/timed out: ${err.message} — continuing anyway`);
    });
    await listingPage.waitForTimeout(3000);
    const listingHtml = await listingPage.content();
    await writeFile(new URL("listing-rendered.html", OUT_DIR), listingHtml, "utf8");
    allInteresting.push(...listingHits);
    await listingPage.close();

    const vdpPage = await context.newPage();
    const vdpHits = attachNetworkLogging(vdpPage, "VDP");
    console.log(`\n=== Loading ${SAMPLE_VDP_URL} ===\n`);
    await vdpPage.goto(SAMPLE_VDP_URL, { waitUntil: "networkidle", timeout: 30000 }).catch((err) => {
      console.warn(`[VDP] networkidle wait failed/timed out: ${err.message} — continuing anyway`);
    });
    await vdpPage.waitForTimeout(3000);
    const vdpHtml = await vdpPage.content();
    await writeFile(new URL("vdp-rendered.html", OUT_DIR), vdpHtml, "utf8");
    allInteresting.push(...vdpHits);
    await vdpPage.close();
  } finally {
    await browser.close();
  }

  await writeFile(new URL("interesting-requests.json", OUT_DIR), JSON.stringify(allInteresting, null, 2), "utf8");

  console.log(`\n=== Done ===`);
  console.log(`Rendered HTML saved to ./debug/listing-rendered.html and ./debug/vdp-rendered.html`);
  console.log(`Flagged requests saved to ./debug/interesting-requests.json`);

  if (allInteresting.length === 0) {
    console.log(`\nNo JSON/inventory-looking requests were flagged. Open ./debug/listing-rendered.html`);
    console.log(`and check by eye whether it now contains real vehicle cards.`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
