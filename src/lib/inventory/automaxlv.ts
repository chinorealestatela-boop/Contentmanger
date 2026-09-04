// Fetches and parses live inventory from https://www.automaxlv.com/ — the
// ONLY inventory source this app pulls from (see sync.ts / SOURCE-OF-TRUTH
// rule in the admin Inventory Sync page).
//
// IMPORTANT — this module could not be verified against the real site's
// markup: automaxlv.com is unreachable from the sandbox this was written
// in (network policy), so the parsing strategy below is written defensively
// against the *general, well-documented pattern* most dealer-website
// platforms use (schema.org/Vehicle JSON-LD, embedded for Google Vehicle
// Listings/SEO — see https://schema.org/Vehicle), with an HTML fallback,
// rather than against automaxlv.com's actual DOM. It has never run against
// the live site. The very first sync run after this ships (Settings →
// Inventory Sync → "Sync Now", or the first scheduled cron run) needs a
// human to check the result:
//   - Vehicles show up correctly → done, no further work.
//   - Zero vehicles / a FAILED run → open automaxlv.com/inventory/ in a
//     browser, view source on one listing card and one vehicle detail
//     page, and adjust the selectors/JSON paths below to match. Every
//     extraction attempt is defensive (falls through to "unparsed" rather
//     than throwing or inventing data) specifically so this is a quick,
//     contained fix rather than a rewrite.
//   - If automaxlv.com's platform vendor offers a proper inventory data
//     feed (XML/JSON export) instead of scraping HTML — ask them for it.
//     That's the more robust, standard way dealer CRMs do this; swap it in
//     here without touching sync.ts, the schema, or the booking flow.

import type { ScrapedVehicle, InventoryFetchResult } from "./types";

const BASE_URL = "https://www.automaxlv.com";
const INVENTORY_URL = `${BASE_URL}/inventory/`;
const USER_AGENT = "AutoMaxLV-CRM-InventorySync/1.0 (+internal dealership tool; contact via automaxlv.com)";
const FETCH_TIMEOUT_MS = 20000;

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

// ── JSON-LD extraction (primary strategy) ──────────────────────────────

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // malformed JSON-LD on the page — skip it, don't guess
    }
  }
  return blocks;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function vehicleFromJsonLd(node: Record<string, unknown>, pageUrl: string): ScrapedVehicle | { unparsed: string } {
  const type = node["@type"];
  const isVehicleLike =
    type === "Vehicle" ||
    type === "Car" ||
    (Array.isArray(type) && (type.includes("Vehicle") || type.includes("Car"))) ||
    (type === "Product" && !!node.vehicleIdentificationNumber);
  if (!isVehicleLike) return { unparsed: "not a Vehicle/Car/Product@vehicle JSON-LD node" };

  const brand = node.brand as Record<string, unknown> | string | undefined;
  const make = asString(typeof brand === "object" ? brand?.name : brand) ?? asString(node.manufacturer);
  const model = asString(node.model);
  const yearRaw = node.vehicleModelDate ?? node.productionDate ?? node.releaseDate;
  const year = asNumber(typeof yearRaw === "string" ? yearRaw.slice(0, 4) : yearRaw);

  const offers = node.offers as Record<string, unknown> | undefined;
  const price = asNumber(offers?.price ?? node.price);

  const mileageNode = node.mileageFromOdometer as Record<string, unknown> | number | string | undefined;
  const mileage = asNumber(typeof mileageNode === "object" ? mileageNode?.value : mileageNode);

  const engineNode = node.vehicleEngine as Record<string, unknown> | string | undefined;
  const engine = asString(typeof engineNode === "object" ? engineNode?.name ?? engineNode?.engineType : engineNode);

  const imagesRaw = node.image;
  const photos = Array.isArray(imagesRaw) ? imagesRaw.map(asString).filter((x): x is string => !!x) : asString(imagesRaw) ? [asString(imagesRaw)!] : [];

  const vin = asString(node.vehicleIdentificationNumber);
  const stockNumber = asString(node.sku) ?? asString(node.serialNumber);

  if (!vin && !stockNumber) return { unparsed: "no VIN and no stock/sku — can't uniquely identify this listing" };
  if (!year || !make || !model) return { unparsed: `missing year/make/model (got year=${year}, make=${make}, model=${model})` };

  return {
    vin,
    stockNumber,
    externalId: null,
    year,
    make,
    model,
    trim: asString(node.vehicleConfiguration) ?? asString(node.trim),
    price,
    mileage,
    exteriorColor: asString(node.color),
    interiorColor: asString(node.vehicleInteriorColor),
    engine,
    transmission: asString(node.vehicleTransmission),
    drivetrain: asString(node.driveWheelConfiguration),
    bodyStyle: asString(node.bodyType),
    features: [],
    description: asString(node.description),
    photos,
    url: asString(node.url) ?? pageUrl,
  };
}

// ── Discovery: find every vehicle detail page URL ──────────────────────

async function discoverVehicleUrls(): Promise<string[]> {
  const urls = new Set<string>();

  // Sitemap is the most reliable discovery path when present — no
  // pagination/filter-state guessing required.
  for (const candidate of ["/sitemap.xml", "/vehicle-sitemap.xml", "/sitemap_index.xml"]) {
    try {
      const xml = await fetchText(`${BASE_URL}${candidate}`);
      const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
      for (const m of matches) {
        if (/\/inventory\//i.test(m[1]) && m[1] !== INVENTORY_URL) urls.add(m[1]);
      }
      if (urls.size > 0) break;
    } catch {
      // try the next candidate
    }
  }

  if (urls.size > 0) return Array.from(urls);

  // Fallback: scrape the inventory listing page(s) for VDP links. Handles
  // simple pagination via ?page=N; stops once a page yields no new links.
  for (let page = 1; page <= 20; page++) {
    const pageUrl = page === 1 ? INVENTORY_URL : `${INVENTORY_URL}?page=${page}`;
    let html: string;
    try {
      html = await fetchText(pageUrl);
    } catch {
      break;
    }
    const before = urls.size;
    const linkMatches = html.matchAll(/href=["'](\/inventory\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9]+\/?)["']/gi);
    for (const m of linkMatches) urls.add(new URL(m[1], BASE_URL).toString());
    if (urls.size === before) break; // no new listings on this page — done
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
      "Found zero vehicle detail pages on automaxlv.com (no sitemap entries under /inventory/, and the listing page's HTML didn't match the expected link pattern). The site's markup likely differs from what this parser assumes — see the comment at the top of automaxlv.ts."
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

    const jsonLdBlocks = extractJsonLdBlocks(html);
    let matched = false;
    for (const block of jsonLdBlocks) {
      if (typeof block !== "object" || block === null) continue;
      const result = vehicleFromJsonLd(block as Record<string, unknown>, url);
      if ("unparsed" in result) continue;
      vehicles.push(result);
      matched = true;
      break;
    }

    if (!matched) {
      unparsed.push({
        url,
        reason: jsonLdBlocks.length > 0 ? "found JSON-LD but none of it matched a Vehicle/Car schema with a VIN or stock# and year/make/model" : "no JSON-LD structured data found on this page",
      });
    }
  }

  return { vehicles, unparsed };
}
