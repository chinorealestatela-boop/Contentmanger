// Pure phone validation/formatting helpers — no server-only imports, so
// this is safe to import from client components (e.g. the booking wizard,
// for instant validation feedback) as well as server actions.

/** Loose US/Canada-focused phone validation + normalization to E.164. Good
 * enough to catch typos at the form layer; real deliverability is the SMS
 * provider's problem once connected (see src/lib/sms/provider.ts). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return /^\+\d{10,15}$/.test(digits) ? digits : null;
  }
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/** Formats a raw phone string as (555) 123-4567 while the user types, for
 * a nicer-feeling input. Falls back to the raw string once it stops
 * looking like a plain 10-digit US number.
 *
 * Root cause of the "extra 1" bug (confirmed by reproducing it): a
 * customer who dials out of habit with the leading US country code
 * ("1-702-555-1234") was having that leading 1 treated as the start of
 * the area code — slicing to 10 digits kept "1705551234" (dropping the
 * true last digit) instead of recognizing 11 digits as country-code +
 * number. normalizePhone() then saw a bare 10-digit string and prepended
 * its own "+1", producing a doubled "+11705551234" with the real last
 * digit gone. Stripping a redundant leading 1 (at 11 digits) before
 * slicing fixes it at the source, so normalizePhone always receives the
 * true 10-digit number either way. */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
