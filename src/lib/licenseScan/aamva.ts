// Parser for the AAMVA-standard data encoded in the PDF417 barcode on the
// back of a US driver's license / state ID. Deliberately NOT an OCR/AI
// document-recognition service — the barcode already contains the exact
// data as clean, structured text (that's what it's *for*), so decoding it
// is both more accurate than reading the printed front of the card and
// needs no external API, no API key, and no per-scan cost. See
// src/components/licenseScan/LicenseScanner.tsx for the camera capture
// that produces the raw string this function parses.
//
// Real-world barcodes vary a little by issuing state/AAMVA version, but
// the "3-letter element ID immediately followed by its value, one element
// per line" shape is consistent across the versions in circulation. This
// parser is intentionally permissive about surrounding formatting
// (control characters, header/subfile framing) and only trusts fields it
// can actually find — it never invents a value for a field that isn't in
// the payload (see Feature 14 in the original request: "never invent
// missing information").

export type ParsedLicenseFields = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  dob?: string; // ISO "YYYY-MM-DD" — used only to help match against an existing customer; never persisted to a customer record (see the review screen)
  licenseNumber?: string;
  licenseExpiration?: string; // ISO "YYYY-MM-DD"
};

export type ParsedLicense = {
  fields: ParsedLicenseFields;
  foundCount: number;
};

// AAMVA element IDs we care about. Reference: AAMVA DL/ID Card Design
// Standard. Not exhaustive (skips fields the CRM has no use for, like
// height/weight/eye color/restrictions).
const ELEMENT_MAP: Record<string, keyof ParsedLicenseFields> = {
  DAC: "firstName",
  DCT: "firstName", // older format: given name(s), combined — used as a firstName fallback when DAC is absent
  DAD: "middleName",
  DCS: "lastName",
  DAG: "address",
  DAI: "city",
  DAJ: "state",
  DAK: "zip",
  DBB: "dob",
  DBA: "licenseExpiration",
  DAQ: "licenseNumber",
};

function parseAamvaDate(raw: string): string | undefined {
  // AAMVA dates are MMDDCCYY (or, on some older/Canadian cards, CCYYMMDD —
  // we only ever see US MMDDCCYY in practice for this app's use case).
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return undefined;
  const mm = Number(digits.slice(0, 2));
  const dd = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4, 8));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return undefined;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Minimum number of usable fields before we trust the scan at all — below
 * this, treat it the same as an unreadable barcode rather than showing the
 * customer half-populated garbage (see the "confidently read" gate in the
 * original request). */
const MIN_CONFIDENT_FIELDS = 2;

export function parseAamvaPayload(raw: string): ParsedLicense | null {
  if (!raw || !raw.includes("ANSI")) return null; // not an AAMVA-format barcode at all

  const fields: ParsedLicenseFields = {};
  const lines = raw.split(/[\r\n]+/);

  for (const line of lines) {
    const code = line.slice(0, 3);
    const target = ELEMENT_MAP[code];
    if (!target) continue;
    let value = line.slice(3).trim();
    if (!value || /^NONE$/i.test(value)) continue;

    if (target === "dob" || target === "licenseExpiration") {
      const iso = parseAamvaDate(value);
      if (iso) fields[target] = iso;
      continue;
    }
    if (target === "zip") {
      value = value.replace(/\D/g, "").slice(0, 5);
      if (value) fields.zip = value;
      continue;
    }

    // firstName may already be set from DAC — don't let a DCT fallback
    // overwrite a real DAC match.
    if (target === "firstName" && fields.firstName) continue;

    (fields as Record<string, string>)[target] = value;
  }

  const foundCount = Object.values(fields).filter(Boolean).length;
  if (foundCount < MIN_CONFIDENT_FIELDS) return null;

  return { fields, foundCount };
}
