"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { computePricing } from "@/lib/pricing";
import { sendMessage } from "@/lib/integrations/messaging";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SimpleActionState } from "@/lib/actions/communications";

const optionalStr = z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined));
const optionalNum = z.string().optional().transform((v) => (v && v.length > 0 ? Number(v) : undefined));
let quoteSeqCache: number | null = null;

async function nextQuoteNumber() {
  if (quoteSeqCache === null) {
    const count = await prisma.quote.count();
    quoteSeqCache = 5000 + count;
  }
  quoteSeqCache += 1;
  return `Q-${quoteSeqCache}`;
}

const schema = z.object({
  customerId: z.string().min(1, "Select a client."),
  leadId: optionalStr,
  vehicleId: optionalStr,
  driverId: optionalStr,
  serviceType: optionalStr,
  pickupLocation: optionalStr,
  dropoffLocation: optionalStr,
  additionalStops: optionalStr,
  serviceDate: optionalStr,
  pickupTime: optionalStr,
  hours: optionalNum,
  distanceMiles: optionalNum,
  amenities: z.array(z.string()).optional().default([]),
  baseRate: optionalNum,
  driverFee: optionalNum,
  mileageFee: optionalNum,
  additionalFees: optionalNum,
  discount: optionalNum,
  depositRate: optionalNum,
  termsText: optionalStr,
});

export type QuoteActionState = (SimpleActionState & { quoteId?: string }) | null;

export async function createQuote(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const scope = await requireScope();
  const amenities = formData.getAll("amenities").map(String);
  const parsed = schema.safeParse({ ...Object.fromEntries(formData.entries()), amenities });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const pricing = computePricing({
    baseRate: d.baseRate ?? 0,
    driverFee: d.driverFee ?? 0,
    mileageFee: d.mileageFee ?? 0,
    additionalFees: d.additionalFees ?? 0,
    discount: d.discount ?? 0,
    depositRate: d.depositRate ? d.depositRate / 100 : 0.3,
  });

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 14);

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: await nextQuoteNumber(),
      customerId: d.customerId,
      leadId: d.leadId,
      vehicleId: d.vehicleId,
      driverId: d.driverId,
      serviceType: d.serviceType,
      pickupLocation: d.pickupLocation,
      dropoffLocation: d.dropoffLocation,
      additionalStops: d.additionalStops ? JSON.stringify(d.additionalStops.split(",").map((s) => s.trim()).filter(Boolean)) : undefined,
      serviceDate: d.serviceDate ? new Date(d.serviceDate) : undefined,
      pickupTime: d.pickupTime,
      hours: d.hours,
      distanceMiles: d.distanceMiles,
      amenities: JSON.stringify(d.amenities),
      baseRate: pricing.baseRate,
      driverFee: pricing.driverFee,
      mileageFee: pricing.mileageFee,
      additionalFees: pricing.additionalFees,
      discount: pricing.discount,
      taxAmount: pricing.taxAmount,
      subtotal: pricing.subtotal,
      totalPrice: pricing.totalPrice,
      depositAmount: pricing.depositAmount,
      status: "DRAFT",
      validUntil,
      termsText: d.termsText ?? "50% deposit due at booking; remaining balance due 48 hours before service. Cancellations within 72 hours are non-refundable. Gratuity not included.",
      createdById: scope.userId,
    },
  });

  await logActivity({ customerId: d.customerId, leadId: d.leadId, type: "QUOTE_SENT", description: `Quote ${quote.quoteNumber} drafted.`, actorId: scope.userId });
  revalidatePath("/quotes");
  if (d.leadId) revalidatePath(`/leads/${d.leadId}`);
  redirect(`/quotes/${quote.id}`);
}

export async function sendQuoteAction(quoteId: string) {
  const scope = await requireScope();
  const quote = await prisma.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } });

  const template = await prisma.messageTemplate.findUnique({ where: { key: "QUOTE_SENT" } });
  if (template?.active) await sendMessage({ customerId: quote.customerId, leadId: quote.leadId, template });

  await logActivity({ customerId: quote.customerId, leadId: quote.leadId, type: "QUOTE_SENT", description: `Quote ${quote.quoteNumber} sent to client.`, actorId: scope.userId });
  if (quote.leadId) {
    const stage = await prisma.pipelineStage.findFirst({ where: { name: "Quote Sent" } });
    if (stage) await prisma.lead.update({ where: { id: quote.leadId }, data: { stageId: stage.id, stageEnteredAt: new Date() } });
  }
  await runAutomation("QUOTE_SENT", { customerId: quote.customerId, leadId: quote.leadId, actorId: scope.userId });

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  if (quote.leadId) revalidatePath(`/leads/${quote.leadId}`);
}

export async function acceptQuoteAction(quoteId: string) {
  await requireScope();
  await prisma.quote.update({ where: { id: quoteId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
  revalidatePath(`/quotes/${quoteId}`);
}

export async function declineQuoteAction(quoteId: string) {
  await requireScope();
  await prisma.quote.update({ where: { id: quoteId }, data: { status: "DECLINED", respondedAt: new Date() } });
  revalidatePath(`/quotes/${quoteId}`);
}

/** Converts an accepted quote directly into a confirmed booking, carrying
 * every priced line item across. */
export async function convertQuoteToBooking(quoteId: string) {
  const scope = await requireScope();
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) return { error: "Quote not found." };
  if (quote.convertedBookingId) redirect(`/bookings/${quote.convertedBookingId}`);

  const count = await prisma.booking.count();
  const bookingNumber = `SX-${1000 + count + 1}`;

  const booking = await prisma.booking.create({
    data: {
      bookingNumber,
      customerId: quote.customerId,
      leadId: quote.leadId,
      vehicleId: quote.vehicleId,
      driverId: quote.driverId,
      serviceType: quote.serviceType ?? "CHAUFFEURED_TRANSPORTATION",
      pickupAddress: quote.pickupLocation,
      dropoffAddress: quote.dropoffLocation,
      additionalStops: quote.additionalStops,
      date: quote.serviceDate ?? new Date(),
      pickupTime: quote.pickupTime ?? "10:00",
      passengers: 1,
      amenities: quote.amenities,
      baseRate: quote.baseRate,
      driverFee: quote.driverFee,
      mileageFee: quote.mileageFee,
      additionalFees: quote.additionalFees,
      discount: quote.discount,
      taxAmount: quote.taxAmount,
      totalPrice: quote.totalPrice,
      remainingBalance: quote.totalPrice,
      bookingStatus: quote.vehicleId ? "CONFIRMED" : "RESERVED",
      opsStage: "UPCOMING",
    },
  });

  await prisma.quote.update({ where: { id: quoteId }, data: { status: "CONVERTED", convertedBookingId: booking.id } });
  if (quote.vehicleId) await prisma.vehicle.update({ where: { id: quote.vehicleId }, data: { availability: "RESERVED" } });

  if (quote.leadId) {
    const stage = await prisma.pipelineStage.findFirst({ where: { name: "Booked" } });
    await prisma.lead.update({ where: { id: quote.leadId }, data: { status: "BOOKED", bookedAt: new Date(), stageId: stage?.id } });
  }

  await logActivity({ customerId: quote.customerId, leadId: quote.leadId, bookingId: booking.id, type: "BOOKING_CREATED", description: `Quote ${quote.quoteNumber} converted to booking ${booking.bookingNumber}.`, actorId: scope.userId });
  await runAutomation("BOOKING_CONFIRMED", { customerId: quote.customerId, leadId: quote.leadId, bookingId: booking.id, actorId: scope.userId });

  revalidatePath("/quotes");
  revalidatePath("/bookings");
  redirect(`/bookings/${booking.id}`);
}
