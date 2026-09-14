// Internal rule-based AI Executive Assistant. No API key, no network call
// — every answer is generated directly from the CRM's own database. This
// keeps the AI assistant (spec §4 + §24) fully functional without an LLM
// while remaining behind the same AssistantProvider interface a real
// model (OpenAI/Anthropic) can implement later — see getActiveProvider().

import { prisma } from "@/lib/prisma";
import type { AssistantProvider } from "@/lib/ai/provider";
import { customerScopeWhere, leadScopeWhere, type Scope } from "@/lib/queries/scope";
import { formatCurrency, formatRelativeDay, formatTimeAgo, fullName } from "@/lib/format";
import { LA_LANDMARKS, haversineMiles } from "@/lib/integrations/gps";

function bulletList(lines: string[]) {
  return lines.map((l) => `• ${l}`).join("\n");
}

async function activeLeads(scope: Scope) {
  return prisma.lead.findMany({ where: { ...leadScopeWhere(scope), status: "ACTIVE" }, include: { customer: true } });
}

async function findCustomerByName(scope: Scope, name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const candidates = await prisma.customer.findMany({
    where: { ...customerScopeWhere(scope), OR: parts.flatMap((p) => [{ firstName: { contains: p } }, { lastName: { contains: p } }]) },
    include: { leads: { include: { stage: true }, orderBy: { createdAt: "desc" } }, activities: { orderBy: { createdAt: "desc" }, take: 5 }, bookings: { orderBy: { date: "desc" }, take: 3 } },
    take: 5,
  });
  return candidates[0] ?? null;
}

// ── Handlers ──────────────────────────────────────────────────────────

async function handleUncontactedToday(scope: Scope) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const leads = await prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "ACTIVE", createdAt: { gte: start }, lastContactedAt: null },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });
  if (!leads.length) return { answer: "No uncontacted leads from today — everything that came in has been touched. 🎉" };
  return { answer: `${leads.length} lead${leads.length === 1 ? "" : "s"} from today still need a first touch:\n${bulletList(leads.map((l) => `${fullName(l.customer)} — ${l.serviceRequested ?? "inquiry"}${l.isVip ? " ⭐ VIP" : ""}, received ${formatTimeAgo(l.createdAt)}`))}` };
}

async function handleAvailableVehicles(scope: Scope, dayLabel: string, date: Date) {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  const [allVehicles, bookedVehicleIds] = await Promise.all([
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({ where: { date: { gte: dayStart, lte: dayEnd }, bookingStatus: { notIn: ["CANCELLED"] } }, select: { vehicleId: true } }),
  ]);
  const bookedIds = new Set(bookedVehicleIds.map((b) => b.vehicleId).filter(Boolean));
  const available = allVehicles.filter((v) => !bookedIds.has(v.id) && v.availability !== "MAINTENANCE" && v.availability !== "OFFLINE");
  if (!available.length) return { answer: `No vehicles are open on ${dayLabel} — the whole fleet is booked or unavailable.` };
  return { answer: `${available.length} vehicle${available.length === 1 ? "" : "s"} available on ${dayLabel}:\n${bulletList(available.map((v) => `${v.name} (${v.fleetNumber})`))}` };
}

async function handleRevenueByVehicleKeyword(scope: Scope, keyword: string) {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const bookings = await prisma.booking.findMany({
    where: { date: { gte: start }, bookingStatus: "COMPLETED", vehicle: { OR: [{ name: { contains: keyword } }, { make: { contains: keyword } }, { model: { contains: keyword } }] } },
    select: { totalPrice: true, vehicle: { select: { name: true } } },
  });
  if (!bookings.length) return { answer: `No completed trips matching "${keyword}" this month yet.` };
  const total = bookings.reduce((s, b) => s + b.totalPrice, 0);
  return { answer: `${bookings[0].vehicle?.name ?? keyword} generated ${formatCurrency(total)} across ${bookings.length} completed trip${bookings.length === 1 ? "" : "s"} this month.` };
}

async function handleWhoNeedsFollowUp(scope: Scope) {
  const leads = await activeLeads(scope);
  const due = leads.filter((l) => l.nextFollowUpAt && l.nextFollowUpAt <= new Date()).sort((a, b) => (a.nextFollowUpAt!.getTime() - b.nextFollowUpAt!.getTime()));
  if (!due.length) return { answer: "Nobody is overdue for a follow-up right now." };
  return { answer: `${due.length} lead${due.length === 1 ? "" : "s"} need a follow-up:\n${bulletList(due.map((l) => `${fullName(l.customer)} — follow-up was due ${formatRelativeDay(l.nextFollowUpAt)}`))}` };
}

async function handleTomorrowSchedule() {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setHours(23, 59, 59, 999);
  const bookings = await prisma.booking.findMany({
    where: { date: { gte: start, lte: end }, bookingStatus: { notIn: ["CANCELLED"] } },
    include: { customer: true, vehicle: true, driver: true },
    orderBy: { pickupTime: "asc" },
  });
  if (!bookings.length) return { answer: "Nothing on the books for tomorrow yet." };
  return { answer: `Tomorrow's schedule (${bookings.length} reservation${bookings.length === 1 ? "" : "s"}):\n${bulletList(bookings.map((b) => `${b.pickupTime} — ${fullName(b.customer)}, ${b.serviceType}, ${b.vehicle?.name ?? "vehicle TBD"}${b.driver ? `, ${fullName(b.driver)}` : ""}`))}` };
}

async function handleUnpaidBalances() {
  const bookings = await prisma.booking.findMany({
    where: { remainingBalance: { gt: 0 }, bookingStatus: { notIn: ["CANCELLED"] } },
    include: { customer: true },
    orderBy: { date: "asc" },
    take: 15,
  });
  if (!bookings.length) return { answer: "Every active booking is paid in full — no outstanding balances." };
  const total = bookings.reduce((s, b) => s + b.remainingBalance, 0);
  return { answer: `${bookings.length} booking${bookings.length === 1 ? "" : "s"} with a balance due (${formatCurrency(total)} total):\n${bulletList(bookings.map((b) => `${fullName(b.customer)} — ${formatCurrency(b.remainingBalance)} due, trip ${formatRelativeDay(b.date)}`))}` };
}

async function handleFollowUpListToday(scope: Scope) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const leads = await prisma.lead.findMany({ where: { ...leadScopeWhere(scope), status: "ACTIVE", createdAt: { gte: start, lte: end } }, include: { customer: true } });
  if (!leads.length) return { answer: "No leads came in today, so there's nothing to build a follow-up list from." };
  return { answer: `Follow-up list for today's ${leads.length} lead${leads.length === 1 ? "" : "s"}:\n${bulletList(leads.map((l) => `☐ ${fullName(l.customer)} — ${l.customer.phone ?? l.customer.email ?? "no contact on file"} (${l.serviceRequested ?? "inquiry"})`))}` };
}

async function handleClosestVehicle(landmarkKey: string) {
  const landmark = LA_LANDMARKS[landmarkKey];
  if (!landmark) return { answer: `I don't have coordinates for "${landmarkKey}" yet.` };
  const vehicles = await prisma.vehicle.findMany({ where: { isActive: true }, include: { gpsPings: { orderBy: { recordedAt: "desc" }, take: 1 } } });
  const withDistance = vehicles.filter((v) => v.gpsPings[0]).map((v) => ({ v, dist: haversineMiles(landmark, v.gpsPings[0]) }));
  if (!withDistance.length) return { answer: "No live GPS data yet — connect a telematics provider in Settings → Integrations, or check the Live Map." };
  withDistance.sort((a, b) => a.dist - b.dist);
  const closest = withDistance[0];
  return { answer: `${closest.v.name} (${closest.v.fleetNumber}) is closest — about ${closest.dist.toFixed(1)} miles away, currently ${closest.v.availability.toLowerCase().replace("_", " ")}.` };
}

async function handleSummarize(scope: Scope, name: string) {
  const customer = await findCustomerByName(scope, name);
  if (!customer) return { answer: `I couldn't find a client named "${name}". Try their first or last name.` };
  const lead = customer.leads[0];
  const lines = [
    `**${fullName(customer)}** — ${customer.tier} client${lead ? `, stage "${lead.stage.name}"` : ""}`,
    lead?.serviceRequested ? `Latest request: ${lead.serviceRequested} — ${lead.pickupLocation ?? "?"} → ${lead.dropoffLocation ?? "?"}` : "",
    lead?.lastContactedAt ? `Last contacted: ${formatTimeAgo(lead.lastContactedAt)}` : "Not contacted yet.",
    customer.bookings.length ? `${customer.bookings.length} booking(s) on file.` : "No bookings yet.",
    lead?.notes ? `Notes: ${lead.notes}` : "",
    customer.activities.length ? `\nRecent activity:\n${bulletList(customer.activities.map((a) => `${a.description} (${formatTimeAgo(a.createdAt)})`))}` : "",
  ].filter(Boolean);
  return { answer: lines.join("\n") };
}

function writeFollowUpText(name: string) {
  return `Hi ${name}, this is your Stratos Exotics concierge following up on your inquiry — happy to help lock in your vehicle and chauffeur whenever you're ready. Any questions I can answer?`;
}
function writeBookingConfirmation(name: string, when?: string) {
  return `Hi ${name}, you're confirmed with Stratos Exotics & Lifestyle${when ? ` for ${when}` : ""}. Your chauffeur and vehicle details will follow 24 hours before your reservation.`;
}
function writeReminder(name: string) {
  return `Hi ${name}, just a reminder your Stratos Exotics reservation is coming up soon. Reply here with any changes — we'll take great care of you.`;
}

async function handleWriteMessage(scope: Scope, kind: "follow-up" | "confirmation" | "reminder", name?: string) {
  let displayName = name?.trim() || "there";
  if (name) {
    const c = await findCustomerByName(scope, name);
    if (c) displayName = c.firstName;
  }
  const text = kind === "follow-up" ? writeFollowUpText(displayName) : kind === "confirmation" ? writeBookingConfirmation(displayName) : writeReminder(displayName);
  return { answer: `Here's a draft:\n\n"${text}"\n\n(Copy this into a text, email, or the Communications log — or connect Twilio/SendGrid in Settings to send it directly.)` };
}

const HELP = `I can help with things like:
${bulletList([
  "Show me all uncontacted leads from today",
  "Which vehicles are available Saturday?",
  "How much revenue did the Sprinter generate this month?",
  "Who needs a follow-up?",
  "Show me tomorrow's schedule",
  "Which customers haven't paid their balance?",
  "Create a follow-up list for today's leads",
  "Which vehicle is currently closest to LAX?",
  "Summarize [client name]",
  "Write a follow-up text for [client name]",
  "Write a booking confirmation",
  "Write a reminder message",
])}`;

function nextWeekday(target: number) {
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

async function respond({ query, scope }: { query: string; scope: Scope }) {
  const q = query.trim().toLowerCase();
  if (!q) return { answer: HELP };

  const nameAfter = (marker: string) => {
    const idx = q.indexOf(marker);
    if (idx === -1) return "";
    return query.slice(idx + marker.length).trim().replace(/[?.!]+$/, "");
  };

  if (/uncontacted leads/.test(q)) return handleUncontactedToday(scope);

  if (/available.*(vehicle|fleet|car)/.test(q) || /which vehicles are available/.test(q)) {
    const weekday = WEEKDAYS.find((w) => q.includes(w));
    const date = weekday ? nextWeekday(WEEKDAYS.indexOf(weekday)) : new Date();
    return handleAvailableVehicles(scope, weekday ? weekday[0].toUpperCase() + weekday.slice(1) : "today", date);
  }

  if (/revenue.*(generate|generated|bring)/.test(q) || /how much revenue/.test(q)) {
    const m = q.match(/revenue did the ([a-z\- ]+) generate/) || q.match(/revenue.*for the ([a-z\- ]+)/);
    const keyword = m ? m[1].trim() : query.replace(/.*revenue.*(did|for) the/i, "").replace(/generate.*/i, "").trim();
    return handleRevenueByVehicleKeyword(scope, keyword || "sprinter");
  }

  if (/who needs a follow-?up/.test(q)) return handleWhoNeedsFollowUp(scope);
  if (/follow-?up list/.test(q)) return handleFollowUpListToday(scope);

  if (/tomorrow'?s schedule|schedule for tomorrow/.test(q)) return handleTomorrowSchedule();

  if (/haven'?t paid|unpaid|outstanding balance|balance due/.test(q)) return handleUnpaidBalances();

  if (/closest to/.test(q)) {
    const m = q.match(/closest to ([a-z ]+)/);
    const landmark = (m ? m[1] : "lax").trim().toUpperCase().replace(/[?.!]+$/, "");
    return handleClosestVehicle(landmark in LA_LANDMARKS ? landmark : "LAX");
  }

  if (/^summarize|summary of|tell me about/.test(q)) {
    const name = nameAfter("summarize") || nameAfter("summary of") || nameAfter("tell me about");
    return handleSummarize(scope, name);
  }

  if (/follow-?up text|write.*follow-?up/.test(q)) return handleWriteMessage(scope, "follow-up", nameAfter("for"));
  if (/confirmation/.test(q)) return handleWriteMessage(scope, "confirmation", nameAfter("for"));
  if (/reminder/.test(q)) return handleWriteMessage(scope, "reminder", nameAfter("for"));

  return { answer: `I'm not sure how to answer that yet — here's what I can help with:\n\n${HELP}` };
}

export const internalProvider: AssistantProvider = {
  id: "internal",
  name: "Internal Assistant (rule-based)",
  requiresApiKey: false,
  isConfigured: async () => true,
  respond,
};
