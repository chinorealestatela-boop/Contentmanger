// Pure parser for the "Sold Customers / Down Payment Report" CSV export
// (DealerCenter, via Chino's own report — column names match exactly what
// that report produces). No prisma import here on purpose, same reasoning
// as src/lib/inventory/csvImport.ts: this file is safe to unit-test/run
// standalone, and the DB-writing half lives separately in
// src/lib/actions/soldImport.ts.

import { parseCsv, normalizeHeader } from "@/lib/csv";

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["firstname"],
  lastName: ["lastname"],
  fullName: ["fullname"],
  phone: ["phonenumber", "phone"],
  email: ["emailaddress", "email"],
  primarySalesperson: ["primarysalesperson"],
  vehicleYear: ["vehicleyear"],
  vehicleMake: ["vehiclemake"],
  vehicleModel: ["vehiclemodel"],
  vin: ["vin"],
  stockNumber: ["stocknumber"],
  transactionDate: ["transactiondate"],
  requiredDownPayment: ["requireddownpayment"],
  amountPaid: ["amountpaid"],
  remainingBalance: ["remainingdownpaymentbalance"],
  downPaymentStatus: ["downpaymentstatus"],
  nextPaymentDate: ["nextpaymentdate"],
  nextPaymentAmount: ["nextpaymentamount"],
  additionalSchedule: ["additionalpaymentschedule"],
  paymentNotes: ["paymentnotes"],
};

const REQUIRED_FIELDS = ["vin", "stockNumber", "vehicleYear", "vehicleMake", "vehicleModel", "requiredDownPayment", "amountPaid"];

function buildHeaderIndex(headerRow: string[]): Record<string, number> {
  const normalized = headerRow.map(normalizeHeader);
  const index: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const col = normalized.findIndex((h) => aliases.includes(h));
    if (col !== -1) index[field] = col;
  }
  return index;
}

function cell(row: string[], index: Record<string, number>, field: string): string | null {
  const col = index[field];
  if (col === undefined) return null;
  const v = row[col]?.trim();
  return v && v.length > 0 ? v : null;
}

function parseMoney(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** MM/DD/YYYY → local-midnight Date. Returns null for blank/unparseable
 * input rather than guessing — a missing due date should surface as
 * missing, never silently become "today". */
function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Funded $13,927.46 (08/20/2026)" → 13927.46. This is the amount the
 * lender paid the dealer — added to the total down payment, it's the
 * closest estimate of the real deal price this report gives us (the
 * report itself has no sale-price column). Returns null for a cash deal
 * with no financing (no "Funded" line at all). */
function extractFundedAmount(notes: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/Funded\s+\$([\d,]+\.\d{2})/i);
  return m ? parseMoney(m[1]) : null;
}

function extractFinanceType(notes: string | null): "CASH" | "FINANCE" {
  if (notes && /full cash purchase|no financing/i.test(notes)) return "CASH";
  return "FINANCE"; // covers "Financed - <lender>" and "BHPH account" (dealer-financed)
}

/** "$300.00 due 09/23/2026" → {amount, dueDate}. The Additional Payment
 * Schedule column sometimes instead reads like "Additional $400.00
 * deferred down payment remaining after 09/18/2026 installment (exact
 * future date not yet posted in system)" — no firm date, so this
 * deliberately returns null rather than guessing one; the raw text is
 * kept for the plan's notes instead. */
function extractAdditionalSchedule(v: string | null): { amount: number; dueDate: Date } | null {
  if (!v) return null;
  const m = v.match(/\$([\d,]+\.\d{2})\s+due\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (!m) return null;
  const amount = parseMoney(m[1]);
  const dueDate = parseDate(m[2]);
  return amount !== null && dueDate ? { amount, dueDate } : null;
}

export type ParsedSoldRow = {
  rowLabel: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  primarySalesperson: string | null;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string; // model+trim+body style as one string — see header comment in soldImport.ts for why this isn't split further
  vin: string;
  stockNumber: string;
  transactionDate: Date;
  requiredDownPayment: number;
  amountPaid: number;
  remainingBalance: number;
  fundedAmount: number | null;
  financeType: "CASH" | "FINANCE";
  nextPaymentDate: Date | null;
  nextPaymentAmount: number | null;
  additionalPayment: { amount: number; dueDate: Date } | null;
  additionalScheduleRaw: string | null; // kept when it didn't parse to a firm amount+date
  paymentNotes: string | null;
};

export type SoldImportParseResult = {
  rows: ParsedSoldRow[];
  errors: { row: string; reason: string }[];
};

/** Splits "Full Name" into first/last when the First Name / Last Name
 * columns are blank (real case in this report: a business/commercial
 * buyer with a company name and no individual name on file). Everything
 * but the last whitespace-separated token becomes the first name so the
 * two fields reconstruct back to the original full name. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export function parseSoldCustomersCsv(text: string): SoldImportParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rows: [], errors: [{ row: "(file)", reason: "The file is empty." }] };

  const [headerRow, ...dataRows] = rows;
  const index = buildHeaderIndex(headerRow);

  const missing = REQUIRED_FIELDS.filter((f) => index[f] === undefined);
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ row: "(file)", reason: `Missing expected column(s): ${missing.join(", ")}. Found headers: ${headerRow.join(", ") || "(none)"}.` }],
    };
  }

  const parsed: ParsedSoldRow[] = [];
  const errors: { row: string; reason: string }[] = [];

  for (const [i, row] of dataRows.entries()) {
    const rowLabel = `row ${i + 2}`; // +2: 1-indexed, plus the header row
    if (row.every((c) => c.trim() === "")) continue;

    const vin = cell(row, index, "vin");
    const stockNumber = cell(row, index, "stockNumber");
    if (!vin || !stockNumber) {
      errors.push({ row: rowLabel, reason: "Missing VIN or Stock Number — can't identify this vehicle." });
      continue;
    }

    const yearRaw = cell(row, index, "vehicleYear");
    const vehicleYear = yearRaw ? Number(yearRaw.replace(/[^0-9]/g, "")) : NaN;
    const vehicleMake = cell(row, index, "vehicleMake");
    const vehicleModel = cell(row, index, "vehicleModel");
    if (!Number.isFinite(vehicleYear) || vehicleYear < 1900 || !vehicleMake || !vehicleModel) {
      errors.push({ row: rowLabel, reason: "Missing or invalid Vehicle Year/Make/Model." });
      continue;
    }

    let firstName = cell(row, index, "firstName") ?? "";
    let lastName = cell(row, index, "lastName") ?? "";
    if (!firstName && !lastName) {
      const fullName = cell(row, index, "fullName");
      if (fullName) {
        const split = splitFullName(fullName);
        firstName = split.firstName;
        lastName = split.lastName;
      }
    }
    if (!firstName && !lastName) {
      errors.push({ row: rowLabel, reason: "No customer name on file (First/Last/Full Name all blank)." });
      continue;
    }

    const transactionDate = parseDate(cell(row, index, "transactionDate"));
    if (!transactionDate) {
      errors.push({ row: rowLabel, reason: "Missing or unparseable Transaction Date." });
      continue;
    }

    const requiredDownPayment = parseMoney(cell(row, index, "requiredDownPayment"));
    const amountPaid = parseMoney(cell(row, index, "amountPaid"));
    if (requiredDownPayment === null || amountPaid === null) {
      errors.push({ row: rowLabel, reason: "Missing or unparseable Required Down Payment / Amount Paid." });
      continue;
    }
    const remainingBalanceCell = parseMoney(cell(row, index, "remainingBalance"));
    const remainingBalance = remainingBalanceCell ?? Math.max(0, requiredDownPayment - amountPaid);

    const paymentNotes = cell(row, index, "paymentNotes");
    const additionalRaw = cell(row, index, "additionalSchedule");
    const additionalPayment = extractAdditionalSchedule(additionalRaw);

    parsed.push({
      rowLabel,
      firstName,
      lastName,
      phone: cell(row, index, "phone"),
      email: cell(row, index, "email"),
      primarySalesperson: cell(row, index, "primarySalesperson"),
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vin,
      stockNumber,
      transactionDate,
      requiredDownPayment,
      amountPaid,
      remainingBalance,
      fundedAmount: extractFundedAmount(paymentNotes),
      financeType: extractFinanceType(paymentNotes),
      nextPaymentDate: parseDate(cell(row, index, "nextPaymentDate")),
      nextPaymentAmount: parseMoney(cell(row, index, "nextPaymentAmount")),
      additionalPayment,
      additionalScheduleRaw: additionalRaw && !additionalPayment ? additionalRaw : null,
      paymentNotes,
    });
  }

  return { rows: parsed, errors };
}
