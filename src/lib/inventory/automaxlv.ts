// Fetches and parses live inventory from https://www.automaxlv.com/ — the
// ONLY inventory source this app pulls from (see sync.ts / SOURCE-OF-TRUTH
// rule in the admin Inventory Sync page).
//
// ── Provenance / status as of 2026-09-04 ────────────────────────────────
// A previous version of this file's header claimed the markup below was
// "verified against the live site... in a real browser, inspecting the
// rendered DOM" — but the code that shipped used plain `fetch()`, which
// does NOT run JavaScript. That claim and that code were inconsistent with
// each other, and a follow-up investigation (also 2026-09-04, from a
// sandboxed environment with no direct network access to automaxlv.com)
// found real evidence the site needs JS to render vehicle data:
//   - Fetching https://www.automaxlv.com/inventory/ with no JS execution
//     returns a page whose vehicle-grid area contains the literal fallback
//     text "The vehicle you're trying to search could not be found!" —
//     not any vehicle cards or /inventory/{make}/{model}/{stock}/ links.
//   - Fetching a specific VDP (/inventory/ford/f150-supercrew-cab/5041a/)
//     the same way returns the SAME generic fallback text instead of any
//     dws-vehicle-fields-item block — consistent with a client-side widget
//     that ships a default "not found" state and swaps in real data via
//     JS after load, on both the listing and detail templates.
//   - robots.txt disallows a long list of AI/scraper user agents outright
//     and blocks crawling of the site's filtered-search query params —
//     worth knowing, though it doesn't by itself prove which of the above
//     is happening (client-side rendering vs. bot-detection serving a
//     decoy page to non-browser requests could both produce this result).
//   - No custom REST namespace shows up under /wp-json/ (just WP core,
//     Yoast, Slider Revolution) — ruling out a same-origin WordPress REST
//     endpoint as the data source.
// That sandboxed session could NOT execute JavaScript against the live
// site (direct egress was blocked, and its one working fetch tool strips
// <script> tags via markdown conversion before anything could inspect
// them), so it could not confirm the *real* rendered DOM structure or find
// the actual XHR/JSON endpoint the widget calls, if any. The markup notes
// below are therefore carried forward from the ORIGINAL (unverified) claim,
// unchanged — they may still be exactly right, since regexes this specific
// don't get written by guessing, but they have not actually been re-checked
// against a real render since that doubt was raised.
//
// THE FIX IN THIS FILE: rather than keep guessing, this version renders
// every page with a real headless Chromium (via renderPage() below) before
// reading its HTML, so the parsing logic runs against the same DOM a real
// browser would build — whatever that turns out to be. This has NOT been
// run against the live site from this sandbox either (same network
// restriction), so treat it as implemented-but-unverified until it's been
// run for real. See scripts/discover-inventory-api.mjs for a companion
// script — run it locally (real internet access required) to (a) confirm
// or correct the markup notes below by diffing the saved rendered HTML,
// and (b) check whether the widget actually calls a JSON API under the
// hood; if it does, that's a much cheaper and more reliable path than
// rendering a full page per vehicle, and this file should be switched to
// call it directly instead.
//
// Original findings this file's parsing logic is still based on:
//   - Platform vendor: DealerCenter. Vehicle photos are served from
//     imagescf.dealercenter.net, and every vehicle-data element on the page
//     uses "dws-" prefixed classes (DealerCenter's website widget system —
//     "dws-vehicle-fields-*", "dws-vdp-*", "dws-vehicle-slider", etc). The
//     rest of the page is a normal WordPress + WPBakery ("vc_*" classes)
//     theme; DealerCenter's plugin only owns the vehicle-specific widgets.
//   - No usable structured data: every VDP has a Yoast SEO
//     application/ld+json block, but it's the generic WebPage/BreadcrumbList
//     schema Yoast adds to *any* WordPress page — it has no @type Vehicle/
//     Car/Product node, and its breadcrumb entry is literally the
//     unpopulated template string "{{Year}} {{Make}} {{Model}}". There is
//     nothing to extract from JSON-LD on this site.
//   - VDP URL pattern: /inventory/{make-slug}/{model-slug}/
//     {stock-number-lowercase}/ — e.g. /inventory/ford/f150-supercrew-cab/
//     5041a/ and /inventory/land-rover/range-rover/5398a/. Make/model
//     slugs are plain kebab-case; the stock number segment is the real
//     stock number lowercased.
//   - Pagination is a query param, not infinite scroll: /inventory/
//     ?page_no=2, ?page_no=3, etc. The listing page's own pagination links
//     (text "page 1".."page N") tell you how many pages exist — no need to
//     guess or hardcode a page count.
//   - Sitemap exists (robots.txt → Sitemap: /sitemap_index.xml →
//     /inventory_usedcars-sitemap.xml) but was seen NOT complete (22 <loc>
//     entries vs. 75 vehicles reported across 5 listing pages). Treated as
//     a supplementary source only, never the primary one.
//   - Field markup on the VDP: each spec is
//         <div class="dws-vehicle-fields-item ...">
//           <div class="dws-vehicle-fields-wrap ...">
//             <span class="dws-vehicle-fields-icon dws-icons-feature-KEY"></span>
//             <span class="dws-vehicle-fields-label">Label</span>
//             <span class="dws-vehicle-fields-value">VALUE</span>
//           </div>
//         </div>
//     with KEY always one of: vin, mileage, stock-number, engine, trim,
//     transmission, drivetrain, exterior-color, mpg. No separate
//     body-style or interior-color field was seen — "trim" carries a
//     combined trim+body string (e.g. "GLA 250 SPORT UTILITY 4D"). The
//     code below still defensively looks for an interior-color/body-style
//     field in case some listings carry one.
//   - Price: <span class="dws-vdp-single-field-value dws-vdp-single-field-value-vehicleprice">$23,494 *</span>
//   - Equipment list: a heading with id="VEHICLE-EQUIPMENT" (a WPBakery
//     accordion/tabs panel, class vc_tta-panel) whose .vc_tta-panel-body
//     contains <li class="dws-vehicle-detail-equipment-vertical-element">
//     <span>FEATURE NAME</span></li>.
//   - Description: a matching id="VEHICLE-DESCRIPTION" panel, often empty
//     on this dealer's listings.
//   - Photos: <img> tags inside the .dws-vehicle-slider gallery, src like
//     https://imagescf.dealercenter.net/320/240/{id}.jpg — the CDN accepts
//     arbitrary width/height path segments, so a larger size than the
//     page's own thumbnail is requested for anything a customer will
//     actually look at.
//
// No HTML-parsing library is used here on purpose — this repo has no DOM
// parser dependency (no cheerio/jsdom) and installing one couldn't be
// verified from the sandbox this was written in (npm installs against this
// repo's full dependency tree hit blocked egress trying to fetch Prisma's
// engine binaries). Every DealerCenter element this file reads is a small,
// flat, non-nested block, so bounded, narrowly-scoped regexes are used
// against page.content() instead. If that ever changes — or if you're
// reading this after successfully adding cheerio — swapping the extraction
// helpers below for real DOM queries (against the already-rendered HTML)
// would be strictly more robust; nothing else in this file would need to
// change.
//
// The next human to touch this after a real sync run:
//   - Vehicles show up correctly → done, no further work.
//   - Zero vehicles / a FAILED run / a lot of "unparsed" entries → run
//     scripts/discover-inventory-api.mjs locally, diff the saved rendered
//     HTML against the markup notes above, and adjust the
//     regexes/selectors accordingly. Every extraction attempt is defensive
//     (falls through to "unparsed" rather than throwing or inventing data)
//     specifically so this is a quick, contained fix rather than a rewrite.
//   - If discover-inventory-api.mjs finds a real JSON endpoint → prefer
//     that over rendering pages. Replace renderPage()'s callers with a
//     direct fetch() to that endpoint; the ScrapedVehicle-shaping logic
//     below can mostly stay, just fed from parsed JSON instead of regexes
//     over HTML.

import type { Browser, BrowserContext, Page } from "playwright-core";
import type { ScrapedVehicle, InventoryFetchResult } from "./types";

const BASE_URL = "https://www.automaxlv.com";
const INVENTORY_URL = `${BASE_URL}/inventory/`;
const SITEMAP_URL = `${BASE_URL}/inventory_usedcars-sitemap.xml`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 AutoMaxLV-CRM-InventorySync/1.0 (+internal dealership tool)";
const FETCH_TIMEOUT_MS = 20000;
const PAGE_NAV_TIMEOUT_MS = 30000;
// How many VDPs to render at once. Rendering ~75+ pages one at a time would
// comfortably blow past Vercel's function duration limits; this trades
// memory/CPU for wall-clock time. Not load-tested against the live site or
// against real Vercel resource limits — tune down if the function runs out
// of memory, tune up if there's duration budget to spare.
const RENDER_CONCURRENCY = 4;
// Set INVENTORY_SYNC_DEBUG_LOG_REQUESTS=1 to have every rendered page log
// any JSON network response it sees to the console during a real sync run.
// This is a passive way to surface the widget's real data endpoint (if it
// has one) from production traffic, without needing separate DevTools
// access. Off by default so normal runs don't spam logs.
const DEBUG_LOG_REQUESTS = process.env.INVENTORY_SYNC_DEBUG_LOG_REQUESTS === "1";

// The DealerCenter photo CDN accepts a width/height in the path and returns
// a correctly-scaled (not cropped/distorted) image at that size. Request
// something big enough to actually look at instead of the listing
// thumbnail size.
const PHOTO_WIDTH = 1024;
const PHOTO_HEIGHT = 768;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Headless browser layer ──────────────────────────────────────────────
// The site's vehicle data does not appear in plain fetch() HTML (see file
// header) — every page is rendered with a real headless Chromium instead,
// via playwright-core. Two different ways of getting a Chromium binary
// depending on where this runs:
//   - On Vercel (or any AWS-Lambda-shaped serverless runtime): the regular
//     `playwright` npm package's bundled browser download does not survive
//     a serverless deploy (the browsers directory isn't part of the
//     function bundle). @sparticuz/chromium ships a Lambda-compatible
//     Chromium build for exactly this case.
//   - Locally (dev, or scripts/discover-inventory-api.mjs): the full
//     `playwright` package's bundled/downloaded browser is used instead,
//     since it's already a devDependency and needs no extra setup beyond
//     the one-time `npx playwright install chromium`.
// NOT verified end-to-end against a real Vercel deploy from this sandbox
// (no network access to test with) — see the comment block at the top of
// this file. If this bundling approach doesn't work as shipped, the
// Next.js config most likely needs `serverExternalPackages` for
// "playwright-core" and "@sparticuz/chromium" (see next.config.ts) so the
// build doesn't try to webpack-bundle their native binaries.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    const [{ chromium }, sparticuzChromium] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium").then((m) => m.default ?? m),
    ]);
    const executablePath = await sparticuzChromium.executablePath();
    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath,
      headless: true,
    });
  }

  // Local/dev path: prefer the full `playwright` package's own bundled
  // browser (zero extra config beyond `playwright install`). Fall back to
  // playwright-core in case `playwright` isn't installed in whatever
  // environment this ends up running in.
  try {
    const { chromium } = await import("playwright");
    return (await chromium.launch({ headless: true })) as unknown as Browser;
  } catch {
    const { chromium } = await import("playwright-core");
    return chromium.launch({ headless: true });
  }
}

/** Navigate to `url` in a fresh page, wait for the DealerCenter widget to
 * either populate real vehicle data or settle into its "not found" state,
 * and return the rendered HTML. Defensive by design: a slow/broken page
 * still returns whatever HTML it has rather than throwing, so a single bad
 * page can't take down the whole sync (parseVehiclePage's own checks
 * already treat missing fields as "unparsed" rather than a hard failure). */
async function renderPage(context: BrowserContext, url: string): Promise<string> {
  const page: Page = await context.newPage();
  try {
    if (DEBUG_LOG_REQUESTS) {
      page.on("response", async (response) => {
        const contentType = response.headers()["content-type"] ?? "";
        if (!contentType.includes("json")) return;
        let preview = "";
        try {
          preview = (await response.text()).slice(0, 500);
        } catch {
          // unreadable body — still log the URL below
        }
        console.log(`[inventory-sync][json-response] ${response.status()} ${response.url()} :: ${preview}`);
      });
    }

    await page
      .goto(url, { waitUntil: "networkidle", timeout: PAGE_NAV_TIMEOUT_MS })
      .catch(() => {
        // networkidle can time out on pages with long-polling/analytics
        // connections that never go idle — the widget's own data call
        // has almost always already resolved by then, so fall through
        // and read whatever DOM exists rather than failing the page.
      });

    // Best-effort: wait a little longer for either a populated vehicle
    // field or the widget's own "not found" text to appear, so we're not
    // reading the pre-render placeholder DOM. Doesn't throw either way —
    // parseVehiclePage() decides what to do with whatever HTML results.
    await page
      .waitForSelector(".dws-vehicle-fields-value, .dws-vehicle-fields-item", { timeout: 8000 })
      .catch(() => undefined);

    return await page.content();
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Runs `fn` over `items` with at most `limit` in flight at once. No extra
 * dependency for this — the concurrency need here is simple (bound how
 * many Chromium pages/tabs are open at a time). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Small string helpers (no DOM parser available — see file header) ────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function asNumber(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** One of the DealerCenter "dws-vehicle-fields-item" spec values, keyed by
 * its icon class suffix (dws-icons-feature-KEY). Bounded lookahead — these
 * blocks are small and flat (per the markup notes above), so this doesn't
 * risk matching across unrelated parts of the page. */
function dcFieldValue(html: string, key: string): string | null {
  const re = new RegExp(`dws-icons-feature-${key}\\b[\\s\\S]{0,400}?dws-vehicle-fields-value["'][^>]*>([\\s\\S]*?)</span>`, "i");
  const m = html.match(re);
  return cleanText(m?.[1]);
}

/** Body-style words that sometimes ride along inside the DealerCenter
 * "trim" field (e.g. "GLA 250 SPORT UTILITY 4D") since this site has no
 * separate body-style field. Best-effort only — pulls out a phrase that's
 * already in the data rather than inventing one. */
const BODY_STYLE_PATTERN = /\b(SPORT UTILITY(?: \d?D)?|SEDAN(?: \d?D)?|COUPE(?: \d?D)?|CONVERTIBLE|HATCHBACK|WAGON|PICKUP(?: \d?D)?|MINIVAN|VAN|CREW CAB|EXTENDED CAB|DOUBLE CAB|QUAD CAB|SUPERCREW|SUPERCAB|SUV)\b/i;

function guessBodyStyle(trim: string | null): string | null {
  if (!trim) return null;
  const m = trim.match(BODY_STYLE_PATTERN);
  return m ? m[0].toUpperCase() : null;
}

const MAKE_OVERRIDES: Record<string, string> = {
  bmw: "BMW",
  gmc: "GMC",
  ram: "RAM",
  "mercedes-benz": "Mercedes-Benz",
};

// A few model slugs whose correct real-world casing generic title-casing
// gets wrong (acronyms, hyphenated trim families). Not exhaustive — this
// only affects display casing, never VIN/stock-number based dedupe, so an
// unlisted case just looks slightly off rather than breaking anything.
const MODEL_OVERRIDES: Record<string, string> = {
  gla: "GLA",
  glc: "GLC",
  gle: "GLE",
  is: "IS",
  es: "ES",
  rx: "RX",
  cx: "CX",
  "c-class": "C-Class",
  "e-class": "E-Class",
  "s-class": "S-Class",
};

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function slugToMake(slug: string): string {
  return MAKE_OVERRIDES[slug.toLowerCase()] ?? slugToTitle(slug);
}

function slugToModel(slug: string): string {
  return MODEL_OVERRIDES[slug.toLowerCase()] ?? slugToTitle(slug);
}

// ── Per-VDP parsing (regex-based — see file header for why) ─────────────

function parseVehiclePage(html: string, pageUrl: string): ScrapedVehicle | { unparsed: string } {
  const urlMatch = pageUrl.match(/\/inventory\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9]+)\/?/i);
  if (!urlMatch) return { unparsed: "page URL doesn't match the expected /inventory/{make}/{model}/{stock}/ pattern" };
  const [, makeSlug, modelSlug] = urlMatch;

  const h1Match = html.match(/<h1[^>]*class="[^"]*\bvehicle-title\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  const titleText = cleanText(h1Match?.[1]);
  const yearMatch = titleText?.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  const vin = dcFieldValue(html, "vin");
  const stockNumber = dcFieldValue(html, "stock-number");
  const mileage = asNumber(dcFieldValue(html, "mileage"));
  const engine = dcFieldValue(html, "engine");
  const trim = dcFieldValue(html, "trim");
  const transmission = dcFieldValue(html, "transmission");
  const drivetrain = dcFieldValue(html, "drivetrain");
  const exteriorColor = dcFieldValue(html, "exterior-color");
  // Not seen populated on any sampled vehicle (this site's spec grid didn't
  // have one), but DealerCenter's widget supports it — check defensively.
  const interiorColor = dcFieldValue(html, "interior-color");

  const priceMatch = html.match(/dws-vdp-single-field-value-vehicleprice["'][^>]*>([\s\S]*?)<\/span>/i);
  const price = asNumber(cleanText(priceMatch?.[1]));

  if (!vin && !stockNumber) return { unparsed: "no VIN and no stock number found in the dws-vehicle-fields spec grid" };
  if (!year) return { unparsed: `couldn't find a 4-digit year in the page's <h1> ("${titleText ?? "no h1 found"}")` };

  // Sold-vehicle safety net — NOT verified against a real sold listing (none
  // was sampled when this file was written), so this is intentionally a
  // defensive fallback rather than the primary signal. DealerCenter/WordPress
  // sites commonly overlay a "SOLD" ribbon/badge on a vehicle they haven't
  // pulled from the site yet rather than removing the page outright, so a
  // vehicle that's simply still reachable at its URL is not proof it's still
  // for sale. Scoped to a window right around the title/price (not the whole
  // page) to avoid false-positives from unrelated content elsewhere on the
  // page (e.g. a "recently sold" testimonials widget). If a real sold
  // listing is ever sampled and this heuristic turns out wrong (misses it,
  // or false-positives on something else), replace it with the actual badge
  // markup/class instead of adjusting the keyword list.
  const titleAnchor = h1Match?.index ?? 0;
  const priceAnchor = priceMatch?.index ?? titleAnchor;
  const soldCheckWindow = html.slice(titleAnchor, Math.max(priceAnchor, titleAnchor) + 1500);
  const SOLD_PATTERN = /\b(sold|sale\s*pending|no longer available|vehicle\s*unavailable)\b/i;
  if (SOLD_PATTERN.test(stripTags(soldCheckWindow))) {
    return { unparsed: `listing near the title/price appears to say "sold" or similar — excluded rather than synced as available. If this is a false positive, tighten SOLD_PATTERN in automaxlv.ts; if it's a real sold badge, replace the heuristic with its actual markup.` };
  }

  const make = slugToMake(makeSlug);
  const model = slugToModel(modelSlug);

  // Equipment list: <li class="dws-vehicle-detail-equipment-vertical-element"><span>NAME</span></li>
  const features = Array.from(html.matchAll(/dws-vehicle-detail-equipment-vertical-element["'][^>]*>\s*<span>([\s\S]*?)<\/span>/gi))
    .map((m) => cleanText(m[1]))
    .filter((x): x is string => !!x);

  // Description: the id="VEHICLE-DESCRIPTION" accordion panel's body. Often
  // empty on this dealer's listings — that's a real absence, not a parse
  // failure, so it just yields null rather than an "unparsed" entry.
  let description: string | null = null;
  const descAnchor = html.indexOf('id="VEHICLE-DESCRIPTION"');
  if (descAnchor !== -1) {
    const bodyStart = html.indexOf("vc_tta-panel-body", descAnchor);
    if (bodyStart !== -1) {
      const contentStart = html.indexOf(">", bodyStart) + 1;
      const nextPanel = html.indexOf("vc_tta-panel", contentStart);
      const contentEnd = nextPanel !== -1 ? nextPanel : Math.min(html.length, contentStart + 5000);
      description = cleanText(html.slice(contentStart, contentEnd));
    }
  }

  // Photos: DealerCenter CDN images anywhere on the page, re-requested at a
  // larger size than the page's own thumbnail (see PHOTO_WIDTH/HEIGHT).
  const photoIds = Array.from(html.matchAll(/imagescf\.dealercenter\.net\/\d+\/\d+\/([a-z0-9-]+\.jpe?g)/gi)).map((m) => m[1]);
  const photos = Array.from(new Set(photoIds)).map((id) => `https://imagescf.dealercenter.net/${PHOTO_WIDTH}/${PHOTO_HEIGHT}/${id}`);

  return {
    vin,
    stockNumber,
    externalId: null,
    year,
    make,
    model,
    trim,
    price,
    mileage,
    exteriorColor,
    interiorColor,
    engine,
    transmission,
    drivetrain,
    bodyStyle: guessBodyStyle(trim),
    features,
    description,
    photos,
    url: pageUrl,
  };
}

// ── Discovery: find every vehicle detail page URL ──────────────────────

/** VDP links look like href="/inventory/{make}/{model}/{stock}/" — always
 * exactly three path segments under /inventory/. This also matches on the
 * listing page's own cards, so no separate "list vs detail" distinction is
 * needed. */
function extractVdpLinks(html: string): string[] {
  // Accepts both a relative href ("/inventory/...") and an absolute one
  // (whatever domain — WordPress themes emit either depending on the
  // template) as long as the path itself matches the confirmed
  // /inventory/{make}/{model}/{stock}/ shape.
  const matches = html.matchAll(/href=["'](?:https?:\/\/[^"'/]+)?(\/inventory\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+)\/?["']/gi);
  return Array.from(matches, (m) => new URL(m[1], BASE_URL).toString().replace(/\/?$/, "/"));
}

// Always-on, low-volume diagnostic logging (a handful of lines per sync
// run, not per-vehicle) — separate from the opt-in DEBUG_LOG_REQUESTS
// network dump above. This is what actually lets a "zero vehicles found"
// failure be root-caused from Vercel's runtime logs after the fact,
// without needing to reproduce it locally (this repo has been developed
// from a sandbox with no direct network access to automaxlv.com — see the
// file header — so production logs are the only real diagnostic channel
// available).
function logDiag(msg: string) {
  console.log(`[inventory-sync][diag] ${msg}`);
}

async function discoverVehicleUrls(context: BrowserContext): Promise<string[]> {
  const urls = new Set<string>();

  // Primary source: the listing pages themselves, rendered (see file
  // header — the vehicle grid is empty in plain-fetch HTML). Pagination is
  // the query param ?page_no=N, and the listing page's own "page 1".."page
  // N" links tell us how many pages actually exist instead of guessing.
  try {
    const firstPageHtml = await renderPage(context, INVENTORY_URL);
    const firstPageLinks = extractVdpLinks(firstPageHtml);
    for (const url of firstPageLinks) urls.add(url);

    const pageNumbers = Array.from(firstPageHtml.matchAll(/[?&]page_no=(\d+)["']/gi)).map((m) => Number(m[1]));
    const lastPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;

    logDiag(
      `listing page 1: fetched ${firstPageHtml.length} chars of HTML, found ${firstPageLinks.length} VDP link(s), ` +
        `${pageNumbers.length} page_no reference(s) (last page inferred: ${lastPage}). ` +
        `Contains "dws-": ${firstPageHtml.includes("dws-")}. Contains "could not be found": ${firstPageHtml.toLowerCase().includes("could not be found")}. ` +
        `First 600 chars after <body>: ${(firstPageHtml.match(/<body[^>]*>([\s\S]*)/i)?.[1] ?? firstPageHtml).slice(0, 600).replace(/\s+/g, " ")}`
    );

    const remainingPages = Array.from({ length: Math.max(0, lastPage - 1) }, (_, i) => i + 2);
    const htmls = await mapWithConcurrency(remainingPages, RENDER_CONCURRENCY, async (page) => {
      try {
        return await renderPage(context, `${INVENTORY_URL}?page_no=${page}`);
      } catch {
        return null; // one page failing shouldn't blow up discovery of the rest
      }
    });
    for (const html of htmls) {
      if (!html) continue;
      for (const url of extractVdpLinks(html)) urls.add(url);
    }
  } catch (err) {
    logDiag(`listing page discovery threw: ${err instanceof Error ? err.message : String(err)}`);
    // fall through to the sitemap below
  }

  // Supplementary source: the Yoast sitemap (plain XML, not JS-rendered —
  // a normal fetch() is fine here). NOT relied on alone — previously seen
  // incomplete (22 entries vs. 75 actual vehicles) — but cheap to also
  // check in case it catches something pagination missed.
  try {
    const xml = await fetchText(SITEMAP_URL);
    const before = urls.size;
    for (const m of xml.matchAll(/<loc>(https?:\/\/[^<]*\/inventory\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9]+\/?)<\/loc>/gi)) {
      urls.add(m[1].replace(/\/?$/, "/"));
    }
    logDiag(`sitemap: fetched ${xml.length} chars, added ${urls.size - before} new URL(s) (total <loc> tags: ${(xml.match(/<loc>/g) ?? []).length}).`);
  } catch (err) {
    logDiag(`sitemap fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    // sitemap missing/unreachable isn't fatal — pagination above is primary
  }

  logDiag(`discoverVehicleUrls finished with ${urls.size} total URL(s).`);
  return Array.from(urls);
}

// ── Public entry point ──────────────────────────────────────────────────

export async function fetchAutoMaxInventory(): Promise<InventoryFetchResult> {
  const vehicles: ScrapedVehicle[] = [];
  const unparsed: { url: string; reason: string }[] = [];

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    try {
      const vdpUrls = await discoverVehicleUrls(context);
      if (vdpUrls.length === 0) {
        throw new Error(
          "Found zero vehicle detail pages on automaxlv.com (rendered listing pagination and the sitemap both came back empty). The site's markup/rendering likely differs from what this parser assumes — see the comment at the top of automaxlv.ts, and run scripts/discover-inventory-api.mjs locally to re-diagnose."
        );
      }

      await mapWithConcurrency(vdpUrls, RENDER_CONCURRENCY, async (url) => {
        let html: string;
        try {
          html = await renderPage(context, url);
        } catch (err) {
          unparsed.push({ url, reason: err instanceof Error ? err.message : "render failed" });
          return;
        }

        const result = parseVehiclePage(html, url);
        if ("unparsed" in result) {
          unparsed.push({ url, reason: result.unparsed });
        } else {
          vehicles.push(result);
        }
      });
    } finally {
      await context.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  return { vehicles, unparsed };
}
