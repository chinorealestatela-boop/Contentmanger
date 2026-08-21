// Internal rule-based assistant. No API key, no network call — every
// answer is generated directly from the CRM's own database. This keeps
// the "AI Sales Assistant" fully functional in v1 while remaining behind
// the same AssistantProvider interface a real LLM will implement later.

import { prisma } from "@/lib/prisma";
import type { AssistantProvider } from "@/lib/ai/provider";
import { customerScopeWhere, leadScopeWhere, type Scope } from "@/lib/queries/scope";
import { formatRelativeDay, formatTimeAgo, fullName } from "@/lib/format";
import { optionLabel, PURCHASE_TIMEFRAMES, TASK_TYPES } from "@/lib/constants";

const TIMEFRAME_RANK: Record<string, number> = {
  IMMEDIATE: 0,
  THIS_WEEK: 1,
  THIS_MONTH: 2,
  THIS_QUARTER: 3,
  RESEARCHING: 4,
};

function leadInclude() {
  return { customer: true } as const;
}

async function activeLeads(scope: Scope) {
  return prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "ACTIVE" },
    include: leadInclude(),
  });
}

function bulletList(lines: string[]) {
  return lines.map((l) => `• ${l}`).join("\n");
}

async function handleWhoToCallToday(scope: Scope) {
  const [tasks, leads] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: scope.viewAll ? undefined : scope.userId, status: "PENDING", dueDate: { lte: new Date(new Date().setHours(23, 59, 59, 999)) } },
      include: { customer: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 8,
    }),
    activeLeads(scope),
  ]);

  const overdueFollowUps = leads
    .filter((l) => l.nextFollowUpAt && l.nextFollowUpAt < new Date())
    .sort((a, b) => (a.nextFollowUpAt!.getTime() - b.nextFollowUpAt!.getTime()))
    .slice(0, 5);

  if (tasks.length === 0 && overdueFollowUps.length === 0) {
    return { answer: "You're all caught up — no pending tasks or overdue follow-ups right now. Nice work! Check the Hot Leads panel for anyone worth a proactive touch." };
  }

  const lines: string[] = [];
  if (tasks.length) {
    lines.push("**Tasks due today or overdue:**");
    lines.push(bulletList(tasks.map((t) => `${t.customer?.firstName ?? ""} ${t.customer?.lastName ?? ""} — ${t.title} (${optionLabel(TASK_TYPES, t.type)}, ${t.priority.toLowerCase()} priority)`)));
  }
  if (overdueFollowUps.length) {
    lines.push("\n**Overdue follow-ups:**");
    lines.push(bulletList(overdueFollowUps.map((l) => `${fullName(l.customer)} — last contacted ${l.lastContactedAt ? formatTimeAgo(l.lastContactedAt) : "never"}, follow-up was due ${formatRelativeDay(l.nextFollowUpAt)}`)));
  }
  return { answer: lines.join("\n") };
}

async function handleHottestLeads(scope: Scope) {
  const leads = await prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "ACTIVE", temperature: "HOT" },
    include: leadInclude(),
    orderBy: { score: "desc" },
    take: 8,
  });
  if (!leads.length) return { answer: "No hot leads right now. Your warmest active leads are worth checking on the Dashboard's Hot Leads panel." };
  return {
    answer: `You have ${leads.length} hot lead${leads.length === 1 ? "" : "s"} right now:\n${bulletList(
      leads.map((l) => `${fullName(l.customer)} — score ${l.score}, last contact ${l.lastContactedAt ? formatTimeAgo(l.lastContactedAt) : "never"}`)
    )}`,
  };
}

async function findCustomerByName(scope: Scope, name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const candidates = await prisma.customer.findMany({
    where: {
      ...customerScopeWhere(scope),
      OR: parts.flatMap((p) => [
        { firstName: { contains: p } },
        { lastName: { contains: p } },
      ]),
    },
    include: {
      leads: { include: { stage: true, lostReason: true }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 5 },
      vehicleInterests: { include: { vehicle: true } },
    },
    take: 5,
  });
  return candidates[0] ?? null;
}

async function handleSummarize(scope: Scope, name: string) {
  const customer = await findCustomerByName(scope, name);
  if (!customer) return { answer: `I couldn't find a customer named "${name}". Try their first or last name.` };
  const lead = customer.leads[0];
  const vehicle = customer.vehicleInterests[0]?.vehicle;
  const lines = [
    `**${fullName(customer)}**${lead ? ` — ${lead.temperature} lead, score ${lead.score}, stage "${lead.stage.name}"` : ""}`,
    lead?.purchaseTimeframe ? `Purchase timeframe: ${optionLabel(PURCHASE_TIMEFRAMES, lead.purchaseTimeframe)}` : "",
    vehicle ? `Interested in: ${vehicle.year} ${vehicle.make} ${vehicle.model}` : "",
    lead?.lastContactedAt ? `Last contacted: ${formatTimeAgo(lead.lastContactedAt)}` : "Not contacted yet.",
    lead?.salesNotes ? `Notes: ${lead.salesNotes}` : "",
    customer.activities.length ? `\nRecent activity:\n${bulletList(customer.activities.map((a) => `${a.description} (${formatTimeAgo(a.createdAt)})`))}` : "",
  ].filter(Boolean);
  return { answer: lines.join("\n"), suggestions: [`Why did ${fullName(customer)} go cold?`, `Write a follow-up text for ${fullName(customer)}`] };
}

async function handleWhyCold(scope: Scope, name: string) {
  const customer = await findCustomerByName(scope, name);
  if (!customer) return { answer: `I couldn't find a customer named "${name}".` };
  const lead = customer.leads[0];
  if (!lead) return { answer: `${fullName(customer)} doesn't have an active lead on file.` };
  const daysSince = lead.lastContactedAt ? Math.floor((Date.now() - lead.lastContactedAt.getTime()) / 86400000) : null;
  const parts = [`**${fullName(customer)}** is currently marked ${lead.temperature.toLowerCase()} (score ${lead.score}).`];
  if (lead.status === "LOST") {
    parts.push(`Marked LOST${lead.lostReason ? ` — reason: ${lead.lostReason.name}` : ""}.${lead.lostNotes ? ` Notes: ${lead.lostNotes}` : ""}`);
  } else if (daysSince !== null && daysSince > 5) {
    parts.push(`No contact in ${daysSince} days — that's the main driver. Last touch: ${formatTimeAgo(lead.lastContactedAt!)}.`);
  }
  if (lead.objections) parts.push(`Stated objections: ${lead.objections}`);
  parts.push("Suggested next step: a short, low-pressure check-in referencing their original vehicle of interest often re-opens the conversation.");
  return { answer: parts.join("\n") };
}

async function handleNoContactDays(scope: Scope, days: number) {
  const cutoff = new Date(Date.now() - days * 86400000);
  const leads = await prisma.lead.findMany({
    where: {
      ...leadScopeWhere(scope),
      status: "ACTIVE",
      OR: [{ lastContactedAt: { lt: cutoff } }, { lastContactedAt: null }],
    },
    include: leadInclude(),
    orderBy: { score: "desc" },
    take: 10,
  });
  if (!leads.length) return { answer: `Nobody active has gone ${days}+ days without contact. You're staying on top of follow-ups.` };
  return {
    answer: `${leads.length} customer${leads.length === 1 ? "" : "s"} haven't been contacted in ${days}+ days:\n${bulletList(
      leads.map((l) => `${fullName(l.customer)} — ${l.lastContactedAt ? `last contact ${formatTimeAgo(l.lastContactedAt)}` : "never contacted"}, ${l.temperature.toLowerCase()}`)
    )}`,
  };
}

async function handleClosestToBuying(scope: Scope) {
  const leads = await activeLeads(scope);
  const sorted = leads
    .filter((l) => l.purchaseTimeframe)
    .sort((a, b) => (TIMEFRAME_RANK[a.purchaseTimeframe!] ?? 9) - (TIMEFRAME_RANK[b.purchaseTimeframe!] ?? 9) || b.score - a.score)
    .slice(0, 8);
  if (!sorted.length) return { answer: "No active leads have a purchase timeframe set yet." };
  return {
    answer: `Closest to buying, ranked by stated timeframe:\n${bulletList(
      sorted.map((l) => `${fullName(l.customer)} — ${optionLabel(PURCHASE_TIMEFRAMES, l.purchaseTimeframe)}, score ${l.score}`)
    )}`,
  };
}

async function handleFindByKeyword(scope: Scope, keyword: string) {
  const leads = await prisma.lead.findMany({
    where: {
      ...leadScopeWhere(scope),
      status: "ACTIVE",
      OR: [
        { prefBodyStyle: { contains: keyword } },
        { customerNeeds: { contains: keyword } },
        { customerWants: { contains: keyword } },
        { customer: { vehicleInterests: { some: { OR: [{ make: { contains: keyword } }, { model: { contains: keyword } }, { vehicle: { model: { contains: keyword } } }] } } } },
      ],
    },
    include: leadInclude(),
    take: 8,
  });
  if (!leads.length) return { answer: `No active customers matched "${keyword}".` };
  return { answer: `Found ${leads.length} customer${leads.length === 1 ? "" : "s"} matching "${keyword}":\n${bulletList(leads.map((l) => `${fullName(l.customer)} — ${l.temperature.toLowerCase()}, score ${l.score}`))}` };
}

async function handleLostByReason(scope: Scope, keyword: string) {
  const leads = await prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "LOST", lostReason: { name: { contains: keyword } } },
    include: { ...leadInclude(), lostReason: true },
    take: 10,
  });
  if (!leads.length) return { answer: `No lost leads found matching "${keyword}".` };
  return { answer: `${leads.length} lost lead${leads.length === 1 ? "" : "s"} matching "${keyword}":\n${bulletList(leads.map((l) => `${fullName(l.customer)} — lost: ${l.lostReason?.name}, ${formatTimeAgo(l.lostAt)}`))}` };
}

function writeFollowUpText(name: string) {
  return `Hi ${name}, this is your Driveline Motors sales consultant following up — still happy to help you find the right vehicle whenever you're ready. Any questions I can answer today?`;
}
function writeApptConfirmation(name: string, when?: string) {
  return `Hi ${name}, confirming your appointment${when ? ` for ${when}` : ""} at Driveline Motors. We'll have the vehicle pulled up and ready. Reply here if anything changes!`;
}
function writeNoShowMessage(name: string) {
  return `Hi ${name}, we missed you at your scheduled appointment today. No worries at all — want me to grab a new time that works better for you?`;
}
function writeReactivationMessage(name: string) {
  return `Hi ${name}, it's been a while! We've had some new inventory arrive that fits what you were looking for — would you like me to send a few options over?`;
}

async function handleWriteMessage(scope: Scope, kind: "follow-up" | "confirmation" | "no-show" | "reactivation", name?: string) {
  let displayName = name?.trim() || "there";
  if (name) {
    const c = await findCustomerByName(scope, name);
    if (c) displayName = c.firstName;
  }
  const text =
    kind === "follow-up" ? writeFollowUpText(displayName) :
    kind === "confirmation" ? writeApptConfirmation(displayName) :
    kind === "no-show" ? writeNoShowMessage(displayName) :
    writeReactivationMessage(displayName);
  return { answer: `Here's a draft:\n\n"${text}"\n\n(You can copy this into a text, email, or the Communications log.)` };
}

async function handleTodayPriority(scope: Scope) {
  const leads = await activeLeads(scope);
  const scored = [...leads].sort((a, b) => b.score - a.score).slice(0, 6);
  if (!scored.length) return { answer: "No active leads yet — check the Leads page to capture your first one." };
  return { answer: `Today's highest priority customers:\n${bulletList(scored.map((l) => `${fullName(l.customer)} — ${l.temperature.toLowerCase()}, score ${l.score}, stage lookup on their profile`))}` };
}

const HELP = `I can help with things like:
${bulletList([
  "Who should I call today?",
  "Who are my hottest leads?",
  "Summarize [customer name]",
  "Why did [customer name] go cold?",
  "Who hasn't been contacted in 3 days?",
  "Which leads are closest to buying?",
  "Write a follow-up text for [customer name]",
  "Write an appointment confirmation",
  "Write a no-show message",
  "Write a reactivation message for [customer name]",
  "Find customers interested in trucks",
  "Find customers lost because of price",
])}`;

async function respond({ query, scope }: { query: string; scope: Scope }) {
  const q = query.trim().toLowerCase();
  if (!q) return { answer: HELP };

  const nameAfter = (marker: string) => {
    const idx = q.indexOf(marker);
    if (idx === -1) return "";
    return query.slice(idx + marker.length).trim().replace(/[?.!]+$/, "");
  };

  if (/(who (should|do) i call|call today|work (right now|today)|priority customers|highest priority)/.test(q)) {
    if (/highest priority/.test(q)) return handleTodayPriority(scope);
    return handleWhoToCallToday(scope);
  }
  if (/(hottest|hot leads)/.test(q)) return handleHottestLeads(scope);
  if (/closest to buying|ready to buy/.test(q)) return handleClosestToBuying(scope);

  const noContactMatch = q.match(/(\d+)\s*\+?\s*days?/);
  if (/hasn'?t been contacted|no contact|not contacted/.test(q) && noContactMatch) {
    return handleNoContactDays(scope, parseInt(noContactMatch[1], 10));
  }

  if (/^summarize|summary of|tell me about/.test(q)) {
    const name = nameAfter("summarize") || nameAfter("summary of") || nameAfter("tell me about");
    return handleSummarize(scope, name);
  }
  if (/why did .* go cold|what happened with|why.*cold/.test(q)) {
    const name = query.replace(/why did/i, "").replace(/go cold/i, "").replace(/what happened with/i, "").trim().replace(/[?.!]+$/, "");
    return handleWhyCold(scope, name);
  }

  if (/lost.*(price|payment|credit|no response|trade|vehicle unavailable|changed mind)/.test(q)) {
    const reasonMatch = q.match(/(price|payment|credit|no response|trade|vehicle unavailable|changed mind)/);
    return handleLostByReason(scope, reasonMatch ? reasonMatch[1] : "");
  }

  if (/find customers? (interested in|looking for|who want)/.test(q)) {
    const keyword = query.replace(/.*(interested in|looking for|who want)/i, "").trim().replace(/[?.!]+$/, "");
    return handleFindByKeyword(scope, keyword);
  }

  if (/follow-?up text|write.*follow-?up/.test(q)) return handleWriteMessage(scope, "follow-up", nameAfter("for"));
  if (/confirmation/.test(q)) return handleWriteMessage(scope, "confirmation", nameAfter("for"));
  if (/no-?show message/.test(q)) return handleWriteMessage(scope, "no-show", nameAfter("for"));
  if (/reactivation message/.test(q)) return handleWriteMessage(scope, "reactivation", nameAfter("for"));

  return { answer: `I'm not sure how to answer that yet — here's what I can help with today:\n\n${HELP}` };
}

export const internalProvider: AssistantProvider = {
  id: "internal",
  name: "Internal Assistant (rule-based)",
  requiresApiKey: false,
  isConfigured: async () => true,
  respond,
};
