// Shared shape for a vehicle as read from an external inventory source
// (currently just automaxlv.com — see automaxlv.ts). Kept provider-agnostic
// on purpose: sync.ts only depends on this shape, never on how it was
// fetched, so a second source (or a future feed URL from the site's
// platform vendor, if one exists) can be added without touching the sync
// engine, dedupe logic, or booking-flow wiring.

export type ScrapedVehicle = {
  // Identity — vin is the primary key the sync engine dedupes on; stockNumber
  // is the fallback when a listing has no VIN (rare, but some dealer sites
  // omit it from the public listing).
  vin: string | null;
  stockNumber: string | null;
  externalId: string | null; // the site's own listing id, if different from stockNumber

  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;

  price: number | null;
  mileage: number | null;

  exteriorColor: string | null;
  interiorColor: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  bodyStyle: string | null;

  features: string[];
  description: string | null;
  photos: string[];
  url: string; // vehicle detail page — always required, it's how we re-verify availability
};

export type InventoryFetchResult = {
  vehicles: ScrapedVehicle[];
  /** Listings the fetcher found but couldn't confidently parse (e.g. missing
   * a VIN/stock# and a year/make/model) — surfaced instead of silently
   * dropped or guessed at. */
  unparsed: { url: string; reason: string }[];
};
