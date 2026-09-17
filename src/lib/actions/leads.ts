"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation, enrollInSequence } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
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
  address: optionalStr,
  city: optionalStr,
  state: optionalStr,
  zip: optionalStr,
  preferredContactMethod: z.string().default("PHONE"),
  bestContactTime: optionalStr,

  sourceId: optionalStr,
  assigneeId: z.string().min(1, "Assign a salesperson."),
  purchaseTimeframe: optionalStr,
  temperature: z.string().default("COLD"),

  vehicleId: optionalStr,
  vehicleYear: optionalNum,
  vehicleMake: optionalStr,
  vehicleModel: optionalStr,
  vehicleTrim: optionalStr,

  financeType: optionalStr,
  desiredPayment: optionalNum,
  downPayment: optionalNum,
  hasCoBuyer: optionalStr,
  coBuyerName: optionalStr,

  hasTrade: optionalStr,
  tradeYear: optionalNum,
  tradeMake: optionalStr,
  tradeModel: optionalStr,
  tradePayoff: optionalNum,
  tradeEstValue: optionalNum,

  customerNeeds: optionalStr,
  customerWants: optionalStr,
  objections: optionalStr,
  preferences: optionalStr,
  salesNotes: optionalStr,

  prefBodyStyle: optionalStr,
  prefMaxPrice: optionalNum,
  prefDrivetrain: optionalStr,
  prefThirdRow: optionalStr,
  prefColor: optionalStr,
});

export type LeadActionState = (SimpleActionState & { customerId?: string }) | null;

export async function createLead(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  const scope = await requireScope();
  const raw = Object.fromEntries(formData.entries());
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  // Validate every foreign key up front, before touching the database, so a
  // stale dropdown value (e.g. a salesperson removed after the page loaded)
  // fails with a clear, actionable message instead of a raw FK-constraint
  // crash deep inside the transaction.
  const [assignee, defaultStage, source, vehicle] = await Promise.all([
    prisma.user.findUnique({ where: { id: d.assigneeId }, select: { id: true, isActive: true } }),
    prisma.pipelineStage.findFirst({ where: { name: "New Lead" } }),
    d.sourceId ? prisma.leadSource.findUnique({ where: { id: d.sourceId }, select: { id: true } }) : Promise.resolve(null),
    d.vehicleId ? prisma.vehicle.findUnique({ where: { id: d.vehicleId }, select: { id: true } }) : Promise.resolve(null),
  ]);

  if (!assignee || !assignee.isActive) {
    return { error: "The selected salesperson is no longer available. Please refresh the page and pick again." };
  }
  if (!defaultStage) {
    return { error: "Pipeline isn't configured yet — set up stages in Settings first." };
  }
  if (d.sourceId && !source) {
    return { error: "The selected lead source no longer exists. Please refresh the page and pick again." };
  }
  if (d.vehicleId && !vehicle) {
    return { error: "The selected inventory vehicle no longer exists. Please refresh the page and pick again." };
  }
  if (d.existingCustomerId) {
    const existing = await prisma.customer.findUnique({ where: { id: d.existingCustomerId }, select: { id: true } });
    if (!existing) return { error: "That customer no longer exists. Please start over from the Leads page." };
  }

  let customerId: string;
  let leadId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      let cid = d.existingCustomerId;
      if (!cid) {
        const customer = await tx.customer.create({
          data: {
            firstName: d.firstName,
            lastName: d.lastName,
            phone: d.phone,
            email: d.email,
            address: d.address,
            city: d.city,
            state: d.state,
            zip: d.zip,
            preferredContactMethod: d.preferredContactMethod,
            bestContactTime: d.bestContactTime,
            ownerId: d.assigneeId,
          },
        });
        cid = customer.id;
      }

      const lead = await tx.lead.create({
        data: {
          customerId: cid,
          sourceId: d.sourceId,
          assigneeId: d.assigneeId,
          stageId: defaultStage.id,
          purchaseTimeframe: d.purchaseTimeframe,
          temperature: d.temperature,
          score: d.temperature === "HOT" ? 85 : d.temperature === "WARM" ? 60 : 30,
          financeType: d.financeType,
          desiredPayment: d.desiredPayment,
          downPayment: d.downPayment,
          hasCoBuyer: d.hasCoBuyer === "on" || d.hasCoBuyer === "true",
          coBuyerName: d.coBuyerName,
          prefBodyStyle: d.prefBodyStyle,
          prefMaxPrice: d.prefMaxPrice,
          prefDrivetrain: d.prefDrivetrain,
          prefThirdRow: d.prefThirdRow === "on" || d.prefThirdRow === "true",
          prefColor: d.prefColor,
          customerNeeds: d.customerNeeds,
          customerWants: d.customerWants,
          objections: d.objections,
          preferences: d.preferences,
          salesNotes: d.salesNotes,
          lastContactedAt: new Date(),
          nextFollowUpAt: new Date(),
        },
      });

      if (d.vehicleId || d.vehicleMake || d.vehicleModel) {
        await tx.customerVehicle.create({
          data: {
            customerId: cid,
            leadId: lead.id,
            vehicleId: d.vehicleId,
            year: d.vehicleYear,
            make: d.vehicleMake,
            model: d.vehicleModel,
            trim: d.vehicleTrim,
            isPrimary: true,
          },
        });
      }

      if (d.hasTrade === "on" || d.hasTrade === "true") {
        await tx.tradeIn.create({
          data: {
            customerId: cid,
            year: d.tradeYear,
            make: d.tradeMake,
            model: d.tradeModel,
            payoff: d.tradePayoff ?? 0,
            estimatedValue: d.tradeEstValue ?? 0,
          },
        });
      }

      return { customerId: cid, leadId: lead.id };
    });
    customerId = result.customerId;
    leadId = result.leadId;
  } catch (err) {
    // Never leave a half-created lead (a Customer with no Lead, or a Lead
    // missing its vehicle/trade-in) — the transaction above already
    // guarantees that atomically. Log the real cause for diagnosis and
    // surface a message instead of letting this crash into the generic
    // error boundary.
    console.error("createLead: transaction failed", err);
    return { error: "Something went wrong saving this lead. Nothing was saved — please try again, and if it keeps happening let your admin know." };
  }

  // Best-effort side effects: the lead itself is already safely committed
  // above, so a failure here (e.g. a misconfigured automation rule) should
  // never make it look like the lead didn't save.
  try {
    await logActivity({
      customerId,
      leadId,
      type: "LEAD_CREATED",
      description: "Lead created.",
      actorId: scope.userId,
    });
    await runAutomation("NEW_LEAD", { customerId, leadId, actorId: scope.userId });
    if (d.temperature === "HOT") {
      await runAutomation("HOT_LEAD", { customerId, leadId, actorId: scope.userId });
    }
  } catch (err) {
    console.error("createLead: post-create automation/activity failed (lead was still saved)", err);
  }

  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  return { success: "Lead created.", customerId };
}

export async function changeLeadStage(leadId: string, stageId: string) {
  const scope = await requireScope();
  const [lead, stage] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.pipelineStage.findUnique({ where: { id: stageId } }),
  ]);
  if (!lead || !stage) return;

  await prisma.lead.update({ where: { id: leadId }, data: { stageId, stageEnteredAt: new Date() } });

  await logActivity({
    customerId: lead.customerId,
    leadId,
    type: "STAGE_CHANGE",
    description: `Stage changed to "${stage.name}".`,
    actorId: scope.userId,
  });

  await runAutomation("STAGE_CHANGE", { customerId: lead.customerId, leadId, actorId: scope.userId });

  if (stage.isClosedWon) {
    await markLeadSold(leadId);
  } else if (stage.isClosedLost) {
    // Leave marking lost (with reason) to the explicit Mark Lost action so a reason is always captured.
  }

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${lead.customerId}`);
}

export async function setLeadTemperature(leadId: string, temperature: string) {
  const scope = await requireScope();
  const lead = await prisma.lead.update({ where: { id: leadId }, data: { temperature } });
  await logActivity({ customerId: lead.customerId, leadId, type: "TEMPERATURE_CHANGE", description: `Marked ${temperature}.`, actorId: scope.userId });
  if (temperature === "HOT") await runAutomation("HOT_LEAD", { customerId: lead.customerId, leadId, actorId: scope.userId });
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${lead.customerId}`);
}

async function markLeadSold(leadId: string) {
  const lead = await prisma.lead.update({ where: { id: leadId }, data: { status: "SOLD", soldAt: new Date() } });
  return lead;
}

const soldSchema = z.object({
  leadId: z.string().min(1),
  vehicleId: z.string().min(1, "Select the vehicle sold."),
  salePrice: z.string().min(1, "Sale price is required."),
  financeType: z.string().default("FINANCE"),
  notes: optionalStr,
});

export async function markSold(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = soldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const lead = await prisma.lead.findUnique({ where: { id: d.leadId } });
  if (!lead) return { error: "Lead not found." };

  const soldStage = await prisma.pipelineStage.findFirst({ where: { isClosedWon: true } });

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: d.leadId },
      data: { status: "SOLD", soldAt: new Date(), stageId: soldStage?.id ?? lead.stageId },
    }),
    prisma.sale.create({
      data: {
        customerId: lead.customerId,
        leadId: d.leadId,
        vehicleId: d.vehicleId,
        salePrice: Number(d.salePrice),
        financeType: d.financeType,
        salespersonId: scope.userId,
        notes: d.notes,
      },
    }),
    prisma.vehicle.update({ where: { id: d.vehicleId }, data: { status: "SOLD" } }),
  ]);

  await logActivity({
    customerId: lead.customerId,
    leadId: d.leadId,
    type: "SOLD",
    description: `Deal closed — sale price ${d.salePrice}.`,
    actorId: scope.userId,
  });

  // Alert any other customer whose primary interest was this exact vehicle.
  const interestedOthers = await prisma.customerVehicle.findMany({
    where: { vehicleId: d.vehicleId, customerId: { not: lead.customerId } },
  });
  for (const interest of interestedOthers) {
    await runAutomation("VEHICLE_SOLD", { customerId: interest.customerId, leadId: interest.leadId, actorId: scope.userId, vehicleId: d.vehicleId });
  }

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/vehicles");
  revalidatePath(`/customers/${lead.customerId}`);
  redirect(`/customers/${lead.customerId}`);
}

const lostSchema = z.object({
  leadId: z.string().min(1),
  lostReasonId: z.string().min(1, "Select a reason."),
  lostNotes: optionalStr,
});

export async function markLost(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = lostSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const lostStage = await prisma.pipelineStage.findFirst({ where: { isClosedLost: true } });
  const lead = await prisma.lead.update({
    where: { id: d.leadId },
    data: {
      status: "LOST",
      lostReasonId: d.lostReasonId,
      lostNotes: d.lostNotes,
      lostAt: new Date(),
      stageId: lostStage?.id,
    },
  });

  const reason = await prisma.lostReason.findUnique({ where: { id: d.lostReasonId } });

  await logActivity({
    customerId: lead.customerId,
    leadId: d.leadId,
    type: "LOST",
    description: `Marked lost — reason: ${reason?.name ?? "Unspecified"}.`,
    actorId: scope.userId,
  });

  await prisma.followUpEnrollment.updateMany({
    where: { leadId: d.leadId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  await prisma.task.updateMany({
    where: { leadId: d.leadId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  await runAutomation("LEAD_LOST", { customerId: lead.customerId, leadId: d.leadId, actorId: scope.userId });

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/lost-leads");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${lead.customerId}`);
  redirect(`/customers/${lead.customerId}`);
}

export async function reactivateLead(leadId: string) {
  const scope = await requireScope();
  const newStage = await prisma.pipelineStage.findFirst({ where: { name: "Contacted" } });
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "ACTIVE",
      temperature: "WARM",
      score: 55,
      lostReasonId: null,
      lostAt: null,
      lostNotes: null,
      reactivatedAt: new Date(),
      reactivationCount: { increment: 1 },
      lastContactedAt: new Date(),
      stageId: newStage?.id,
    },
  });

  await logActivity({
    customerId: lead.customerId,
    leadId,
    type: "REACTIVATED",
    description: "Customer reactivated and placed back into an active follow-up sequence.",
    actorId: scope.userId,
  });

  const reactivationSeq = await prisma.followUpSequence.findFirst({ where: { trigger: "REACTIVATION", active: true } });
  if (reactivationSeq) await enrollInSequence(lead.customerId, leadId, reactivationSeq.id);

  await recomputeLeadScore(leadId, scope.userId);

  revalidatePath("/reactivation");
  revalidatePath("/lost-leads");
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${lead.customerId}`);
}

const updateLeadSchema = z.object({
  leadId: z.string().min(1),
  purchaseTimeframe: optionalStr,
  financeType: optionalStr,
  desiredPayment: optionalNum,
  downPayment: optionalNum,
  creditAppStatus: optionalStr,
  customerNeeds: optionalStr,
  customerWants: optionalStr,
  objections: optionalStr,
  salesNotes: optionalStr,
  prefBodyStyle: optionalStr,
  prefMaxPrice: optionalNum,
  prefDrivetrain: optionalStr,
  prefColor: optionalStr,
});

export async function updateLead(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = updateLeadSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { leadId, ...rest } = parsed.data;

  const lead = await prisma.lead.update({ where: { id: leadId }, data: rest });
  await logActivity({ customerId: lead.customerId, leadId, type: "LEAD_UPDATED", description: "Lead details updated.", actorId: scope.userId });
  await recomputeLeadScore(leadId, scope.userId);

  revalidatePath(`/customers/${lead.customerId}`);
  revalidatePath("/leads");
  return { success: "Updated." };
}
