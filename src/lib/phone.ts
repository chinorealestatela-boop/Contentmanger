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
 * looking like a plain 10-digit US number. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
