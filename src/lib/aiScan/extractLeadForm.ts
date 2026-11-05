// AI Lead Scanner — reads a photo of a physical dealership lead form and
// extracts it into the shape the CRM's own lead-intake fields already use
// (see src/lib/actions/leads.ts's intakeSchema), so the review screen can
// hand the result straight to createLead with no separate mapping step.
//
// There is deliberately no "simulated" fallback the way src/lib/sms/
// provider.ts has one for Twilio: simulating SMS just logs a message that
// never had real content to get wrong, but simulating OCR would mean
// inventing a customer's name, phone number, or payment amount, which is
// exactly what this feature must never do (see "never automatically
// invent missing information" in the feature spec). Without
// ANTHROPIC_API_KEY configured, every call fails closed with a clear
// "not configured" result instead.
//
// The field-mapping "template" isn't a rigid set of pixel coordinates —
// coordinates break the moment the photo is rotated, cropped differently,
// or lit differently, which the spec explicitly requires this feature to
// tolerate. Instead the template lives in SYSTEM_PROMPT below: a precise,
// section-by-section description of the dealership's actual "Down Payment
// Agreement" form (calibrated against a real reference photo) that a
// vision model applies the same way a person would, which is robust to
// exactly the kind of variation (rotation, lighting, handwriting, camera/
// phone) a fixed coordinate grid is not.

import Anthropic from "@anthropic-ai/sdk";

export function isAiScanConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type PickPaymentExtract = {
  amount: number | null;
  dueDate: string | null; // ISO yyyy-mm-dd
  kind: "DEPOSIT" | "REMAINING_DOWN_PAYMENT" | "OTHER" | null;
  description: string | null;
};

export type ExtractedLeadForm = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  preferredContactMethod: "PHONE" | "TEXT" | "EMAIL" | null;

  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleStockNumber: string | null;

  financeType: "CASH" | "FINANCE" | "LEASE" | null;
  desiredPayment: number | null;
  downPayment: number | null;

  hasTrade: boolean;
  tradeYear: number | null;
  tradeMake: string | null;
  tradeModel: string | null;

  initialPaymentToday: number | null;
  pickPayments: PickPaymentExtract[];

  salespersonName: string | null;
  appointmentDate: string | null; // ISO yyyy-mm-dd
  appointmentTime: string | null; // HH:mm, 24h

  salesNotes: string | null;
  otherCheckedOptions: string[]; // any checkbox/selection the model noticed that doesn't map to a field above, verbatim as printed on the form

  lowConfidenceFields: string[]; // keys from this same object the model wasn't confident about
  imageQuality: "ok" | "blurry" | "incomplete" | "unreadable";
  qualityNotes: string | null;
};

export type ExtractResult = { ok: true; data: ExtractedLeadForm } | { ok: false; error: string };

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extracted_lead_form",
  description: "Record every field read off the dealership lead form photo, exactly as instructed.",
  input_schema: {
    type: "object",
    properties: {
      firstName: { type: ["string", "null"] },
      lastName: { type: ["string", "null"] },
      phone: { type: ["string", "null"], description: "Digits only or standard formatting, as written." },
      email: { type: ["string", "null"] },
      address: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      state: { type: ["string", "null"] },
      zip: { type: ["string", "null"] },
      preferredContactMethod: { type: ["string", "null"], enum: ["PHONE", "TEXT", "EMAIL", null] },

      vehicleYear: { type: ["integer", "null"] },
      vehicleMake: { type: ["string", "null"] },
      vehicleModel: { type: ["string", "null"] },
      vehicleTrim: { type: ["string", "null"] },
      vehicleStockNumber: { type: ["string", "null"] },

      financeType: { type: ["string", "null"], enum: ["CASH", "FINANCE", "LEASE", null] },
      desiredPayment: { type: ["number", "null"] },
      downPayment: { type: ["number", "null"] },

      hasTrade: { type: "boolean" },
      tradeYear: { type: ["integer", "null"] },
      tradeMake: { type: ["string", "null"] },
      tradeModel: { type: ["string", "null"] },

      initialPaymentToday: { type: ["number", "null"], description: "Amount collected today/upfront, if the form distinguishes it from a future payment." },
      pickPayments: {
        type: "array",
        description: "One entry per distinct future payment amount + due date written on the form. Empty array if none.",
        items: {
          type: "object",
          properties: {
            amount: { type: ["number", "null"] },
            dueDate: { type: ["string", "null"], description: "ISO yyyy-mm-dd. Null if a date is written but you cannot confidently resolve it." },
            kind: { type: ["string", "null"], enum: ["DEPOSIT", "REMAINING_DOWN_PAYMENT", "OTHER", null] },
            description: { type: ["string", "null"], description: "Any handwritten note tied to this specific payment." },
          },
          required: ["amount", "dueDate", "kind", "description"],
        },
      },

      salespersonName: { type: ["string", "null"] },
      appointmentDate: { type: ["string", "null"], description: "ISO yyyy-mm-dd" },
      appointmentTime: { type: ["string", "null"], description: "24h HH:mm" },

      salesNotes: { type: ["string", "null"], description: "Any handwritten comments/notes on the form not already captured in a specific field above." },
      otherCheckedOptions: { type: "array", items: { type: "string" }, description: "Any checkbox or multiple-choice option on the form that is marked/selected and doesn't correspond to a field above, written verbatim." },

      lowConfidenceFields: { type: "array", items: { type: "string" }, description: "Property names from this same object where the handwriting was ambiguous or you are not confident in the value you gave. Do not include a field here if you left it null — null already means 'not found'." },
      imageQuality: { type: "string", enum: ["ok", "blurry", "incomplete", "unreadable"] },
      qualityNotes: { type: ["string", "null"], description: "If imageQuality isn't 'ok', briefly say why (e.g. 'bottom third of the form is cut off', 'flash glare over the payment section')." },
    },
    required: [
      "firstName", "lastName", "phone", "email", "address", "city", "state", "zip", "preferredContactMethod",
      "vehicleYear", "vehicleMake", "vehicleModel", "vehicleTrim", "vehicleStockNumber",
      "financeType", "desiredPayment", "downPayment",
      "hasTrade", "tradeYear", "tradeMake", "tradeModel",
      "initialPaymentToday", "pickPayments",
      "salespersonName", "appointmentDate", "appointmentTime",
      "salesNotes", "otherCheckedOptions",
      "lowConfidenceFields", "imageQuality", "qualityNotes",
    ],
  },
};

// Calibrated against H&H Auto Sales' actual "Down Payment Agreement" form
// (reference photo provided 2026-11-05). That form is narrower than a
// general lead-intake sheet — it's a post-sale document formalizing a
// deferred-down-payment arrangement, not something filled out at first
// contact — so it has no salesperson, email, financing-type, or
// appointment fields at all. That's expected for this form, not a
// scanning failure: those fields should simply come back null. If a
// different, earlier-stage lead-intake sheet ever gets scanned instead,
// the general field descriptions after this form's own section still
// apply, as a fallback.
const SYSTEM_PROMPT = `You read photos of dealership paperwork (primarily "Down Payment Agreement" forms from H&H Auto Sales, but possibly other lead/deal forms) and extract them into structured data for a CRM.

Rules, in order of importance:
1. Never invent or guess a value. If a field is blank, illegible, or not present on the form, its value is null (or false for hasTrade, or [] for the array fields) — not a plausible-sounding guess.
2. If you can read a field but aren't confident you read it correctly (ambiguous handwriting, a smudged digit, a date that could be two different months, a crossed-out/corrected figure, or two fields on the form that don't reconcile with each other), still report your best reading as the value, but add that field's name to lowConfidenceFields and explain the ambiguity in qualityNotes so a human can double-check it. Do not leave it null just because you're unsure — null specifically means "nothing is there."
3. Dollar amounts: strip "$" and commas, return a plain number.
4. Dates: resolve to ISO yyyy-mm-dd. If the form only gives a day/month without a year, assume the nearest future occurrence of that date relative to today. If you truly cannot resolve a date, leave it null and explain in qualityNotes or the payment's description instead of guessing.
5. Phone numbers: report digits as written; don't reformat beyond removing obvious handwriting artifacts.
6. imageQuality: "ok" unless something about the photo itself (not the form's content) is the problem — out of focus, part of the form cut off from frame, or glare/shadow making a section genuinely unreadable. A form that's simply mostly blank (customer didn't fill in every field) is still "ok" — that's a form-content fact, not an image-quality problem.

THE H&H AUTO SALES "DOWN PAYMENT AGREEMENT" FORM — read it exactly like this:

- It's identified by the boxed heading "DOWN PAYMENT AGREEMENT" with "H&H Auto Sales" letterhead (3112 Fremont St, Las Vegas, NV 89104) printed below it.
- "Buyer Name(s):" is ONE field holding the customer's full name, not separate first/last name boxes. Split it yourself: the first word is firstName, everything after is lastName — even if that's more than one word (e.g. "Osnier Gonzalez Rodriguez" -> firstName "Osnier", lastName "Gonzalez Rodriguez"; this double-surname pattern is common and correct, don't try to guess which word is a "real" last name beyond this simple split).
- "Address" is followed by TWO lines: a street address line, then a "City, State Zip" line directly below it (comma before the state, e.g. "Las Vegas, NV 89104") — split that second line into city/state/zip.
- "Home Phone:" and "Cell Phone:" are two separate printed labels, often filled in with the same number. Use Cell Phone as the phone value; fall back to Home Phone only if Cell Phone is blank.
- "Collateral:" is the vehicle on THIS deal (what's being financed) — it's this form's label for vehicle of interest. Parse it as "YYYY Make Model" into vehicleYear/vehicleMake/vehicleModel (e.g. "2016 Nissan Sentra" -> 2016 / Nissan / Sentra).
- "Stock #:" next to Collateral is vehicleStockNumber.
- "Contract Date:" is when the agreement was signed — there's no dedicated CRM field for it, so note it in salesNotes (e.g. "Down payment agreement signed 11/02/2026"). Don't confuse it with a payment due date.
- "Cash Down: $___ Due:___" is the amount collected at/near signing -> initialPaymentToday, with its own due date (usually the same as Contract Date). Watch for a printed amount that's been crossed out with a different amount handwritten above it — a correction. When that happens, cross-check against "Total Down" below (see next point) before deciding which figure is right.
- "Deferred Down Payment(s):" is followed by several blank "$___ Due:___" rows (this form has 7 slots; most are usually blank). Each row that has BOTH an amount and a date filled in is one entry in pickPayments, kind "REMAINING_DOWN_PAYMENT". Skip any row left entirely blank.
- "Total Down: $___" is a printed/typed checksum, not another payment — it should equal Cash Down + the sum of every filled Deferred Down Payment row. Use it to validate your reading of Cash Down: if your extracted numbers don't add up to Total Down, that's exactly the kind of discrepancy rule 2 above means — report your best reading of Cash Down, add "initialPaymentToday" to lowConfidenceFields, and explain the mismatch in qualityNotes (e.g. "Cash Down looks corrected to $2,500, but Cash Down + Deferred ($500) should equal the printed Total Down of $2,000, which only matches if Cash Down is actually $1,500 — verify by hand"). Never create a payment record for Total Down itself.
- Signature lines and dates at the bottom carry no CRM field — don't extract them.
- This form has no salesperson name, email address, financing type, desired payment, or appointment date anywhere on it. Leave salespersonName/appointmentDate/appointmentTime/financeType/desiredPayment/downPayment/email null for this form type — that's correct, not missing data to chase.

FALLBACK for any other lead/intake form (printed labels with handwritten answers next to or below them, checkboxes for multiple-choice fields): read it the way a person would — find each printed label, then read whatever is written in its associated blank — regardless of the photo's rotation, lighting, or handwriting style.`;

export async function extractLeadFormFromImage(params: { base64: string; mediaType: string }): Promise<ExtractResult> {
  if (!isAiScanConfigured()) {
    return { ok: false, error: "AI Lead Scanner isn't configured yet — an admin needs to set ANTHROPIC_API_KEY for this dealership's CRM." };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: params.mediaType as "image/jpeg" | "image/png" | "image/webp", data: params.base64 } },
            { type: "text", text: "Extract every field from this dealership lead form photo per your instructions." },
          ],
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `AI scan failed: ${err.message}` : "AI scan failed — please try again." };
  }

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === EXTRACTION_TOOL.name);
  if (!toolUse) {
    return { ok: false, error: "AI scan didn't return readable results — please try again." };
  }

  return { ok: true, data: toolUse.input as ExtractedLeadForm };
}
