// Fetches and parses live inventory from https://www.automaxlv.com/ — the
// ONLY inventory source this app pulls from (see sync.ts / SOURCE-OF-TRUTH
// rule in the admin Inventory Sync page).
//
// VERIFIED against the live site on 2026-09-04 (loaded the listing page and
// three vehicle detail pages in a real browser and inspected the rendered
// DOM). Key findings, so the next person touching this doesn't have to
// re-derive them:
//
//   - Platform vendor: DealerCenter. Vehicle photos are served from
//     imagescf.dealercenter.net, and every vehicle-data element on the page
//     uses "dws-" prefixed classes (DealerCenter's website widget system —
//     "dws-vehicle-fields-*", "dws-vdp-*", "dws-vehicle-slider", etc). The
//     rest of the page is a normal WordPress + WPBakery ("vc_*" classes)
//     theme; DealerCenter's plugin only owns the vehicle-specific widgets.
//     No official feed/API was found or asked for here — this is HTML
//     scraping of DealerCenter's rendered markup, not a data feed.
//   - No usable structured data: every VDP has a Yoast SEO
//     application/ld+json block, but it's the generic WebPage/BreadcrumbList
//     schema Yoast adds to *any* WordPress page — it has no @type Vehicle/
//     Car/Product node, and its breadcrumb entry is literally the
//     unpopulated template string "{{Year}} {{Make}} {{Model}}". There is
//     nothing to extract from JSON-LD on this site.
//   - VDP URL pattern confirmed: /inventory/{make-slug}/{model-slug}/
//     {stock-number-lowercase}/ — e.g. /inventory/ford/f150-supercrew-cab/
//     5041a/ (the example given when this was scoped) and
//     /inventory/land-rover/range-rover/5398a/ (seen live). Make/model
//     slugs are plain kebab-case; the stock number segment is the real
//     stock number lowercased.
//   - Pagination is a query param, not infinite scroll: /inventory/
//     ?page_no=2, ?page_no=3, etc. The listing page's own pagination links
//     (text "page 1".."page N") tell you how many pages exist — no need to
//     guess or hardcode a page count.
//   - Sitemap exists (robots.txt → Sitemap: /sitemap_index.xml →
//     /inventory_usedcars-sitemap.xml) but is NOT a complete VDP list: it
//     had 22 <loc> entries the day this was checked while the listing page
//     reported 75 vehicles across 5 pages. Treat it as a supplementary
//     source, never the primary one — the listing pages are the reliable
//     way to discover every VDP.
//   - Field markup on the VDP (verified identical structure across a 1990
//     Toyota, a 2019 Land Rover, and a 2018 Mercedes-Benz): each spec is
//         <div class="dws-vehicle-fields-item ...">
//           <div class="dws-vehicle-fields-wrap ...">
//             <span class="dws-vehicle-fields-icon dws-icons-feature-KEY"></span>
//             <span class="dws-vehicle-fields-label">Label</span>
//             <span class="dws-vehicle-fields-value">VALUE</span>
//           </div>
//         </div>
//     with KEY always one of: vin, mileage, stock-number, engine, trim,
//     transmission, drivetrain, exterior-color, mpg. There is no separate
//     body-style or interior-color field in this grid on any sampled
//     vehicle — "trim" carries a combined trim+body string (e.g. "GLA 250
//     SPORT UTILITY 4D", "SUPERCHARGED SPORT UTILITY 4D"). The code below
//     still defensively looks for an interior-color/body-style field in
//     case some listings carry one DealerCenter supports but these samples
//     didn't have populated.
//   - Price: <span class="dws-vdp-single-field-value dws-vdp-single-field-value-vehicleprice">$23,494 *</span>
//   - Equipment list: a heading with id="VEHICLE-EQUIPMENT" (a WPBakery
//     accordion/tabs panel, class vc_tta-panel) whose .vc_tta-panel-body
//     contains <li class="dws-vehicle-detail-equipment-vertical-element">
//     <span>FEATURE NAME</span></li> — confirmed 36 items on one vehicle.
//   - Description: a matching id="VEHICLE-DESCRIPTION" panel. On all three
//     sampled vehicles its .vc_tta-panel-body was completely empty — this
//     dealer often just doesn't fill in a free-text description. The panel
//     and its markup exist for when a listing does have one.
//   - Photos: <img> tags inside the .dws-vehicle-slider gallery, src like
//     https://imagescf.dealercenter.net/320/240/{id}.jpg. Confirmed live
//     that the CDN honors arbitrary width/height path segments (requested
//     .../1024/768/{id}.jpg for a thumbnail whose default was 320x240 and
//     got back a correctly-scaled, non-cropped 1024x768 photo) — so we
//     request a larger size than the page's own thumbnail for anything a
//     customer will actually look at.
//
// No HTML-parsing library is used here on purpose — this repo has no DOM
// parser dependency (no cheerio/jsdom) and installing one couldn't be
// verified from the sandbox this was written in (npm installs against this
// repo's full dependency tree hit blocked egress trying to fetch Prisma's
// engine binaries). Every DealerCenter element this file reads is a small,
// flat, non-nested block (verified above), so bounded, narrowly-scoped
// regexes are safe and don't need real DOM parsing. If that ever changes —
// or if you're reading this after successfully adding cheerio — swapping
// the extraction helpers below for real DOM queries would be strictly more
// robust; nothing else in this file would need to change.
//
// The next human to touch this after a real sync run:
//   - Vehicles show up correctly → done, no further work.
//   - Zero vehicles / a FAILED run / a lot of "unparsed" entries → the
//     site's markup has changed since 2026-09-04. Open automaxlv.com/
//     inventory/ and one VDP in a browser, compare against the notes above,
//     and adjust the regexes/selectors accordingly. Every extraction
//     attempt is defensive (falls through to "unparsed" rather than
//     throwing or inventing data) specifically so this is a quick, contained
//     fix rather than a rewrite.

import type { ScrapedVehicle, InventoryFetchResult } from "./types";

const BASE_URL = "https://www.automaxlv.com";
const INVENTORY_URL = `${BASE_URL}/inventory/`;
const SITEMAP_URL = `${BASE_URL}/inventory_usedcars-sitemap.xml`;
const USER_AGENT = "AutoMaxLV-CRM-InventorySync/1.0 (+internal dealership tool; contact via automaxlv.com)";
const FETCH_TIMEOUT_MS = 20000;

// The DealerCenter photo CDN accepts a width/height in the path and returns
// a correctly-scaled (not cropped/distorted) image at that size — verified
// live against a thumbnail whose page-default was 320x240. Request
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
 * blocks are small and flat (verified against three live vehicles), so this
 * doesn't risk matching across unrelated parts of the page. */
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
  // /inventory/{make}/{model}/{stock}/ shape; not verified which form this
  // site actually uses, so match both rather than guess and risk silently
  // missing every link.
  const matches = html.matchAll(/href=["'](?:https?:\/\/[^"'/]+)?(\/inventory\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+)\/?["']/gi);
  return Array.from(matches, (m) => new URL(m[1], BASE_URL).toString().replace(/\/?$/, "/"));
}

async function discoverVehicleUrls(): Promise<string[]> {
  const urls = new Set<string>();

  // Primary source: the listing pages themselves. Verified complete (75
  // vehicles across 5 pages the day this was checked) — pagination is the
  // query param ?page_no=N, and the listing page's own "page 1".."page N"
  // links tell us how many pages actually exist instead of guessing.
  try {
    const firstPageHtml = await fetchText(INVENTORY_URL);
    for (const url of extractVdpLinks(firstPageHtml)) urls.add(url);

    const pageNumbers = Array.from(firstPageHtml.matchAll(/[?&]page_no=(\d+)["']/gi)).map((m) => Number(m[1]));
    const lastPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;

    for (let page = 2; page <= lastPage; page++) {
      try {
        const html = await fetchText(`${INVENTORY_URL}?page_no=${page}`);
        for (const url of extractVdpLinks(html)) urls.add(url);
      } catch {
        // one page failing shouldn't blow up discovery of the rest
      }
    }
  } catch {
    // fall through to the sitemap below
  }

  // Supplementary source: the Yoast sitemap. NOT relied on alone — verified
  // incomplete (22 entries vs. 75 actual vehicles) — but cheap to also
  // check in case it catches something pagination missed (or becomes the
  // more complete source if the site's markup changes).
  try {
    const xml = await fetchText(SITEMAP_URL);
    for (const m of xml.matchAll(/<loc>(https?:\/\/[^<]*\/inventory\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9]+\/?)<\/loc>/gi)) {
      urls.add(m[1].replace(/\/?$/, "/"));
    }
  } catch {
    // sitemap missing/unreachable isn't fatal — pagination above is primary
  }

  return Array.from(urls);
}

// ── Public entry point ──────────────────────────────────────────────────

export async function fetchAutoMaxInventory(): Promise<InventoryFetchResult> {
  const vehicles: ScrapedVehicle[] = [];
  const unparsed: { url: string; reason: string }[] = [];

  const vdpUrls = await discoverVehicleUrls();
  if (vdpUrls.length === 0) {
    throw new Error(
      "Found zero vehicle detail pages on automaxlv.com (listing pagination and the sitemap both came back empty). The site's markup likely differs from what this parser assumes — see the comment at the top of automaxlv.ts."
    );
  }

  for (const url of vdpUrls) {
    let html: string;
    try {
      html = await fetchText(url);
    } catch (err) {
      unparsed.push({ url, reason: err instanceof Error ? err.message : "fetch failed" });
      continue;
    }

    const result = parseVehiclePage(html, url);
    if ("unparsed" in result) {
      unparsed.push({ url, reason: result.unparsed });
    } else {
      vehicles.push(result);
    }
  }

  return { vehicles, unparsed };
}
