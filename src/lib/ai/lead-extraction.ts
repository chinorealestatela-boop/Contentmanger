// AI Lead Assistant — inquiry parsing (spec §4). Rule-based NLP-lite
// extraction: reads a raw inquiry (website form text, DM, text message)
// and pulls out service type, pickup/dropoff, date/time, passenger count,
// requested vehicle, and self-drive vs. chauffeur — the same job a real
// LLM extraction call would do, kept deterministic and API-key-free for
// v1. Swap the body of `extractLeadInfo` for a real model call later
// without touching any call site.

export type ExtractedLeadInfo = {
  serviceType?: string;
  vehicleKeyword?: string;
  passengers?: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  dateText?: string;
  timeText?: string;
  chauffeurRequested: boolean;
  missingFields: string[];
  confidence: "high" | "medium" | "low";
};

const VEHICLE_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /rolls[\s-]?royce|cullinan|phantom|ghost/i, label: "Rolls-Royce" },
  { pattern: /maybach/i, label: "Maybach Sprinter" },
  { pattern: /sprinter/i, label: "Sprinter Van" },
  { pattern: /escalade/i, label: "Cadillac Escalade" },
  { pattern: /lamborghini|urus/i, label: "Lamborghini Urus" },
  { pattern: /bentley|bentayga|flying spur/i, label: "Bentley" },
  { pattern: /suv/i, label: "Luxury SUV" },
  { pattern: /sedan/i, label: "Luxury Sedan" },
];

const SERVICE_RULES: { pattern: RegExp; service: string }[] = [
  { pattern: /\blax\b|airport|flight|land(ing|ed)?/i, service: "AIRPORT_TRANSFER" },
  { pattern: /wedding/i, service: "WEDDINGS" },
  { pattern: /night out|club|party|bachelor|bachelorette/i, service: "VIP_NIGHT_OUT" },
  { pattern: /corporate|executive|business meeting/i, service: "CORPORATE_TRANSPORTATION" },
  { pattern: /self[\s-]?drive|rent (it |the car )?myself|no driver|without a driver/i, service: "SELF_DRIVE_RENTAL" },
  { pattern: /concert|game|event|premiere|award/i, service: "EVENTS" },
  { pattern: /napa|san diego|vegas|out of town|long distance/i, service: "LONG_DISTANCE" },
  { pattern: /hourly|for (a couple|few|several|\d+) hours?/i, service: "HOURLY_SERVICE" },
];

function extractPassengers(text: string): number | undefined {
  const m = text.match(/for\s+(\d{1,2})\s*(people|passengers|guests|of us)/i) || text.match(/(\d{1,2})\s*(people|passengers|guests)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

function extractRoute(text: string): { pickup?: string; dropoff?: string } {
  const m = text.match(/from\s+([a-z0-9 .'-]+?)\s+to\s+([a-z0-9 .'-]+?)(?:[.,]|\s+(?:on|this|next|at|around)\b|$)/i);
  if (m) return { pickup: cleanupLocation(m[1]), dropoff: cleanupLocation(m[2]) };
  return {};
}
function cleanupLocation(s: string) {
  return s.trim().replace(/\s+/g, " ").replace(/^the\s+/i, "");
}

function extractDate(text: string): string | undefined {
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return "Tomorrow";
  if (/\btonight\b/.test(lower)) return "Tonight";
  if (/\btoday\b/.test(lower)) return "Today";
  for (const w of weekdays) if (lower.includes(w)) return w[0].toUpperCase() + w.slice(1);
  const dateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dateMatch) return dateMatch[0];
  const monthMatch = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i);
  if (monthMatch) return monthMatch[0];
  return undefined;
}

function extractTime(text: string): string | undefined {
  const m = text.match(/\b(\d{1,2})(:\d{2})?\s*(am|pm)\b/i);
  if (m) return `${m[1]}${m[2] ?? ""}${m[3].toLowerCase()}`;
  const m24 = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  return m24 ? m24[0] : undefined;
}

export function extractLeadInfo(rawText: string): ExtractedLeadInfo {
  const text = rawText.trim();
  const vehicleMatch = VEHICLE_KEYWORDS.find((v) => v.pattern.test(text));
  const serviceMatch = SERVICE_RULES.find((s) => s.pattern.test(text));
  const passengers = extractPassengers(text);
  const { pickup, dropoff } = extractRoute(text);
  const dateText = extractDate(text);
  const timeText = extractTime(text);
  const chauffeurRequested = !/self[\s-]?drive|rent (it |the car )?myself|no driver|without a driver/i.test(text);

  const serviceType = serviceMatch?.service ?? (pickup && /airport|lax|bur/i.test(pickup) ? "AIRPORT_TRANSFER" : undefined) ?? "CHAUFFEURED_TRANSPORTATION";

  const missingFields: string[] = [];
  if (!pickup) missingFields.push("pickup location");
  if (!dropoff) missingFields.push("drop-off location");
  if (!dateText) missingFields.push("date");
  if (!timeText) missingFields.push("time");
  if (!passengers) missingFields.push("number of passengers");
  if (!vehicleMatch) missingFields.push("preferred vehicle");

  const confidence: ExtractedLeadInfo["confidence"] = missingFields.length <= 1 ? "high" : missingFields.length <= 3 ? "medium" : "low";

  return {
    serviceType,
    vehicleKeyword: vehicleMatch?.label,
    passengers,
    pickupLocation: pickup,
    dropoffLocation: dropoff,
    dateText,
    timeText,
    chauffeurRequested,
    missingFields,
    confidence,
  };
}

export function summarizeExtraction(info: ExtractedLeadInfo): string {
  const parts = [
    info.serviceType ? optionLabelLocal(info.serviceType) : null,
    info.vehicleKeyword,
    info.passengers ? `${info.passengers} passengers` : null,
    info.pickupLocation && info.dropoffLocation ? `${info.pickupLocation} → ${info.dropoffLocation}` : info.pickupLocation,
    [info.dateText, info.timeText].filter(Boolean).join(" "),
    info.chauffeurRequested ? null : "Self-drive requested",
  ].filter(Boolean);
  const summary = parts.join(" · ");
  return info.missingFields.length
    ? `${summary}. Missing: ${info.missingFields.join(", ")} — confirm with the client.`
    : `${summary}. All key trip details captured.`;
}

function optionLabelLocal(value: string) {
  const map: Record<string, string> = {
    AIRPORT_TRANSFER: "Airport Transfer",
    CHAUFFEURED_TRANSPORTATION: "Chauffeured Transportation",
    SELF_DRIVE_RENTAL: "Self-Drive Rental",
    POINT_TO_POINT: "Point-to-Point Transportation",
    HOURLY_SERVICE: "Hourly Service",
    CORPORATE_TRANSPORTATION: "Corporate Transportation",
    WEDDINGS: "Weddings",
    VIP_NIGHT_OUT: "VIP Night Out",
    EVENTS: "Events",
    CALIFORNIA_TRANSPORTATION: "California Transportation",
    LONG_DISTANCE: "Long-Distance Transportation",
    LIFESTYLE_CONCIERGE: "Lifestyle / Concierge Services",
  };
  return map[value] ?? value;
}
