import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { runAutomation, enrollInSequence } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { extractLeadInfo, summarizeExtraction } from "@/lib/ai/lead-extraction";

// Public webhook the Stratos Exotics marketing website posts to whenever
// someone clicks "Reserve Now" or submits an inquiry form (spec §27).
// No CRM login required — this is the front door leads come through.
//
// Protect it in production by setting WEBSITE_LEAD_WEBHOOK_SECRET and
// having the website send it back as `x-webhook-secret`. Left unset, the
// endpoint stays open (useful for local testing) — never leave it unset
// in a real deployment with a public website pointed at it.
const bodySchema = z.object({
  name: z.string().min(1, "Name is required."),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  vehicle: z.string().optional(),
  service: z.string().optional(),
  date: z.string().optional(), // ISO date
  time: z.string().optional(), // "HH:mm"
  pickup: z.string().optional(),
  destination: z.string().optional(),
  passengers: z.union([z.number(), z.string()]).optional(),
  notes: z.string().optional(),
  source: z.string().optional().default("Website"),
});

export async function POST(request: Request) {
  const expectedSecret = process.env.WEBSITE_LEAD_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = request.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const d = parsed.data;

  const nameParts = d.name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "—";

  // Reuse an existing client record when phone/email matches.
  let customer = d.phone || d.email
    ? await prisma.customer.findFirst({ where: { OR: [d.phone ? { phone: d.phone } : undefined, d.email ? { email: d.email } : undefined].filter(Boolean) as never[] } })
    : null;

  const owner = await prisma.role.findUnique({ where: { name: "OWNER" }, include: { users: { where: { isActive: true }, take: 1 } } });
  const fallbackOwnerId = owner?.users[0]?.id;
  if (!fallbackOwnerId) {
    return NextResponse.json({ error: "CRM is not fully set up yet (no active owner account)." }, { status: 500 });
  }

  if (!customer) {
    customer = await prisma.customer.create({
      data: { firstName, lastName, phone: d.phone, email: d.email, ownerId: fallbackOwnerId },
    });
  }

  const [source, stage] = await Promise.all([
    prisma.leadSource.upsert({ where: { name: d.source }, update: {}, create: { name: d.source } }),
    prisma.pipelineStage.findFirst({ where: { name: "New Lead" } }),
  ]);
  if (!stage) {
    return NextResponse.json({ error: "CRM pipeline is not configured yet." }, { status: 500 });
  }

  const rawInquiry = d.notes;
  const extracted = rawInquiry ? extractLeadInfo(rawInquiry) : null;

  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      sourceId: source.id,
      stageId: stage.id,
      serviceRequested: d.service ?? extracted?.serviceType,
      pickupLocation: d.pickup ?? extracted?.pickupLocation,
      dropoffLocation: d.destination ?? extracted?.dropoffLocation,
      serviceDate: d.date ? new Date(d.date) : undefined,
      pickupTime: d.time,
      passengers: d.passengers ? Number(d.passengers) : extracted?.passengers,
      vehicleRequested: d.vehicle ?? extracted?.vehicleKeyword,
      chauffeurRequested: extracted?.chauffeurRequested ?? true,
      rawInquiry,
      aiSummary: extracted ? summarizeExtraction(extracted) : undefined,
      aiExtracted: extracted ? JSON.stringify(extracted) : undefined,
      notes: d.notes,
    },
  });

  await logActivity({ customerId: customer.id, leadId: lead.id, type: "LEAD_CREATED", description: `Inquiry received from the website (${d.source}).` });
  await runAutomation("NEW_LEAD", { customerId: customer.id, leadId: lead.id });
  await recomputeLeadScore(lead.id);

  const defaultSeq = await prisma.followUpSequence.findFirst({ where: { isDefault: true, active: true } });
  if (defaultSeq) await enrollInSequence(customer.id, lead.id, defaultSeq.id);

  return NextResponse.json({ success: true, leadId: lead.id, customerId: customer.id }, { status: 201 });
}
