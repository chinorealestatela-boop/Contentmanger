"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation, stopFollowUpsForLead, enrollInSequence } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { extractLeadInfo, summarizeExtraction } from "@/lib/ai/lead-extraction";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SimpleActionState } from "@/lib/actions/communications";

const optionalStr = z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined));
const optionalNum = z.string().optional().transform((v) => (v && v.length > 0 ? Number(v) : undefined));

const intakeSchema = z.object({
  existingCustomerId: optionalStr,
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  phone: optionalStr,
  email: optionalStr,
  company: optionalStr,
  preferredContactMethod: z.string().default("PHONE"),

  sourceId: optionalStr,
  assigneeId: optionalStr,

  serviceRequested: optionalStr,
  pickupLocation: optionalStr,
  dropoffLocation: optionalStr,
  serviceDate: optionalStr,
  pickupTime: optionalStr,
  passengers: optionalNum,
  vehicleRequested: optionalStr,
  vehicleId: optionalStr,
  chauffeurRequested: optionalStr,
  driverRequested: optionalStr,
  estimatedHours: optionalNum,
  estimatedPrice: optionalNum,
  budget: optionalNum,

  isVip: optionalStr,
  notes: optionalStr,
  rawInquiry: optionalStr,
});

export type LeadActionState = (SimpleActionState & { customerId?: string; leadId?: string }) | null;

export async function createLead(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const scope = await requireScope();
  const raw = Object.fromEntries(formData.entries());
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  let customerId = d.existingCustomerId;
  if (!customerId) {
    // Reuse an existing client record by phone/email when one matches, so
    // a repeat inquiry doesn't fragment their history.
    const existing = d.phone || d.email
      ? await prisma.customer.findFirst({ where: { OR: [d.phone ? { phone: d.phone } : undefined, d.email ? { email: d.email } : undefined].filter(Boolean) as never[] } })
      : null;
    if (existing) {
      customerId = existing.id;
    } else {
      const customer = await prisma.customer.create({
        data: {
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          email: d.email,
          company: d.company,
          preferredContactMethod: d.preferredContactMethod,
          ownerId: d.assigneeId || scope.userId,
        },
      });
      customerId = customer.id;
    }
  }

  const defaultStage = await prisma.pipelineStage.findFirst({ where: { name: "New Lead" } });
  if (!defaultStage) return { error: "Pipeline isn't configured yet — set up stages in Settings first." };

  const lead = await prisma.lead.create({
    data: {
      customerId,
      sourceId: d.sourceId,
      assigneeId: d.assigneeId || scope.userId,
      stageId: defaultStage.id,
      serviceRequested: d.serviceRequested,
      pickupLocation: d.pickupLocation,
      dropoffLocation: d.dropoffLocation,
      serviceDate: d.serviceDate ? new Date(d.serviceDate) : undefined,
      pickupTime: d.pickupTime,
      passengers: d.passengers,
      vehicleRequested: d.vehicleRequested,
      vehicleId: d.vehicleId,
      chauffeurRequested: d.chauffeurRequested ? d.chauffeurRequested === "on" || d.chauffeurRequested === "true" : true,
      driverRequested: d.driverRequested,
      estimatedHours: d.estimatedHours,
      estimatedPrice: d.estimatedPrice,
      budget: d.budget,
      isVip: d.isVip === "on" || d.isVip === "true",
      notes: d.notes,
      rawInquiry: d.rawInquiry,
      lastContactedAt: null,
      nextFollowUpAt: new Date(),
    },
  });

  if (d.rawInquiry) {
    const extracted = extractLeadInfo(d.rawInquiry);
    await prisma.lead.update({ where: { id: lead.id }, data: { aiSummary: summarizeExtraction(extracted) } });
  }

  await logActivity({ customerId, leadId: lead.id, type: "LEAD_CREATED", description: "Lead created.", actorId: scope.userId });
  await runAutomation("NEW_LEAD", { customerId, leadId: lead.id, actorId: scope.userId });
  await recomputeLeadScore(lead.id, scope.userId);

  const defaultSeq = await prisma.followUpSequence.findFirst({ where: { isDefault: true, active: true } });
  if (defaultSeq) await enrollInSequence(customerId, lead.id, defaultSeq.id);

  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  return { success: "Lead created.", customerId, leadId: lead.id };
}

/** Re-runs the rule-based AI extraction against a lead's raw inquiry text
 * and fills in any structured fields that are still empty (spec §4). */
export async function applyAiExtraction(leadId: string) {
  const scope = await requireScope();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.rawInquiry) return null;

  const extracted = extractLeadInfo(lead.rawInquiry);
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      serviceRequested: lead.serviceRequested ?? extracted.serviceType,
      pickupLocation: lead.pickupLocation ?? extracted.pickupLocation,
      dropoffLocation: lead.dropoffLocation ?? extracted.dropoffLocation,
      passengers: lead.passengers ?? extracted.passengers,
      vehicleRequested: lead.vehicleRequested ?? extracted.vehicleKeyword,
      chauffeurRequested: extracted.chauffeurRequested,
      aiSummary: summarizeExtraction(extracted),
      aiExtracted: JSON.stringify(extracted),
    },
  });
  await logActivity({ customerId: lead.customerId, leadId, type: "AI_EXTRACTED", description: "AI assistant parsed the inquiry and filled in trip details.", actorId: scope.userId });
  revalidatePath(`/leads/${leadId}`);
  return extracted;
}

export async function changeLeadStage(leadId: string, stageId: string) {
  const scope = await requireScope();
  const [lead, stage] = await Promise.all([prisma.lead.findUnique({ where: { id: leadId } }), prisma.pipelineStage.findUnique({ where: { id: stageId } })]);
  if (!lead || !stage) return;

  await prisma.lead.update({ where: { id: leadId }, data: { stageId, stageEnteredAt: new Date() } });
  await logActivity({ customerId: lead.customerId, leadId, type: "STAGE_CHANGE", description: `Stage changed to "${stage.name}".`, actorId: scope.userId });
  await runAutomation("STAGE_CHANGE", { customerId: lead.customerId, leadId, actorId: scope.userId });

  if (stage.name === "Quote Sent") await runAutomation("QUOTE_SENT", { customerId: lead.customerId, leadId, actorId: scope.userId });

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/customers/${lead.customerId}`);
}

export async function toggleLeadVip(leadId: string) {
  const scope = await requireScope();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  const isVip = !lead.isVip;
  await prisma.lead.update({ where: { id: leadId }, data: { isVip } });
  await logActivity({ customerId: lead.customerId, leadId, type: "VIP_FLAG", description: isVip ? "Flagged as VIP / high-value." : "VIP flag removed.", actorId: scope.userId });
  if (isVip) await runAutomation("HIGH_VALUE_LEAD", { customerId: lead.customerId, leadId, actorId: scope.userId });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
}

export async function assignLead(leadId: string, assigneeId: string) {
  const scope = await requireScope();
  const lead = await prisma.lead.update({ where: { id: leadId }, data: { assigneeId } });
  await logActivity({ customerId: lead.customerId, leadId, type: "ASSIGNED", description: "Lead reassigned.", actorId: scope.userId });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

const lostSchema = z.object({ leadId: z.string().min(1), lostReasonId: z.string().min(1, "Select a reason."), lostNotes: optionalStr });

export async function markLost(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = lostSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const lostStage = await prisma.pipelineStage.findFirst({ where: { isClosedLost: true } });
  const lead = await prisma.lead.update({
    where: { id: d.leadId },
    data: { status: "LOST", lostReasonId: d.lostReasonId, lostNotes: d.lostNotes, lostAt: new Date(), stageId: lostStage?.id },
  });
  const reason = await prisma.lostReason.findUnique({ where: { id: d.lostReasonId } });

  await logActivity({ customerId: lead.customerId, leadId: d.leadId, type: "LOST", description: `Marked lost — reason: ${reason?.name ?? "Unspecified"}.`, actorId: scope.userId });
  await stopFollowUpsForLead(d.leadId, "RESPONDED");
  await prisma.task.updateMany({ where: { leadId: d.leadId, status: "PENDING" }, data: { status: "CANCELLED" } });

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${lead.customerId}`);
  redirect(`/leads/${d.leadId}`);
}

export async function reactivateLead(leadId: string) {
  const scope = await requireScope();
  const newStage = await prisma.pipelineStage.findFirst({ where: { name: "Contacted" } });
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: "ACTIVE", lostReasonId: null, lostAt: null, lostNotes: null, lastContactedAt: new Date(), stageId: newStage?.id },
  });
  await logActivity({ customerId: lead.customerId, leadId, type: "REACTIVATED", description: "Lead reactivated.", actorId: scope.userId });
  await recomputeLeadScore(leadId, scope.userId);
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${leadId}`);
}

const updateLeadSchema = z.object({
  leadId: z.string().min(1),
  serviceRequested: optionalStr,
  pickupLocation: optionalStr,
  dropoffLocation: optionalStr,
  serviceDate: optionalStr,
  pickupTime: optionalStr,
  passengers: optionalNum,
  vehicleRequested: optionalStr,
  estimatedHours: optionalNum,
  estimatedPrice: optionalNum,
  budget: optionalNum,
  notes: optionalStr,
});

export async function updateLead(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = updateLeadSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { leadId, serviceDate, ...rest } = parsed.data;

  const lead = await prisma.lead.update({ where: { id: leadId }, data: { ...rest, serviceDate: serviceDate ? new Date(serviceDate) : undefined } });
  await logActivity({ customerId: lead.customerId, leadId, type: "LEAD_UPDATED", description: "Lead details updated.", actorId: scope.userId });
  await recomputeLeadScore(leadId, scope.userId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { success: "Updated." };
}
