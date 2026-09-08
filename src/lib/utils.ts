import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function parseJsonStringArray(v: string | null | undefined): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string" && p.length > 0) : [];
  } catch {
    return [];
  }
}

/** Vehicle.photos is stored as a JSON-encoded string (no native array type
 * in SQLite, and the generated Postgres schema mirrors the same column
 * type) — this turns it back into a plain string[] for display. Tolerates
 * null/empty/malformed values rather than throwing, since photo data comes
 * from CSV uploads and the live-site scraper, both of which are imperfect
 * inputs. */
export function parsePhotos(photos: string | null | undefined): string[] {
  return parseJsonStringArray(photos);
}

/** Same JSON-encoded-string storage as photos, for Vehicle.features. */
export function parseFeatures(features: string | null | undefined): string[] {
  return parseJsonStringArray(features);
}
