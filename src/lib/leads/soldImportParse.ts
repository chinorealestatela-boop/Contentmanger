// Pure parser for TWO CSV export shapes Chino's reports come in. No prisma
// import here on purpose, same reasoning as src/lib/inventory/csvImport.ts:
// this file is safe to unit-test/run standalone, and the DB-writing half
// lives separately in src/lib/actions/soldImport.ts.
//
// 1. "Sold Customers / Down Payment Report" (DealerCenter) — the original
//    format this parser was built for: explicit Required Down Payment +
//    Amount Paid columns, a Next Payment Date/Amount pair specifically for
//    the remaining down-payment installment.
// 2. "SOLD CUSTOMER AUDIT" — a richer, Transaction_ID-keyed export with a
//    single Down_Payment column (no separate required/paid split), a real
//    Selling_Price, VIN/stock/trim/mileage, co-buyer and secondary-phone
//    columns, and loan/lender detail (Lien_Holder, Amount_Financed,
//    First_Payment_Due_Date/Amount, verification-status columns). Detected
//    per-file by which money columns are actually present (never both
//    shapes in the same file), not by a format flag — same header-alias
//    approach as the first format, just with more aliases.
//
// IMPORTANT distinction the audit format requires getting right:
// First_Payment_Due_Date/Amount is the customer's first LOAN payment to
// their lender (Westlake, Credit Acceptance, a credit union, ...) — money
// owed to the BANK, never to this dealership. It must never be imported as
// a Pick Payment (this CRM's down-payment-collection tracker) or it would
// show the dealership as owed money it was never owed. It's carried
// through as reference notes on the Sale instead — see soldImport.ts.

import { parseCsv, normalizeHeader } from "@/lib/csv";

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["firstname", "customerfirstname"],
  lastName: ["lastname", "customerlastname"],
  fullName: ["fullname", "customerfullname"],
  phone: ["phonenumber", "phone", "primaryphone"],
  secondaryPhone: ["secondaryphone"],
  email: ["emailaddress", "email"],
  coBuyerName: ["cobuyername"],
  primarySalesperson: ["primarysalesperson", "salesperson"],
  vehicleYear: ["vehicleyear"],
  vehicleMake: ["vehiclemake"],
  vehicleModel: ["vehiclemodel"],
  vehicleTrim: ["vehicletrim"],
  vin: ["vin"],
  stockNumber: ["stocknumber"],
  mileage: ["mileage"],
  transactionDate: ["transactiondate", "saledate"],
  // Format 1 only — explicit required-vs-collected split.
  requiredDownPayment: ["requireddownpayment"],
  amountPaid: ["amountpaid"],
  remainingBalance: ["remainingdownpaymentbalance"],
  downPaymentStatus: ["downpaymentstatus"],
  nextPaymentDate: ["nextpaymentdate"],
  nextPaymentAmount: ["nextpaymentamount"],
  additionalSchedule: ["additionalpaymentschedule"],
  // Format 2 only — a single collected-at-signing figure; any remaining
  // deferred amount, if mentioned at all, is free text in the audit notes
  // (see extractDeferredDownPayment below), not its own column.
  downPayment: ["downpayment"],
  reportedSellingPrice: ["sellingprice"],
  financingTypeRaw: ["financingtype"],
  // Format 2 loan/lender reference info — never down-payment tracking,
  // see header comment above. Carried through as notes only.
  lienHolder: ["lienholder"],
  lenderAccountReference: ["lenderaccountreference"],
  contractDate: ["contractdate"],
  amountFinanced: ["amountfinanced"],
  firstPaymentDueDate: ["firstpaymentduedate"],
  firstPaymentAmount: ["firstpaymentamount"],
  paymentFrequency: ["paymentfrequency"],
  lenderPaymentPhone: ["lenderpaymentphone"],
  lenderPaymentWebsite: ["lenderpaymentwebsite"],
  firstPaymentVerificationStatus: ["firstpaymentverificationstatus"],
  dealVerificationStatus: ["dealverificationstatus"],
  missingInformation: ["missinginformation"],
  // paymentNotes carries either format's free-text notes column — same
  // target field so every downstream use (deferred-amount extraction,
  // CASH/FINANCE detection, notes concatenation) works for both.
  paymentNotes: ["paymentnotes", "auditnotes"],
};

const REQUIRED_FIELDS = ["vin", "stockNumber", "vehicleYear", "vehicleMake", "vehicleModel"];

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The audit report sometimes puts a placeholder like "MISSING - NEEDS
 * REVIEW" directly in a text cell (seen in Lien_Holder) instead of
 * leaving it blank — treat that the same as no value on file rather than
 * storing it as if it were a real name. */
function cleanPlaceholder(v: string | null): string | null {
  if (!v) return null;
  return /^(missing|unknown|n\/?a|tbd)\b/i.test(v.trim()) ? null : v;
}

/** MM/DD/YYYY or YYYY-MM-DD → local-midnight Date (format 1 uses the
 * former, format 2 the latter). Returns null for blank/unparseable input
 * rather than guessing — a missing due date should surface as missing,
 * never silently become "today". */
function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const t = v.trim();
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
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

/** Format 2's explicit Financing_Type column ("Retail Installment Contract
 * (third-party lender)", "Buy-Here-Pay-Here", "Other - NEEDS REVIEW", ...)
 * is more reliable than scraping free-text notes for it — use it directly
 * when the column is present. Only an explicit "cash" mention counts as
 * CASH; everything else (including an ambiguous "Other - NEEDS REVIEW"
 * row — its own ambiguity gets preserved in notes, never silently
 * resolved here) is treated as FINANCE, same default format 1 uses. */
function financeTypeFromColumn(raw: string | null): "CASH" | "FINANCE" | null {
  if (!raw) return null;
  return /cash/i.test(raw) ? "CASH" : "FINANCE";
}

/** Format 2 has no structured "remaining balance" column — a deferred
 * portion of the down payment only shows up as free text in the audit
 * notes, e.g. "Deferred down payment $500.00". Extracts just the amount;
 * never a due date (none is ever given alongside it in this report), so
 * the caller schedules it the same no-known-date way format 1's balance
 * already falls back to (see soldImport.ts) rather than inventing one. */
function extractDeferredDownPayment(notes: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/deferred\s+down\s+payment\s+\$?([\d,]+\.?\d*)/i);
  return m ? parseMoney(m[1]) : null;
}

/** "Veronica Perez Rubio (co-buyer phone (725) 310-9427)" → name with the
 * parenthetical stripped, plus the phone extracted separately (there's no
 * dedicated co-buyer-phone column, so it only ever shows up embedded in
 * this one like this). Returns the plain name unchanged, phone null, when
 * there's no parenthetical to begin with. */
function splitCoBuyerNamePhone(raw: string | null): { name: string | null; phone: string | null } {
  if (!raw) return { name: null, phone: null };
  const m = raw.match(/^(.*?)\s*\(co-buyer phone\s*(.+?)\)\s*$/i);
  if (!m) return { name: raw.trim() || null, phone: null };
  return { name: m[1].trim() || null, phone: m[2].trim() || null };
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
  secondaryPhone: string | null; // format 2 only — no dedicated Customer field, carried as a note
  email: string | null;
  coBuyerName: string | null;
  coBuyerPhone: string | null; // extracted out of Co_Buyer_Name's parenthetical, no dedicated column
  primarySalesperson: string | null;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string; // model+trim+body style as one string — see header comment in soldImport.ts for why this isn't split further
  mileage: number | null;
  vin: string;
  stockNumber: string;
  transactionDate: Date;
  requiredDownPayment: number;
  amountPaid: number;
  remainingBalance: number;
  fundedAmount: number | null;
  reportedSellingPrice: number | null; // format 2's actual Selling_Price — when present, strictly better than estimateSalePrice()'s guess (see soldImport.ts)
  financeType: "CASH" | "FINANCE";
  nextPaymentDate: Date | null;
  nextPaymentAmount: number | null;
  additionalPayment: { amount: number; dueDate: Date } | null;
  additionalScheduleRaw: string | null; // kept when it didn't parse to a firm amount+date
  paymentNotes: string | null;
  // Format 2 loan/lender reference fields — informational only, never a
  // Pick Payment (see the file header comment for why). soldImport.ts
  // folds whichever of these are present into the Sale's notes.
  lienHolder: string | null;
  lenderAccountReference: string | null;
  contractDate: Date | null;
  amountFinanced: number | null;
  firstPaymentDueDate: Date | null;
  firstPaymentAmount: number | null;
  paymentFrequency: string | null;
  lenderPaymentPhone: string | null;
  lenderPaymentWebsite: string | null;
  firstPaymentVerificationStatus: string | null;
  dealVerificationStatus: string | null;
  missingInformation: string | null;
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
  // Exactly one of the two money-column shapes must be present (see the
  // file header comment) — format 1's explicit Required Down Payment, or
  // format 2's single Down Payment column.
  if (index.requiredDownPayment === undefined && index.downPayment === undefined) {
    return {
      rows: [],
      errors: [{ row: "(file)", reason: `Missing a down payment column — expected "Required Down Payment" or "Down Payment". Found headers: ${headerRow.join(", ") || "(none)"}.` }],
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
    let vehicleModel = cell(row, index, "vehicleModel");
    if (!Number.isFinite(vehicleYear) || vehicleYear < 1900 || !vehicleMake || !vehicleModel) {
      errors.push({ row: rowLabel, reason: "Missing or invalid Vehicle Year/Make/Model." });
      continue;
    }
    const vehicleTrim = cell(row, index, "vehicleTrim");
    if (vehicleTrim) vehicleModel = `${vehicleModel} ${vehicleTrim}`;
    const mileageRaw = cell(row, index, "mileage");
    const mileage = mileageRaw ? Number(mileageRaw.replace(/[^0-9]/g, "")) : null;

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

    const paymentNotes = cell(row, index, "paymentNotes");

    // Money columns: format 1 gives required/paid directly; format 2 gives
    // one collected-at-signing figure, with any deferred remainder (if
    // mentioned at all) only in the notes — see the file header comment.
    let requiredDownPayment: number | null;
    let amountPaid: number | null;
    if (index.requiredDownPayment !== undefined) {
      requiredDownPayment = parseMoney(cell(row, index, "requiredDownPayment"));
      amountPaid = parseMoney(cell(row, index, "amountPaid"));
    } else {
      const collected = parseMoney(cell(row, index, "downPayment"));
      const deferred = extractDeferredDownPayment(paymentNotes);
      amountPaid = collected;
      requiredDownPayment = collected !== null ? round2(collected + (deferred ?? 0)) : null;
    }
    if (requiredDownPayment === null || amountPaid === null) {
      errors.push({ row: rowLabel, reason: "Missing or unparseable down payment amount." });
      continue;
    }
    const remainingBalanceCell = parseMoney(cell(row, index, "remainingBalance"));
    const remainingBalance = remainingBalanceCell ?? Math.max(0, requiredDownPayment - amountPaid);

    const additionalRaw = cell(row, index, "additionalSchedule");
    const additionalPayment = extractAdditionalSchedule(additionalRaw);

    const financingTypeRaw = cell(row, index, "financingTypeRaw");
    const coBuyer = splitCoBuyerNamePhone(cell(row, index, "coBuyerName"));

    parsed.push({
      rowLabel,
      firstName,
      lastName,
      phone: cell(row, index, "phone"),
      secondaryPhone: cell(row, index, "secondaryPhone"),
      email: cell(row, index, "email"),
      coBuyerName: coBuyer.name,
      coBuyerPhone: coBuyer.phone,
      primarySalesperson: cell(row, index, "primarySalesperson"),
      vehicleYear,
      vehicleMake,
      vehicleModel,
      mileage,
      vin,
      stockNumber,
      transactionDate,
      requiredDownPayment,
      amountPaid,
      remainingBalance,
      fundedAmount: extractFundedAmount(paymentNotes),
      reportedSellingPrice: parseMoney(cell(row, index, "reportedSellingPrice")),
      financeType: financeTypeFromColumn(financingTypeRaw) ?? extractFinanceType(paymentNotes),
      nextPaymentDate: parseDate(cell(row, index, "nextPaymentDate")),
      nextPaymentAmount: parseMoney(cell(row, index, "nextPaymentAmount")),
      additionalPayment,
      additionalScheduleRaw: additionalRaw && !additionalPayment ? additionalRaw : null,
      paymentNotes: financingTypeRaw ? [financingTypeRaw, paymentNotes].filter(Boolean).join(" | ") : paymentNotes,
      lienHolder: cleanPlaceholder(cell(row, index, "lienHolder")),
      lenderAccountReference: cell(row, index, "lenderAccountReference"),
      contractDate: parseDate(cell(row, index, "contractDate")),
      amountFinanced: parseMoney(cell(row, index, "amountFinanced")),
      firstPaymentDueDate: parseDate(cell(row, index, "firstPaymentDueDate")),
      firstPaymentAmount: parseMoney(cell(row, index, "firstPaymentAmount")),
      paymentFrequency: cell(row, index, "paymentFrequency"),
      lenderPaymentPhone: cell(row, index, "lenderPaymentPhone"),
      lenderPaymentWebsite: cell(row, index, "lenderPaymentWebsite"),
      firstPaymentVerificationStatus: cell(row, index, "firstPaymentVerificationStatus"),
      dealVerificationStatus: cell(row, index, "dealVerificationStatus"),
      missingInformation: cell(row, index, "missingInformation"),
    });
  }

  return { rows: parsed, errors };
}
