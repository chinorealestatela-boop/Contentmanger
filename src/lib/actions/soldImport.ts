"use server";

// Bulk import for the "Sold Customers / Down Payment Report" CSV — creates
// the Customer, Lead (status SOLD), Sale, and PaymentPlan/Payment records
// for each row in one shot, through the same tables and conventions as
// manually working a deal through markSold()/createPaymentPlan() (see
// src/lib/actions/leads.ts and src/lib/actions/payments.ts) — this is a
// bulk on-ramp into the exact same downpayment-tracking feature, not a
// separate system.
//
// Safe to re-run: a vehicle only ever sells once, so a row whose VIN/stock
// number already has a Sale on file doesn't get a second deal created —
// but it still gets a one-time check: if that customer has no First
// Payment on file yet (e.g. they were imported before this field was
// wired up), this run backfills it from the row's lender columns without
// touching anything else about that already-imported deal.

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/phone";
import { getBookingSettings, wallClockInZone } from "@/lib/availability";
import { revalidatePath } from "next/cache";
import { parseSoldCustomersCsv, type ParsedSoldRow } from "@/lib/leads/soldImportParse";

export type SoldImportResult = {
  status: "SUCCESS" | "FAILED";
  totalRows: number;
  imported: number;
  skippedDuplicate: number;
  // Rows whose vehicle already had a sale on file (imported before the
  // First Payment feature existed) where re-running this same CSV was
  // still useful: the customer was missing a First Payment, and this run
  // filled it in from the row's lender columns without touching anything
  // else about that already-imported deal.
  backfilledFirstPayments: number;
  errors: { row: string; reason: string }[];
  unmatchedSalespeople: { row: string; name: string }[];
  // Rows with a First Payment Due Date or Amount on file, but not both —
  // never guessed into a Payment row (see "If uncertain, mark Needs
  // Review — never guess"); surfaced here so Chino can enter it manually.
  missingFirstPaymentInfo: { row: string; reason: string }[];
  errorMessage?: string;
};

const FAILED_STUB: Omit<SoldImportResult, "errorMessage"> = {
  status: "FAILED",
  totalRows: 0,
  imported: 0,
  skippedDuplicate: 0,
  backfilledFirstPayments: 0,
  errors: [],
  unmatchedSalespeople: [],
  missingFirstPaymentInfo: [],
};

const MAX_CSV_BYTES = 5 * 1024 * 1024;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dateOnlyStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Matches "Chinonso S Ugochukwu" against a User's firstName/lastName by
 * comparing only the first and last whitespace-separated tokens — middle
 * initials/names in the report don't need to match the CRM's own name
 * fields exactly. */
function matchSalesperson(name: string | null, users: { id: string; firstName: string; lastName: string }[]): string | null {
  if (!name) return null;
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const first = tokens[0].toLowerCase();
  const last = tokens[tokens.length - 1].toLowerCase();
  return users.find((u) => u.firstName.toLowerCase() === first && u.lastName.toLowerCase() === last)?.id ?? null;
}

/** The report has no sale-price column — this is the closest honest
 * estimate available from it: what the lender funded (if financed) plus
 * the total down payment, or just the down payment for a cash deal. */
function estimateSalePrice(row: ParsedSoldRow): number {
  const base = row.fundedAmount !== null ? row.fundedAmount + row.requiredDownPayment : row.requiredDownPayment;
  return round2(base);
}

type FirstPaymentOutcome = { status: "CREATED" } | { status: "MISSING_INFO"; reason: string } | { status: "SKIPPED_HAS_FIRST" };

/** Creates a First Payment (bank/lender) row from a parsed CSV row, used
 * both for a brand-new import and for backfilling a customer imported
 * before this field existed (see the existingSale branch below) — same
 * never-guess rule either way: only created when BOTH the due date and
 * amount are on file. */
async function createFirstPaymentFromRow(params: {
  row: ParsedSoldRow;
  customerId: string;
  leadId: string | null;
  actorId: string;
  todayStr: string;
}): Promise<FirstPaymentOutcome> {
  const { row, customerId, leadId, actorId, todayStr } = params;
  if (!row.firstPaymentDueDate && row.firstPaymentAmount === null) return { status: "SKIPPED_HAS_FIRST" };
  if (!(row.firstPaymentDueDate && row.firstPaymentAmount !== null)) {
    return {
      status: "MISSING_INFO",
      reason: row.firstPaymentDueDate
        ? "First Payment Due Date is on file but First Payment Amount is missing — not imported, enter it manually on the customer's profile."
        : "First Payment Amount is on file but First Payment Due Date is missing — not imported, enter it manually on the customer's profile.",
    };
  }

  const lenderNoteParts = [
    row.lenderAccountReference ? `Account ref: ${row.lenderAccountReference}` : null,
    row.amountFinanced !== null ? `Amount financed: $${row.amountFinanced.toLocaleString()}` : null,
    row.paymentFrequency ? `Frequency: ${row.paymentFrequency}` : null,
    row.lenderPaymentPhone ? `Lender phone: ${row.lenderPaymentPhone}` : null,
    row.lenderPaymentWebsite ? `Lender website: ${row.lenderPaymentWebsite}` : null,
    row.firstPaymentVerificationStatus ? `Verification: ${row.firstPaymentVerificationStatus}` : null,
  ].filter((v): v is string => Boolean(v));

  await prisma.payment.create({
    data: {
      customerId,
      leadId: leadId ?? undefined,
      paymentType: "FIRST",
      paidToName: row.lienHolder ?? undefined,
      amount: row.firstPaymentAmount,
      dueDate: row.firstPaymentDueDate,
      status: dateOnlyStr(row.firstPaymentDueDate) < todayStr ? "LATE" : "PENDING",
      notes: lenderNoteParts.length > 0 ? lenderNoteParts.join(" | ") : undefined,
    },
  });
  await logActivity({
    customerId,
    leadId: leadId ?? undefined,
    type: "FIRST_PAYMENT_CREATED",
    description: `First bank payment imported: $${row.firstPaymentAmount.toLocaleString()} due ${dateOnlyStr(row.firstPaymentDueDate)}${
      row.lienHolder ? ` to ${row.lienHolder}` : ""
    }.`,
    actorId,
  });
  return { status: "CREATED" };
}

export async function importSoldCustomersCsv(_prev: SoldImportResult | null, formData: FormData): Promise<SoldImportResult> {
  const scope = await requireScope();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...FAILED_STUB, errorMessage: "Choose a CSV file to import first." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { ...FAILED_STUB, errorMessage: `File is too large (${Math.round(file.size / 1024 / 1024)}MB) — max 5MB.` };
  }

  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    return { ...FAILED_STUB, errorMessage: err instanceof Error ? err.message : "Could not read the uploaded file." };
  }

  const { rows, errors: parseErrors } = parseSoldCustomersCsv(text);
  if (rows.length === 0 && parseErrors.length > 0) {
    return { ...FAILED_STUB, errorMessage: parseErrors[0].reason };
  }

  const soldStage = await prisma.pipelineStage.findFirst({ where: { isClosedWon: true } });
  const fallbackStage = soldStage ?? (await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } }));
  if (!fallbackStage) {
    return { ...FAILED_STUB, errorMessage: "Pipeline isn't configured yet — set up stages in Settings first." };
  }

  const [users, bookingSettings] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, firstName: true, lastName: true } }),
    getBookingSettings(),
  ]);
  const todayStr = wallClockInZone(new Date(), bookingSettings.timezone).dateStr;

  const errors = [...parseErrors];
  const unmatchedSalespeople: { row: string; name: string }[] = [];
  const missingFirstPaymentInfo: { row: string; reason: string }[] = [];
  let imported = 0;
  let skippedDuplicate = 0;
  let backfilledFirstPayments = 0;

  for (const row of rows) {
    try {
      // Vehicle: match by VIN first, then stock number — same priority
      // order as the inventory sync engine (src/lib/inventory/engine.ts).
      let vehicle = await prisma.vehicle.findUnique({ where: { vin: row.vin } });
      if (!vehicle) {
        const byStock = await prisma.vehicle.findUnique({ where: { stockNumber: row.stockNumber } });
        if (byStock && byStock.vin !== row.vin) {
          errors.push({ row: row.rowLabel, reason: `Stock #${row.stockNumber} already belongs to a different VIN on file — skipped, check manually.` });
          continue;
        }
        vehicle = byStock;
      }

      if (vehicle) {
        const existingSale = await prisma.sale.findFirst({ where: { vehicleId: vehicle.id } });
        if (existingSale) {
          skippedDuplicate++;
          // Backfill: this deal was already imported (likely before the
          // First Payment feature existed, or just without this field),
          // but the row sitting right here still has the lender info —
          // if that customer has no First Payment on file yet, add it
          // now. Nothing else about the existing deal is touched.
          const hasFirstPayment = await prisma.payment.findFirst({
            where: { customerId: existingSale.customerId, paymentType: "FIRST" },
            select: { id: true },
          });
          if (!hasFirstPayment) {
            const outcome = await createFirstPaymentFromRow({
              row,
              customerId: existingSale.customerId,
              leadId: existingSale.leadId,
              actorId: scope.userId,
              todayStr,
            });
            if (outcome.status === "CREATED") backfilledFirstPayments++;
            else if (outcome.status === "MISSING_INFO") missingFirstPaymentInfo.push({ row: row.rowLabel, reason: outcome.reason });
          }
          continue;
        }
      }

      const salePrice = estimateSalePrice(row);

      if (!vehicle) {
        vehicle = await prisma.vehicle.create({
          data: {
            stockNumber: row.stockNumber,
            vin: row.vin,
            year: row.vehicleYear,
            make: row.vehicleMake,
            model: row.vehicleModel,
            condition: "USED",
            status: "SOLD",
            source: "MANUAL",
            sellingPrice: salePrice,
          },
        });
      } else if (vehicle.status !== "SOLD") {
        vehicle = await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: "SOLD" } });
      }

      // Customer: match an existing record by phone or email (e.g. a
      // repeat customer, or one who already came through the booking
      // site) rather than creating a duplicate.
      const phone = row.phone ? normalizePhone(row.phone) : null;
      const email = row.email?.trim().toLowerCase() || null;
      let customer = phone ? await prisma.customer.findFirst({ where: { phone } }) : null;
      if (!customer && email) {
        const candidates = await prisma.customer.findMany({ where: { email: { not: null } }, select: { id: true, email: true } });
        const match = candidates.find((c) => c.email?.toLowerCase() === email);
        if (match) customer = await prisma.customer.findUnique({ where: { id: match.id } });
      }

      const salespersonId = matchSalesperson(row.primarySalesperson, users);
      if (row.primarySalesperson && !salespersonId) {
        unmatchedSalespeople.push({ row: row.rowLabel, name: row.primarySalesperson });
      }
      const ownerId = salespersonId ?? scope.userId;

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            firstName: row.firstName,
            lastName: row.lastName || row.firstName,
            phone: phone ?? undefined,
            email: email ?? undefined,
            ownerId,
          },
        });
      }

      const salesNotesParts = [
        row.paymentNotes,
        row.dealVerificationStatus ? `Deal verification: ${row.dealVerificationStatus}` : null,
        row.missingInformation ? `Missing info flagged on report: ${row.missingInformation}` : null,
      ].filter((v): v is string => Boolean(v));

      const lead = await prisma.lead.create({
        data: {
          customerId: customer.id,
          assigneeId: ownerId,
          stageId: fallbackStage.id,
          status: "SOLD",
          soldAt: row.transactionDate,
          financeType: row.financeType,
          downPayment: row.requiredDownPayment,
          salesNotes: salesNotesParts.length > 0 ? salesNotesParts.join(" | ") : undefined,
        },
      });

      await prisma.sale.create({
        data: {
          customerId: customer.id,
          leadId: lead.id,
          vehicleId: vehicle.id,
          salePrice,
          financeType: row.financeType,
          saleDate: row.transactionDate,
          salespersonId: ownerId,
          notes:
            "Imported from the Sold Customers / Down Payment report. Sale price is an ESTIMATE (funded amount + total down payment) — " +
            "this report doesn't export an exact sale price; verify against DealerCenter if it matters for reporting.",
        },
      });

      const planNotesParts = [row.paymentNotes, row.additionalScheduleRaw ? `Additional payment note: ${row.additionalScheduleRaw}` : null].filter(
        (v): v is string => Boolean(v)
      );
      const plan = await prisma.paymentPlan.create({
        data: {
          customerId: customer.id,
          leadId: lead.id,
          totalRequired: row.requiredDownPayment,
          amountPaidUpfront: row.amountPaid,
          status: row.remainingBalance <= 0 ? "COMPLETED" : "ACTIVE",
          notes: planNotesParts.length > 0 ? planNotesParts.join(" | ") : undefined,
          createdById: scope.userId,
        },
      });

      if (row.remainingBalance > 0) {
        const scheduled: { amount: number; dueDate: Date }[] = [];
        if (row.nextPaymentDate) scheduled.push({ amount: row.nextPaymentAmount ?? row.remainingBalance, dueDate: row.nextPaymentDate });
        if (row.additionalPayment) scheduled.push(row.additionalPayment);
        if (scheduled.length === 0) {
          // Balance owed but no due date was on the report — schedule it
          // against the transaction date so it surfaces for someone to
          // fix instead of silently disappearing.
          scheduled.push({ amount: row.remainingBalance, dueDate: row.transactionDate });
        }
        for (const s of scheduled) {
          await prisma.payment.create({
            data: {
              planId: plan.id,
              customerId: customer.id,
              leadId: lead.id,
              amount: s.amount,
              dueDate: s.dueDate,
              status: dateOnlyStr(s.dueDate) < todayStr ? "LATE" : "PENDING",
            },
          });
        }
      }

      // First Payment (bank/lender) — only created when BOTH the due date
      // and amount are on file; never guessed from one alone (see "If
      // uncertain, mark Needs Review — never guess"). This is intentionally
      // separate from the Pick Payment schedule above: it's money owed to
      // the lender, not the dealership (see soldImportParse.ts header).
      const firstPaymentOutcome = await createFirstPaymentFromRow({ row, customerId: customer.id, leadId: lead.id, actorId: scope.userId, todayStr });
      if (firstPaymentOutcome.status === "MISSING_INFO") missingFirstPaymentInfo.push({ row: row.rowLabel, reason: firstPaymentOutcome.reason });

      await logActivity({
        customerId: customer.id,
        leadId: lead.id,
        type: "LEAD_CREATED",
        description: `Sold lead imported from Down Payment report — ${row.vehicleYear} ${row.vehicleMake} ${row.vehicleModel}.`,
        actorId: scope.userId,
      });
      await logActivity({
        customerId: customer.id,
        leadId: lead.id,
        type: "SOLD",
        description: `Deal imported — sale price $${salePrice.toLocaleString()} (estimated).`,
        actorId: scope.userId,
      });
      await logActivity({
        customerId: customer.id,
        leadId: lead.id,
        type: "PAYMENT_PLAN_CREATED",
        description: `Down payment schedule imported: $${row.requiredDownPayment.toLocaleString()} required, $${row.amountPaid.toLocaleString()} paid.`,
        actorId: scope.userId,
        metadata: { planId: plan.id },
      });

      imported++;
    } catch (err) {
      errors.push({ row: row.rowLabel, reason: err instanceof Error ? err.message : "Unknown error." });
    }
  }

  revalidatePath("/sold-leads");
  revalidatePath("/leads");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/calendar");
  revalidatePath("/vehicles");

  return { status: "SUCCESS", totalRows: rows.length, imported, skippedDuplicate, backfilledFirstPayments, errors, unmatchedSalespeople, missingFirstPaymentInfo };
}
