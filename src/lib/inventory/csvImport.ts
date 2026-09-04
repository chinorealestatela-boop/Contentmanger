// Manual fallback inventory source: a CSV/spreadsheet export uploaded by
// the dealer, parsed into the same ScrapedVehicle shape the live
// automaxlv.com scraper produces (see types.ts) so it flows through the
// exact same dedupe/upsert/retire logic in sync.ts.
//
// Why this exists: automaxlv.com runs behind Cloudflare bot protection
// (Turnstile). Confirmed directly from production runtime logs on
// 2026-09-04 — a real headless-Chromium render of the listing page comes
// back as Cloudflare's "Performing security verification" challenge page
// (no vehicle markup at all), and the sitemap XML request gets a flat 403
// from a "dealercenterwebsite.net" block page. This is not a markup/parser
// mismatch (see automaxlv.ts's header for that now-closed investigation) —
// it's the site actively refusing automated access, consistent with
// robots.txt disallowing scraper/AI user agents outright. No amount of
// tuning the parser fixes this; it needs either a real feed from
// DealerCenter, a paid anti-bot-bypass service, or — what's implemented
// here — the dealer exporting their own inventory and uploading it.
//
// No external CSV library — same reasoning as automaxlv.ts (this repo's
// dependency tree can't be verified installable from the sandbox this was
// written in). parseCsv() below is a small RFC4180-ish tokenizer (handles
// quoted fields, embedded commas/newlines, "" escaping) rather than a
// naive split(","), since a real dealer export's description/features
// columns will contain commas.

import type { InventoryFetchResult, ScrapedVehicle } from "./types";

const MAX_ROWS = 5000; // sanity cap — a single dealer's inventory is never remotely this large

/** RFC4180-ish CSV tokenizer: handles quoted fields (with embedded commas,
 * newlines, and "" as an escaped quote) and bare unquoted fields. Returns
 * one string[] per row, header row included. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // Normalize line endings so \r\n inside/outside quotes behaves the same.
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Last field/row (files don't always end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === "")); // drop fully-blank lines
}

/** Column-header aliases → our field names. Matched case-insensitively
 * against the trimmed header cell, punctuation/spacing ignored (so
 * "Stock #", "stock_number", and "Stock Number" all match). We don't know
 * the exact export format any given DealerCenter back office produces, so
 * this is intentionally generous rather than requiring one exact schema. */
const HEADER_ALIASES: Record<string, string[]> = {
  vin: ["vin"],
  stockNumber: ["stock", "stocknumber", "stockno", "stocknum"],
  externalId: ["id", "listingid", "externalid", "inventoryid"],
  year: ["year", "modelyear"],
  make: ["make", "manufacturer"],
  model: ["model"],
  trim: ["trim", "series", "styledescription"],
  price: ["price", "internetprice", "sellingprice", "askingprice", "listprice"],
  mileage: ["mileage", "miles", "odometer"],
  exteriorColor: ["exteriorcolor", "extcolor", "exterior", "color"],
  interiorColor: ["interiorcolor", "intcolor", "interior"],
  engine: ["engine", "enginedescription"],
  transmission: ["transmission", "trans"],
  drivetrain: ["drivetrain", "drivetype", "drive"],
  bodyStyle: ["bodystyle", "body", "bodytype"],
  description: ["description", "comments", "notes", "vehiclecomments"],
  features: ["features", "equipment", "options"],
  photos: ["photos", "images", "photourls", "imageurls", "photourl", "pictureurls"],
  url: ["url", "vdpurl", "link", "listingurl", "detailurl"],
  status: ["status", "availability", "inventorystatus"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHeaderIndex(headerRow: string[]): Record<string, number> {
  const normalized = headerRow.map(normalizeHeader);
  const index: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const col = normalized.findIndex((h) => aliases.includes(h));
    if (col !== -1) index[field] = col;
  }
  return index;
}

function cell(row: string[], index: Record<string, number>, field: string): string | null {
  const col = index[field];
  if (col === undefined) return null;
  const v = row[col]?.trim();
  return v && v.length > 0 ? v : null;
}

/** Splits a multi-value cell (features/photos) on the common delimiters
 * dealer exports use for a "list in one cell" column: pipe, semicolon,
 * comma, or a literal newline (the CSV tokenizer above already preserves a
 * newline embedded in a quoted cell rather than treating it as a row
 * break). Commas are a safe delimiter here even though they're also the
 * CSV column separator — this function only ever runs on the contents of
 * one already-tokenized cell, never on a raw CSV line. */
function splitList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[|;,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toNumber(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const SOLD_STATUS_PATTERN = /\b(sold|sale\s*pending|pending|no longer available|unavailable|hold)\b/i;

export function parseInventoryCsv(text: string): InventoryFetchResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { vehicles: [], unparsed: [{ url: "(file)", reason: "The file is empty." }] };
  }

  const [headerRow, ...dataRows] = rows;
  const index = buildHeaderIndex(headerRow);

  if (index.vin === undefined && index.stockNumber === undefined) {
    return {
      vehicles: [],
      unparsed: [
        {
          url: "(file)",
          reason:
            "No VIN or Stock Number column recognized in the header row. Expected one of these headers (case-insensitive): " +
            `VIN; ${HEADER_ALIASES.stockNumber.join(", ")}. Found headers: ${headerRow.join(", ") || "(none)"}.`,
        },
      ],
    };
  }

  const vehicles: ScrapedVehicle[] = [];
  const unparsed: { url: string; reason: string }[] = [];

  for (const [i, row] of dataRows.slice(0, MAX_ROWS).entries()) {
    const rowLabel = `row ${i + 2}`; // +2: 1-indexed, plus the header row
    if (row.every((c) => c.trim() === "")) continue; // blank line

    const vin = cell(row, index, "vin");
    const stockNumber = cell(row, index, "stockNumber");
    if (!vin && !stockNumber) {
      unparsed.push({ url: rowLabel, reason: "No VIN or stock number in this row." });
      continue;
    }

    const status = cell(row, index, "status");
    if (status && SOLD_STATUS_PATTERN.test(status)) {
      unparsed.push({ url: rowLabel, reason: `Status column says "${status}" — excluded rather than synced as available.` });
      continue;
    }

    const yearRaw = cell(row, index, "year");
    const year = yearRaw ? Number(yearRaw.replace(/[^0-9]/g, "")) : null;

    vehicles.push({
      vin,
      stockNumber,
      externalId: cell(row, index, "externalId"),
      year: year && year > 1900 ? year : null,
      make: cell(row, index, "make"),
      model: cell(row, index, "model"),
      trim: cell(row, index, "trim"),
      price: toNumber(cell(row, index, "price")),
      mileage: toNumber(cell(row, index, "mileage")),
      exteriorColor: cell(row, index, "exteriorColor"),
      interiorColor: cell(row, index, "interiorColor"),
      engine: cell(row, index, "engine"),
      transmission: cell(row, index, "transmission"),
      drivetrain: cell(row, index, "drivetrain"),
      bodyStyle: cell(row, index, "bodyStyle"),
      features: splitList(cell(row, index, "features")),
      description: cell(row, index, "description"),
      photos: splitList(cell(row, index, "photos")),
      // No live VDP URL from a spreadsheet in general — sync.ts's
      // verifyVehicleStillListed() already treats a vehicle with no
      // sourceUrl as "trust the CRM's last-synced status" rather than
      // trying to re-fetch a page that doesn't exist.
      url: cell(row, index, "url") ?? "",
    });
  }

  return { vehicles, unparsed };
}
